"""
공통 유틸리티 함수들
"""
import json
import uuid
import base64
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io

def generate_photo_id() -> str:
    """고유한 사진 ID 생성"""
    return str(uuid.uuid4())

def generate_file_hash(file_content: bytes) -> str:
    """파일 내용의 SHA-256 해시 생성"""
    return hashlib.sha256(file_content).hexdigest()

def get_file_extension(filename: str) -> str:
    """파일 확장자 추출"""
    return filename.lower().split('.')[-1] if '.' in filename else ''

def validate_image_file(file_content: bytes, filename: str, max_size: int) -> Tuple[bool, str]:
    """이미지 파일 유효성 검사"""
    if len(file_content) > max_size:
        return False, f"File size {len(file_content)} exceeds maximum {max_size} bytes"

    ext = f".{get_file_extension(filename)}"
    from config import Config
    if ext not in Config.ALLOWED_EXTENSIONS:
        return False, f"File extension {ext} not allowed"

    try:
        # PIL로 이미지 검증
        image = Image.open(io.BytesIO(file_content))
        image.verify()
        return True, "Valid image file"
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

def extract_exif_data(file_content: bytes) -> Dict[str, Any]:
    """EXIF 데이터 추출"""
    try:
        image = Image.open(io.BytesIO(file_content))
        exif_data = {}

        if hasattr(image, '_getexif'):
            exif = image._getexif()
            if exif:
                for tag_id, value in exif.items():
                    tag = TAGS.get(tag_id, tag_id)
                    exif_data[tag] = value

                # GPS 정보 처리
                if 'GPSInfo' in exif_data:
                    gps_data = {}
                    for key, value in exif_data['GPSInfo'].items():
                        gps_tag = GPSTAGS.get(key, key)
                        gps_data[gps_tag] = value
                    exif_data['GPSInfo'] = gps_data

        return exif_data

    except Exception as e:
        print(f"EXIF extraction error: {str(e)}")
        return {}

def convert_gps_to_decimal(gps_info: Dict) -> Optional[Tuple[float, float]]:
    """GPS 좌표를 십진수로 변환"""
    try:
        def convert_to_degrees(value):
            """DMS(도분초)를 십진수로 변환"""
            d, m, s = value
            return float(d) + float(m)/60 + float(s)/3600

        lat = gps_info.get('GPSLatitude')
        lat_ref = gps_info.get('GPSLatitudeRef')
        lon = gps_info.get('GPSLongitude')
        lon_ref = gps_info.get('GPSLongitudeRef')

        if lat and lon and lat_ref and lon_ref:
            latitude = convert_to_degrees(lat)
            longitude = convert_to_degrees(lon)

            if lat_ref == 'S':
                latitude = -latitude
            if lon_ref == 'W':
                longitude = -longitude

            return latitude, longitude

    except Exception as e:
        print(f"GPS conversion error: {str(e)}")

    return None

def create_api_response(status_code: int, data: Any = None, message: str = "") -> Dict[str, Any]:
    """표준 API 응답 생성"""
    response = {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": json.dumps({
            "success": status_code < 400,
            "message": message,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }, ensure_ascii=False)
    }
    return response

def parse_multipart_form_data(event_body: str, content_type: str) -> Dict[str, Any]:
    """multipart/form-data 파싱 (간단한 구현)"""
    # 실제 프로덕션에서는 더 견고한 라이브러리 사용 권장
    # 예: python-multipart, requests-toolbelt 등

    try:
        # Content-Type에서 boundary 추출
        boundary = content_type.split('boundary=')[1]

        # Base64 디코딩된 바이너리 데이터
        if event_body.startswith('data:'):
            # Data URL 형식 처리
            header, data = event_body.split(',', 1)
            file_content = base64.b64decode(data)
        else:
            # 직접 base64 인코딩된 경우
            file_content = base64.b64decode(event_body)

        return {
            'file_content': file_content,
            'boundary': boundary
        }

    except Exception as e:
        raise ValueError(f"Failed to parse multipart data: {str(e)}")

def get_current_timestamp() -> str:
    """현재 UTC 타임스탬프 반환"""
    return datetime.utcnow().isoformat() + 'Z'