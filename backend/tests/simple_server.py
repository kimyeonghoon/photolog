#!/usr/bin/env python3
"""
포토로그 로컬 개발 서버

개발 및 테스트 목적의 간단한 HTTP API 서버입니다.
주요 기능:
- 사진 업로드 및 메타데이터 관리
- 썸네일 자동 생성
- JWT 기반 인증 시스템
- 텔레그램 봇 연동 2FA
- CORS 지원
- 지오코딩 프록시
- OCI NoSQL 및 Object Storage 연동

Usage:
    python3 simple_server.py --port 8001
"""
# 표준 라이브러리
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import os
import sys
import io
from urllib.parse import urlparse, parse_qs

# Docker 환경 및 로컬 개발 환경에서의 경로 설정
# 파일 경로를 기반으로 프로젝트 루트 및 공유 모듈 경로 설정
current_dir = os.path.dirname(os.path.abspath(__file__)) if __file__ else '/app/tests'
sys.path.insert(0, current_dir)                    # 현재 디렉토리 (tests)
sys.path.insert(0, os.path.join(current_dir, '..')) # 부모 디렉토리 (backend)

# 프로젝트 모듈 임포트
from test_func_unified import handler_unified       # 통합 사진 업로드 핸들러
sys.path.insert(0, os.path.join(current_dir, '..', 'shared')) # 공유 모듈 경로
from auth_service import AuthService, verify_auth_token, require_auth  # JWT 인증 서비스
from database_client import get_database_client  # 데이터베이스 클라이언트

