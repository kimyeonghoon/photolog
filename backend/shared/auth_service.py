"""
인증 및 보안 서비스

이 파일은 애플리케이션의 인증 시스템을 관리합니다.
텔레그램 봇을 통한 2FA 인증, JWT 토큰 관리, IP 기반 보안 기능을 제공합니다.

주요 기능:
- 텔레그램 봇을 통한 6자리 인증 코드 발송
- JWT 토큰 생성 및 검증
- IP 기반 로그인 시도 제한 (Rate Limiting)
- 사용자 인증 및 권한 관리

보안 특징:
- 이메일 기반 사전 승인 시스템
- 15분 토큰 만료로 보안 강화
- IP별 로그인 시도 횟수 제한 (5회 실패 시 10분 차단)
"""

# 표준 라이브러리 및 외부 라이브러리 임포트
import os
import secrets  # 안전한 랜덤 문자열 생성
import random  # 6자리 코드 생성용
import requests  # 텔레그램 API 호출
from datetime import datetime, timedelta  # 시간 관련 처리
from typing import Optional, Dict, Any  # 타입 힌팅
import json

# 환경변수 로딩
try:
    from .config import Config
except ImportError:
    # 직접 실행 시 절대 import 사용
    from config import Config

# ==================== 설정 값 정의 ====================

# JWT 토큰 설정
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-this-in-production")  # JWT 서명 키
ALGORITHM = os.getenv("ALGORITHM", "HS256")  # JWT 암호화 알고리즘
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))  # 토큰 만료 시간 (15분)

# 텔레그램 봇 설정
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")  # 텔레그램 봇 토큰
TELEGRAM_BOT_NAME = os.getenv("TELEGRAM_BOT_NAME", "포토로그 인증")  # 봇 이름
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")  # 고정 Chat ID
APP_URL = os.getenv("APP_URL", "http://localhost:8001")  # 애플리케이션 URL

# 인증 설정
ALLOWED_EMAIL = os.getenv("ALLOWED_EMAIL", "admin@photolog.app")  # 허용된 이메일 (사전 승인 시스템)
MAX_LOGIN_ATTEMPTS = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
BAN_DURATION_MINUTES = int(os.getenv("BAN_DURATION_MINUTES", "10"))


class SimpleDataStore:
    """간단한 메모리 기반 데이터 저장소 (NoSQL 없이 임시 사용)"""

    def __init__(self):
        self.users = {}  # user_id -> user_data
        self.login_tokens = {}  # token -> token_data
        self.ip_bans = {}  # ip_address -> ban_data

    def get_user_by_telegram_id(self, telegram_chat_id: str):
        """텔레그램 ID로 사용자 조회"""
        for user_id, user_data in self.users.items():
            if user_data.get('telegram_chat_id') == telegram_chat_id:
                return user_data
        return None

    def create_user(self, telegram_chat_id: str) -> Dict[str, Any]:
        """새 사용자 생성"""
        user_id = f"user_{len(self.users) + 1}"
        user_data = {
            'id': user_id,
            'telegram_chat_id': telegram_chat_id,
            'is_active': True,
            'created_at': datetime.utcnow().isoformat(),
            'last_login_request': datetime.utcnow().isoformat(),
            'last_login': None
        }
        self.users[user_id] = user_data
        return user_data

    def update_user(self, user_id: str, updates: Dict[str, Any]):
        """사용자 정보 업데이트"""
        if user_id in self.users:
            self.users[user_id].update(updates)

    def create_login_token(self, user_id: str, token: str, expires_at: datetime):
        """로그인 토큰 생성"""
        # 기존 토큰 무효화
        for token_key, token_data in list(self.login_tokens.items()):
            if token_data.get('user_id') == user_id:
                self.login_tokens[token_key]['is_used'] = True

        # 새 토큰 생성
        token_data = {
            'user_id': user_id,
            'token': token,
            'expires_at': expires_at.isoformat(),
            'is_used': False,
            'created_at': datetime.utcnow().isoformat()
        }
        self.login_tokens[token] = token_data
        return token_data

    def get_login_token(self, token: str):
        """로그인 토큰 조회"""
        return self.login_tokens.get(token)

    def use_login_token(self, token: str):
        """로그인 토큰 사용 처리"""
        if token in self.login_tokens:
            self.login_tokens[token]['is_used'] = True
            self.login_tokens[token]['used_at'] = datetime.utcnow().isoformat()

    def get_ip_ban(self, ip_address: str):
        """IP 차단 정보 조회"""
        return self.ip_bans.get(ip_address)

    def record_failed_attempt(self, ip_address: str):
        """실패한 로그인 시도 기록"""
        now = datetime.utcnow()

        if ip_address not in self.ip_bans:
            self.ip_bans[ip_address] = {
                'ip_address': ip_address,
                'failed_attempts': 1,
                'first_attempt': now.isoformat(),
                'last_attempt': now.isoformat(),
                'banned_until': None
            }
        else:
            ban_data = self.ip_bans[ip_address]
            ban_data['failed_attempts'] += 1
            ban_data['last_attempt'] = now.isoformat()

            # 최대 시도 횟수 초과 시 차단
            if ban_data['failed_attempts'] >= MAX_LOGIN_ATTEMPTS:
                ban_data['banned_until'] = (now + timedelta(minutes=BAN_DURATION_MINUTES)).isoformat()

        return self.ip_bans[ip_address]['failed_attempts'] >= MAX_LOGIN_ATTEMPTS

    def reset_failed_attempts(self, ip_address: str):
        """실패한 로그인 시도 초기화"""
        if ip_address in self.ip_bans:
            del self.ip_bans[ip_address]