class PhotoAPIHandler(BaseHTTPRequestHandler):
    """
    포토로그 API 요청 처리 핸들러

    HTTP 요청을 받아서 각 엔드포인트별로 적절한 처리를 수행:
    - GET: 헬스체크, 사진 조회, 정적 파일 서빙
    - POST: 인증, 사진 업로드
    - PUT: 사진 메타데이터 수정
    - DELETE: 사진 삭제
    - OPTIONS: CORS preflight 처리
    """
    def do_OPTIONS(self):
        """CORS preflight 요청 처리"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def do_GET(self):
        """GET 요청 처리"""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/health':
            response_data = {
                "success": True,
                "message": "Server is running",
                "version": "1.0.0",
                "endpoints": [
                    "/api/health",
                    "/api/auth/login",
                    "/api/auth/verify",
                    "/api/photos/upload",
                    "/api/photos/upload-unified",
                    "/api/photos",
                    "/api/photos/stats",
                    "/api/photos/by-location",
                    "/api/photos/by-date",
                    "/api/photos/{id}",
                    "/storage/*"
                ]
            }
            self.send_json_response(200, response_data)
        elif parsed_path.path == '/api/photos':
            # 사진 목록 조회
            query_params = parse_qs(parsed_path.query)
            limit = int(query_params.get('limit', ['20'])[0])
            page = query_params.get('page', [None])[0]
            offset = query_params.get('offset', [None])[0]
            order_by = query_params.get('order_by', ['upload_timestamp'])[0]
            order = query_params.get('order', ['DESC'])[0]

            # offset이 제공된 경우 page로 변환 (프론트엔드 호환성)
            if offset is not None and page is None:
                try:
                    offset_int = int(offset)
                    page = str((offset_int // limit) + 1)
                except (ValueError, ZeroDivisionError):
                    page = "1"

            try:
                from test_func_unified import get_photo_list
                result = get_photo_list(limit, page, order_by, order)
                self.send_json_response(200, result)

            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"Photo list error: {str(e)}"
                }
                self.send_json_response(500, error_response)

        elif parsed_path.path == '/api/photos/stats':
            # 사진 통계 조회
            try:
                from test_func_unified import get_photo_stats
                result = get_photo_stats()
                self.send_json_response(200, result)
            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"사진 통계 조회 실패: {str(e)}",
                    "error": str(e)
                }
                self.send_json_response(500, error_response)

        elif parsed_path.path == '/api/photos/by-location':
            # 지역별 사진 분포 조회
            try:
                from test_func_unified import get_photos_by_location
                result = get_photos_by_location()
                self.send_json_response(200, result)
            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"지역별 분포 조회 실패: {str(e)}",
                    "error": str(e)
                }
                self.send_json_response(500, error_response)

        elif parsed_path.path == '/api/photos/by-date':
            # 년도별/월별 사진 통계 조회
            try:
                from test_func_unified import get_photos_by_date
                result = get_photos_by_date()
                self.send_json_response(200, result)
            except Exception as e:
                error_response = {
                    "success": False,
                    "message": f"날짜별 통계 조회 실패: {str(e)}",
                    "error": str(e)
                }
                self.send_json_response(500, error_response)

        elif parsed_path.path == '/api/geocoding/reverse':
            # 지오코딩 프록시 엔드포인트
            query_params = parse_qs(parsed_path.query)
            lat = query_params.get('lat', [None])[0]
            lng = query_params.get('lng', [None])[0]

            if not lat or not lng:
                self.send_json_response(400, {
                    "success": False,
                    "message": "위도(lat)와 경도(lng) 파라미터가 필요합니다."
                })
                return

            try:
                # Nominatim API 호출
                import requests
                nominatim_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&accept-language=ko,en&addressdetails=1&zoom=14"

                # User-Agent 헤더 추가 (Nominatim 정책 준수)
                headers = {
                    'User-Agent': 'Photolog/1.0 (contact@photolog.app)'
                }

                nominatim_response = requests.get(nominatim_url, headers=headers, timeout=10)

                if nominatim_response.status_code == 200:
                    data = nominatim_response.json()
                    self.send_json_response(200, {
                        "success": True,
                        "data": data
                    })
                else:
                    self.send_json_response(nominatim_response.status_code, {
                        "success": False,
                        "message": f"Geocoding API error: {nominatim_response.status_code}"
                    })

            except requests.RequestException as e:
                self.send_json_response(500, {
                    "success": False,
                    "message": f"지오코딩 요청 실패: {str(e)}"
                })
            except Exception as e:
                self.send_json_response(500, {
                    "success": False,
                    "message": f"지오코딩 서버 오류: {str(e)}"
                })

        elif parsed_path.path.startswith('/storage/'):
            # 정적 파일 서빙 (photos, thumbnails)
            self.serve_static_file(parsed_path.path)
        else:
            self.send_error(404, "Not Found")

    def serve_static_file(self, path):
        """정적 파일 서빙"""
        # /storage/photos/xxx.jpg -> /tmp/photolog-storage/photos/xxx.jpg
        # /storage/thumbnails/xxx.jpg -> /tmp/photolog-storage/thumbnails/xxx.jpg
        storage_path = path.replace('/storage/', '/tmp/photolog-storage/')

        if os.path.exists(storage_path) and os.path.isfile(storage_path):
            try:
                with open(storage_path, 'rb') as f:
                    content = f.read()

                # MIME 타입 결정
                if storage_path.endswith('.jpg') or storage_path.endswith('.jpeg'):
                    content_type = 'image/jpeg'
                elif storage_path.endswith('.png'):
                    content_type = 'image/png'
                else:
                    content_type = 'application/octet-stream'

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(content)

            except Exception as e:
                print(f"Error serving file {storage_path}: {e}")
                self.send_error(500, "Internal Server Error")
        else:
            self.send_error(404, "File Not Found")


    def do_POST(self):
        """POST 요청 처리"""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/api/auth/login':
            # 인증 로그인 요청
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                request_json = json.loads(post_data.decode('utf-8'))
                email = request_json.get('email', '').strip()

                if not email:
                    self.send_json_response(400, {
                        "success": False,
                        "message": "이메일을 입력해주세요."
                    })
                    return

                # 클라이언트 IP 주소 가져오기
                client_ip = self.client_address[0]

                # 이메일 검증 및 텔레그램 코드 발송
                success, message = AuthService.verify_email_and_send_code(email, client_ip)

                if success:
                    self.send_json_response(200, {
                        "success": True,
                        "message": message
                    })
                else:
                    self.send_json_response(400, {
                        "success": False,
                        "message": message
                    })

            except json.JSONDecodeError:
                self.send_json_response(400, {
                    "success": False,
                    "message": "잘못된 JSON 형식입니다."
                })
            except Exception as e:
                print(f"로그인 요청 오류: {e}")
                self.send_json_response(500, {
                    "success": False,
                    "message": "서버 오류가 발생했습니다."
                })

        elif parsed_path.path == '/api/auth/verify':
            # 인증 코드 검증
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                request_json = json.loads(post_data.decode('utf-8'))
                code = request_json.get('code', '').strip()

                if not code:
                    self.send_json_response(400, {
                        "success": False,
                        "message": "인증 코드를 입력해주세요."
                    })
                    return

                # 인증 코드 검증
                user = AuthService.validate_login_code(code)

                if user:
                    # JWT 토큰 생성
                    token = AuthService.create_access_token({
                        "user_id": user['id'],
                        "telegram_chat_id": user['telegram_chat_id']
                    })

                    if token:
                        self.send_json_response(200, {
                            "success": True,
                            "message": "로그인 성공",
                            "token": token,
                            "user": {
                                "id": user['id'],
                                "telegram_chat_id": user['telegram_chat_id']
                            }
                        })
                    else:
                        self.send_json_response(500, {
                            "success": False,
                            "message": "토큰 생성 실패"
                        })
                else:
                    self.send_json_response(400, {
                        "success": False,
                        "message": "잘못된 인증 코드입니다."
                    })

            except json.JSONDecodeError:
                self.send_json_response(400, {
                    "success": False,
                    "message": "잘못된 JSON 형식입니다."
                })
            except Exception as e:
                print(f"인증 검증 오류: {e}")
                self.send_json_response(500, {
                    "success": False,
                    "message": "서버 오류가 발생했습니다."
                })

        elif parsed_path.path == '/api/photos/upload' or parsed_path.path == '/api/photos/upload-unified':
            # 인증 확인
            auth_header = self.headers.get('Authorization')
            user_data = verify_auth_token(auth_header)

            if not user_data:
                self.send_json_response(401, {
                    "success": False,
                    "message": "인증이 필요합니다. 로그인 후 다시 시도하세요.",
                    "error_code": "UNAUTHORIZED"
                })
                return

            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)

            try:
                print("🚀 통합 업로드 핸들러 호출...")
                print(f"👤 인증된 사용자: {user_data.get('user_id')}")

                # POST 데이터를 JSON으로 파싱
                try:
                    request_json = json.loads(post_data.decode('utf-8'))
                    print(f"📦 요청 데이터 파싱 완료: {len(request_json.get('files', []))}개 파일")
                except json.JSONDecodeError as e:
                    print(f"❌ JSON 파싱 실패: {e}")
                    self.send_json_response(400, {
                        "success": False,
                        "message": f"Invalid JSON data: {str(e)}"
                    })
                    return

                # 통합 핸들러 사용
                result = handler_unified(request_json)
                print("✅ 통합 핸들러 실행 완료")

                # JSON 응답 전송 (CORS 헤더 포함)
                self.send_json_response(result.get('status', 200), result)

            except Exception as e:
                import traceback
                print(f"❌ 핸들러 호출 중 오류 발생: {e}")
                traceback.print_exc()
                error_response = {
                    "success": False,
                    "message": f"Server error during handler execution: {str(e)}"
                }
                self.send_json_response(500, error_response)

        else:
            self.send_error(404, "Not Found")

    def do_PUT(self):
        """PUT 요청 처리 - 사진 메타데이터 수정"""
        parsed_path = urlparse(self.path)

        # /api/photos/{photo_id} 패턴 확인
        path_parts = parsed_path.path.strip('/').split('/')
        if len(path_parts) == 3 and path_parts[0] == 'api' and path_parts[1] == 'photos':
            # 인증 확인
            auth_header = self.headers.get('Authorization')
            user_data = verify_auth_token(auth_header)

            if not user_data:
                self.send_json_response(401, {
                    "success": False,
                    "message": "인증이 필요합니다. 로그인 후 다시 시도하세요.",
                    "error_code": "UNAUTHORIZED"
                })
                return

            photo_id = path_parts[2]

            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                request_json = json.loads(post_data.decode('utf-8'))

                print(f"📝 사진 메타데이터 수정 요청: {photo_id}")
                print(f"👤 인증된 사용자: {user_data.get('user_id')}")
                print(f"📄 수정 데이터: {request_json}")

                # 데이터베이스 클라이언트로 메타데이터 업데이트
                db_client = get_database_client()

                # 기존 사진 데이터 조회
                existing_photo = db_client.get_photo_metadata(photo_id)
                if not existing_photo:
                    self.send_json_response(404, {
                        "success": False,
                        "message": "사진을 찾을 수 없습니다",
                        "photo_id": photo_id
                    })
                    return

                # 업데이트할 데이터 준비
                update_data = existing_photo.copy()

                # 요청에서 받은 필드들로 업데이트
                if 'description' in request_json:
                    update_data['description'] = request_json['description']
                if 'travel_date' in request_json:
                    update_data['travel_date'] = request_json['travel_date']
                if 'location' in request_json:
                    update_data['location'] = request_json['location']

                # 데이터베이스에 업데이트 (기존 레코드 덮어쓰기)
                result = db_client.save_photo_metadata(update_data)

                if result.get('success', False):
                    print(f"✅ 사진 메타데이터 수정 성공: {photo_id}")
                    self.send_json_response(200, {
                        "success": True,
                        "message": "사진 정보가 성공적으로 수정되었습니다",
                        "photo_id": photo_id,
                        "updated_data": update_data
                    })
                else:
                    print(f"❌ 사진 메타데이터 수정 실패: {result.get('message', 'Unknown error')}")
                    self.send_json_response(500, {
                        "success": False,
                        "message": result.get('message', '업데이트 중 오류가 발생했습니다'),
                        "photo_id": photo_id
                    })

            except json.JSONDecodeError:
                self.send_json_response(400, {
                    "success": False,
                    "message": "잘못된 JSON 형식입니다."
                })
            except Exception as e:
                print(f"❌ 사진 메타데이터 수정 중 오류: {str(e)}")
                self.send_json_response(500, {
                    "success": False,
                    "message": f"서버 오류가 발생했습니다: {str(e)}",
                    "photo_id": photo_id
                })

        else:
            self.send_error(404, "Not Found")

    def do_DELETE(self):
        """DELETE 요청 처리"""
        parsed_path = urlparse(self.path)

        # /api/photos/{photo_id} 패턴 확인
        path_parts = parsed_path.path.strip('/').split('/')
        if len(path_parts) == 3 and path_parts[0] == 'api' and path_parts[1] == 'photos':
            # 인증 확인
            auth_header = self.headers.get('Authorization')
            user_data = verify_auth_token(auth_header)

            if not user_data:
                self.send_json_response(401, {
                    "success": False,
                    "message": "인증이 필요합니다. 로그인 후 다시 시도하세요.",
                    "error_code": "UNAUTHORIZED"
                })
                return

            photo_id = path_parts[2]

            try:
                print(f"🗑️ 사진 삭제 요청: {photo_id}")
                print(f"👤 인증된 사용자: {user_data.get('user_id')}")

                # 삭제 함수 호출
                from test_func_unified import delete_photo
                result = delete_photo(photo_id)

                if result.get('success', False):
                    print(f"✅ 사진 삭제 성공: {photo_id}")
                    self.send_json_response(200, {
                        "success": True,
                        "message": "사진이 성공적으로 삭제되었습니다",
                        "photo_id": photo_id
                    })
                else:
                    print(f"❌ 사진 삭제 실패: {result.get('message', 'Unknown error')}")
                    self.send_json_response(404, {
                        "success": False,
                        "message": result.get('message', '사진을 찾을 수 없습니다'),
                        "photo_id": photo_id
                    })

            except Exception as e:
                print(f"❌ 사진 삭제 중 오류: {str(e)}")
                self.send_json_response(500, {
                    "success": False,
                    "message": f"삭제 중 오류가 발생했습니다: {str(e)}",
                    "photo_id": photo_id
                })
        else:
            self.send_error(404, "Not Found")

    def send_json_response(self, status_code, data):
        """JSON 응답 전송"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

        response_json = json.dumps(data, ensure_ascii=False)
        self.wfile.write(response_json.encode('utf-8'))

    def handle_oci_upload(self, request_data):
        """OCI Object Storage 업로드 핸들러"""
        try:
            import base64
            import uuid
            from datetime import datetime

            # 상위 디렉토리를 Python 경로에 추가
            sys.path.append('../')
            from shared.oci_client import OCIObjectStorageClient
            from shared.thumbnail_generator import ThumbnailGenerator
            from shared.utils import generate_photo_id, validate_image_file, get_file_extension

            # 필수 필드 검증
            required_fields = ['filename', 'file_data', 'content_type']
            missing_fields = [field for field in required_fields if field not in request_data]

            if missing_fields:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"Missing required fields: {missing_fields}"
                    })
                }

            # 파일 데이터 처리
            filename = request_data['filename']
            file_data_b64 = request_data['file_data']
            content_type = request_data['content_type']
            description = request_data.get('description', '')

            # Base64 디코딩
            try:
                if file_data_b64.startswith('data:'):
                    header, file_data_b64 = file_data_b64.split(',', 1)
                file_content = base64.b64decode(file_data_b64)
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"Invalid file data: {str(e)}"
                    })
                }

            # 파일 유효성 검사
            is_valid, validation_message = validate_image_file(file_content, filename, 50*1024*1024)
            if not is_valid:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": validation_message
                    })
                }

            # 고유 ID 및 파일명 생성
            photo_id = generate_photo_id()
            file_extension = get_file_extension(filename)
            object_name = f"photos/{photo_id}.{file_extension}"

            print(f"🚀 OCI 업로드 시작: {photo_id}")

            # Object Storage에 업로드
            storage_client = OCIObjectStorageClient()
            upload_result = storage_client.upload_file(
                file_content=file_content,
                object_name=object_name,
                content_type=content_type,
                metadata={
                    'photo_id': photo_id,
                    'original_filename': filename,
                    'description': description
                }
            )

            if not upload_result['success']:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        "success": False,
                        "message": f"File upload failed: {upload_result['error']}"
                    })
                }

            print(f"✅ 원본 파일 업로드 성공: {upload_result['url']}")

            # 썸네일 생성 및 업로드
            thumbnail_urls = {}
            try:
                thumbnail_generator = ThumbnailGenerator()
                thumbnails = thumbnail_generator.create_thumbnails(file_content)
                print(f"📸 썸네일 생성 완료: {list(thumbnails.keys())}")

                # 각 썸네일을 Object Storage에 업로드
                for size_name, thumbnail_info in thumbnails.items():
                    thumbnail_object_name = f"thumbnails/{photo_id}_{size_name}.jpg"

                    thumbnail_upload_result = storage_client.upload_file(
                        file_content=thumbnail_info['data'],
                        object_name=thumbnail_object_name,
                        content_type='image/jpeg',
                        metadata={
                            'photo_id': photo_id,
                            'thumbnail_size': size_name,
                            'width': str(thumbnail_info['width']),
                            'height': str(thumbnail_info['height']),
                            'generated_by': 'backend'
                        }
                    )

                    if thumbnail_upload_result['success']:
                        thumbnail_urls[size_name] = thumbnail_upload_result['url']
                        print(f"✅ 썸네일 {size_name} 업로드 성공")
                    else:
                        print(f"❌ 썸네일 {size_name} 업로드 실패: {thumbnail_upload_result.get('error')}")

            except Exception as e:
                print(f"⚠️ 썸네일 생성 실패: {str(e)}")

            # 성공 응답
            response_data = {
                'photo_id': photo_id,
                'filename': filename,
                'file_url': upload_result['url'],
                'thumbnail_urls': thumbnail_urls,
                'file_size': len(file_content),
                'thumbnails_generated': len(thumbnail_urls)
            }

            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    "success": True,
                    "message": "Photo uploaded successfully",
                    "data": response_data
                })
            }

        except Exception as e:
            print(f"❌ OCI 업로드 오류: {str(e)}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    "success": False,
                    "message": f"Upload error: {str(e)}"
                })
            }

    def log_message(self, format, *args):
        """로그 메시지 출력"""
        print(f"[{self.address_string()}] {format % args}")

def run_server(port=8000):
    """서버 실행"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, PhotoAPIHandler)
    print(f"🚀 로컬 API 서버 실행 중: http://localhost:{port}")
    print("📡 사용 가능한 엔드포인트:")
    print("   GET  /api/health")
    print("   POST /api/photos/upload")
    print("⏹️  서버 중지: Ctrl+C")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 서버 중지됨")
        httpd.server_close()

if __name__ == "__main__":
    # 스토리지 타입 자동 감지
    import os

    if 'STORAGE_TYPE' not in os.environ:
        # OCI 환경변수가 설정되어 있으면 OCI 사용, 아니면 LOCAL 사용
        if os.getenv('OCI_NAMESPACE') and os.getenv('OCI_BUCKET_NAME'):
            os.environ['STORAGE_TYPE'] = 'OCI'
            print("🔧 OCI 환경변수 감지: STORAGE_TYPE을 OCI로 설정")
        else:
            os.environ['STORAGE_TYPE'] = 'LOCAL'
            print("🔧 로컬 테스트 환경: STORAGE_TYPE을 LOCAL로 설정")
    else:
        print(f"🔧 환경변수 STORAGE_TYPE: {os.environ['STORAGE_TYPE']}")

    run_server(8001)