# 전역 데이터 저장소 인스턴스
data_store = SimpleDataStore()


class AuthService:
    """Authentication service for handling email-based Telegram bot login."""

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        """Create JWT access token."""
        try:
            # 간단한 JWT 구현 (실제 프로덕션에서는 jose 라이브러리 사용)
            import base64
            import hmac
            import hashlib

            to_encode = data.copy()
            if expires_delta:
                expire = datetime.utcnow() + expires_delta
            else:
                expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            to_encode.update({"exp": expire.timestamp()})

            # Header
            header = {"alg": "HS256", "typ": "JWT"}
            header_b64 = base64.urlsafe_b64encode(json.dumps(header).encode()).decode().rstrip('=')

            # Payload
            payload_b64 = base64.urlsafe_b64encode(json.dumps(to_encode).encode()).decode().rstrip('=')

            # Signature
            message = f"{header_b64}.{payload_b64}"
            signature = hmac.new(SECRET_KEY.encode(), message.encode(), hashlib.sha256).digest()
            signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip('=')

            return f"{message}.{signature_b64}"
        except Exception as e:
            print(f"JWT 토큰 생성 오류: {e}")
            return None

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """Verify and decode JWT token."""
        try:
            import base64
            import hmac
            import hashlib

            parts = token.split('.')
            if len(parts) != 3:
                return None

            header_b64, payload_b64, signature_b64 = parts

            # 서명 검증
            message = f"{header_b64}.{payload_b64}"
            expected_signature = hmac.new(SECRET_KEY.encode(), message.encode(), hashlib.sha256).digest()
            expected_signature_b64 = base64.urlsafe_b64encode(expected_signature).decode().rstrip('=')

            if signature_b64 != expected_signature_b64:
                return None

            # 패딩 추가
            payload_b64 += '=' * (4 - len(payload_b64) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())

            # 만료 시간 확인
            if 'exp' in payload and payload['exp'] < datetime.utcnow().timestamp():
                return None

            return payload
        except Exception as e:
            print(f"JWT 토큰 검증 오류: {e}")
            return None

    @staticmethod
    def check_ip_ban(ip_address: str) -> Optional[Dict[str, Any]]:
        """Check if IP address is banned."""
        ban_data = data_store.get_ip_ban(ip_address)
        if ban_data and ban_data.get('banned_until'):
            banned_until = datetime.fromisoformat(ban_data['banned_until'])
            if banned_until > datetime.utcnow():
                return ban_data
        return None

    @staticmethod
    def record_failed_attempt(ip_address: str) -> bool:
        """Record failed login attempt and ban IP if necessary."""
        return data_store.record_failed_attempt(ip_address)

    @staticmethod
    def reset_failed_attempts(ip_address: str):
        """Reset failed attempts for successful login."""
        data_store.reset_failed_attempts(ip_address)

    @staticmethod
    def verify_email_and_send_code(email: str, ip_address: str) -> tuple[bool, str]:
        """Verify email and send Telegram code if valid."""
        # Verify email first
        if email.lower() != ALLOWED_EMAIL.lower():
            # Check if IP is banned before recording failed attempt
            ip_ban = AuthService.check_ip_ban(ip_address)
            if ip_ban:
                banned_until = datetime.fromisoformat(ip_ban['banned_until'])
                remaining_time = int((banned_until - datetime.utcnow()).total_seconds() / 60)
                return False, f"IP가 차단되었습니다. {remaining_time}분 후 다시 시도하세요."

            # Record failed attempt for wrong email
            is_banned = AuthService.record_failed_attempt(ip_address)
            if is_banned:
                return False, f"너무 많은 실패로 인해 {BAN_DURATION_MINUTES}분간 접속이 제한됩니다."
            return False, "등록되지 않은 이메일입니다."

        # Email is valid - reset any previous failures and IP bans
        AuthService.reset_failed_attempts(ip_address)

        # Get or create user with configured Chat ID
        if not TELEGRAM_CHAT_ID:
            return False, "텔레그램 설정이 완료되지 않았습니다."

        user = AuthService.create_user(TELEGRAM_CHAT_ID)

        # Create and send login code
        login_token = AuthService.create_login_code(user['id'])
        success = AuthService.send_login_code_telegram(user['telegram_chat_id'], login_token['token'])

        if success:
            return True, "인증 코드가 텔레그램으로 전송되었습니다."
        else:
            return True, "인증 코드가 생성되었습니다. (개발 모드)"

    @staticmethod
    def create_user(telegram_chat_id: str) -> Dict[str, Any]:
        """Create a new user or return existing user by Telegram chat ID."""
        user = data_store.get_user_by_telegram_id(telegram_chat_id)
        if user:
            data_store.update_user(user['id'], {
                'last_login_request': datetime.utcnow().isoformat()
            })
            return user

        return data_store.create_user(telegram_chat_id)

    @staticmethod
    def create_login_code(user_id: str) -> Dict[str, Any]:
        """Create a numeric login code."""
        # Generate 6-digit numeric code
        code = f"{random.randint(100000, 999999)}"
        expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        return data_store.create_login_token(user_id, code, expires_at)

    @staticmethod
    def validate_login_code(code: str) -> Optional[Dict[str, Any]]:
        """Validate numeric login code and return user if valid."""
        token_data = data_store.get_login_token(code)

        if not token_data:
            return None

        # 토큰 만료 확인
        expires_at = datetime.fromisoformat(token_data['expires_at'])
        if expires_at <= datetime.utcnow():
            return None

        # 이미 사용된 토큰 확인
        if token_data.get('is_used'):
            return None

        # 토큰 사용 처리
        data_store.use_login_token(code)

        # 사용자 정보 업데이트
        user_id = token_data['user_id']
        data_store.update_user(user_id, {
            'last_login': datetime.utcnow().isoformat()
        })

        return data_store.users.get(user_id)

    @staticmethod
    def send_login_code_telegram(chat_id: str, code: str) -> bool:
        """Send login code via Telegram bot."""
        if not TELEGRAM_BOT_TOKEN:
            print("Telegram bot token not set. Login code:", code)
            print(f"Chat ID: {chat_id}")
            return True  # For development without bot setup

        try:
            # Telegram Bot API URL
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

            # Message content
            message = f"""🔐 포토로그 로그인 코드: {code}

이 코드를 웹사이트에 입력하여 로그인하세요.

⏰ 코드는 15분 후 만료됩니다.
🚫 요청하지 않으셨다면 이 메시지를 무시하세요."""

            # Send message
            payload = {
                'chat_id': chat_id,
                'text': message
            }

            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()

            return True

        except requests.exceptions.RequestException as e:
            print(f"Failed to send Telegram message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response status: {e.response.status_code}")
                print(f"Response text: {e.response.text}")
            print(f"Login code for development: {code}")
            print(f"Chat ID: {chat_id}")
            return False
        except Exception as e:
            print(f"Unexpected error sending Telegram message: {e}")
            print(f"Login code for development: {code}")
            print(f"Chat ID: {chat_id}")
            return False


def verify_auth_token(authorization_header: str) -> Optional[Dict[str, Any]]:
    """Authorization 헤더에서 토큰을 추출하고 검증"""
    if not authorization_header:
        return None

    try:
        # "Bearer <token>" 형식에서 토큰 추출
        if not authorization_header.startswith('Bearer '):
            return None

        token = authorization_header[7:]  # "Bearer " 제거
        return AuthService.verify_token(token)
    except Exception as e:
        print(f"토큰 검증 오류: {e}")
        return None


def require_auth(func):
    """인증이 필요한 엔드포인트를 위한 데코레이터"""
    def wrapper(handler_instance, *args, **kwargs):
        # Authorization 헤더 확인
        auth_header = handler_instance.headers.get('Authorization')
        user_data = verify_auth_token(auth_header)

        if not user_data:
            handler_instance.send_json_response(401, {
                "success": False,
                "message": "인증이 필요합니다. 로그인 후 다시 시도하세요.",
                "error_code": "UNAUTHORIZED"
            })
            return

        # 인증된 사용자 정보를 handler에 추가
        handler_instance.current_user = user_data
        return func(handler_instance, *args, **kwargs)

    return wrapper