#!/usr/bin/env python3
"""
OCI SDK 없이 로컬에서 테스트할 수 있는 간소화된 API 함수
"""
import io
import json
import base64
import traceback
import hashlib
import uuid
import sys
import os
from datetime import datetime
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS

# 로컬 테스트용 썸네일 생성기 클래스
class LocalThumbnailGenerator:
    """로컬 테스트용 간단한 썸네일 생성기"""

    def __init__(self):
        self.thumbnail_sizes = [
            {'name': 'small', 'width': 150, 'height': 150},
            {'name': 'medium', 'width': 400, 'height': 400},
            {'name': 'large', 'width': 800, 'height': 600}
        ]

    def create_thumbnails(self, image_data: bytes) -> dict:
        """실제 썸네일 생성"""
        thumbnails = {}

        try:
            # 원본 이미지 로드
            from PIL import ImageOps
            original_image = Image.open(io.BytesIO(image_data))
            original_image = ImageOps.exif_transpose(original_image)

            # RGB로 변환 (투명도 제거)
            if original_image.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', original_image.size, (255, 255, 255))
                if original_image.mode == 'P':
                    original_image = original_image.convert('RGBA')
                if 'transparency' in original_image.info:
                    background.paste(original_image, mask=original_image.split()[-1])
                else:
                    background.paste(original_image)
                original_image = background
            elif original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')

            # 각 크기별 썸네일 생성
            for size_config in self.thumbnail_sizes:
                thumbnail = self._resize_image(
                    original_image,
                    size_config['width'],
                    size_config['height']
                )

                # JPEG로 저장
                output = io.BytesIO()
                thumbnail.save(output, format='JPEG', quality=85, optimize=True)
                thumbnail_data = output.getvalue()

                thumbnails[size_config['name']] = {
                    'data': thumbnail_data,
                    'width': thumbnail.width,
                    'height': thumbnail.height,
                    'size': len(thumbnail_data),
                    'format': 'JPEG'
                }

        except Exception as e:
            print(f"썸네일 생성 중 오류: {e}")
            raise

        return thumbnails

    def _resize_image(self, image: Image.Image, target_width: int, target_height: int) -> Image.Image:
        """이미지를 목표 크기로 리사이즈 (aspect ratio 유지)"""
        # 원본 크기
        original_width, original_height = image.size

        # 비율 계산
        width_ratio = target_width / original_width
        height_ratio = target_height / original_height
        ratio = min(width_ratio, height_ratio)

        # 새 크기 계산
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)

        # 리사이즈
        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 중앙 정렬로 목표 크기에 맞추기
        if new_width != target_width or new_height != target_height:
            background = Image.new('RGB', (target_width, target_height), (255, 255, 255))
            x_offset = (target_width - new_width) // 2
            y_offset = (target_height - new_height) // 2
            background.paste(resized_image, (x_offset, y_offset))
            return background

        return resized_image

THUMBNAIL_GENERATOR_AVAILABLE = True
print("✅ 로컬 썸네일 생성기 준비 완료")

# 설정
class LocalConfig:
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}

def generate_photo_id():
    """고유한 사진 ID 생성"""
    return str(uuid.uuid4())

def generate_file_hash(file_content):
    """파일 내용의 SHA-256 해시 생성"""
    return hashlib.sha256(file_content).hexdigest()

def get_file_extension(filename):
    """파일 확장자 추출"""
    return filename.lower().split('.')[-1] if '.' in filename else ''

def validate_image_file(file_content, filename, max_size):
    """이미지 파일 유효성 검사"""
    if len(file_content) > max_size:
        return False, f"File size {len(file_content)} exceeds maximum {max_size} bytes"

    ext = f".{get_file_extension(filename)}"
    if ext not in LocalConfig.ALLOWED_EXTENSIONS:
        return False, f"File extension {ext} not allowed"

    try:
        # PIL로 이미지 검증
        image = Image.open(io.BytesIO(file_content))
        image.verify()
        return True, "Valid image file"
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

def extract_exif_data(file_content):
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

def convert_gps_to_decimal(gps_info):
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

def create_api_response(status_code, data=None, message=""):
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

def get_current_timestamp():
    """현재 UTC 타임스탬프 반환"""
    return datetime.utcnow().isoformat() + 'Z'

def mock_upload_file(file_content, object_name):
    """로컬 파일 저장"""
    try:
        # 로컬 저장 경로 생성
        storage_path = f"/tmp/photolog-storage/{object_name}"
        os.makedirs(os.path.dirname(storage_path), exist_ok=True)

        # 파일 저장
        with open(storage_path, 'wb') as f:
            f.write(file_content)

        return {
            "success": True,
            "object_name": object_name,
            "url": f"http://localhost:8000/storage/{object_name}",
            "etag": "mock-etag-123",
            "size": len(file_content)
        }
    except Exception as e:
        print(f"파일 저장 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }

def generate_thumbnails(file_content, photo_id):
    """실제 썸네일 생성"""
    try:
        # 로컬 썸네일 생성기 사용
        thumbnail_generator = LocalThumbnailGenerator()
        thumbnails = thumbnail_generator.create_thumbnails(file_content)

        # 썸네일 저장 및 URL 생성
        thumbnail_urls = {}
        for size_name, thumbnail_info in thumbnails.items():
            # 썸네일을 로컬에 저장
            thumbnail_path = f"/tmp/photolog-storage/thumbnails/{photo_id}_{size_name}.jpg"
            os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)

            with open(thumbnail_path, 'wb') as f:
                f.write(thumbnail_info['data'])

            thumbnail_urls[size_name] = f"http://localhost:8000/storage/thumbnails/{photo_id}_{size_name}.jpg"

        print(f"✅ 로컬 썸네일 생성기로 {len(thumbnail_urls)}개 썸네일 생성 완료")
        print(f"   생성된 크기: {list(thumbnail_urls.keys())}")
        for size_name, thumbnail_info in thumbnails.items():
            print(f"   {size_name}: {thumbnail_info['width']}x{thumbnail_info['height']} ({thumbnail_info['size']} bytes)")

        return thumbnail_urls

    except Exception as e:
        print(f"❌ 썸네일 생성 실패: {e}")
        # 실패 시 빈 딕셔너리 반환
        return {}

def mock_save_metadata(photo_metadata):
    """모의 메타데이터 저장"""
    return {
        "success": True,
        "photo_id": photo_metadata["id"]
    }

def local_photo_upload_handler(request_data):
    """
    로컬 테스트용 사진 업로드 핸들러
    """
    try:
        # 필수 필드 검증
        required_fields = ['filename', 'file_data', 'content_type']
        missing_fields = [field for field in required_fields if field not in request_data]

        if missing_fields:
            return create_api_response(
                400,
                message=f"Missing required fields: {missing_fields}"
            )

        # 파일 데이터 처리
        filename = request_data['filename']
        file_data_b64 = request_data['file_data']
        content_type = request_data['content_type']
        description = request_data.get('description', '')

        # 프론트엔드에서 처리된 데이터들
        frontend_thumbnails = request_data.get('thumbnails', {})
        frontend_exif_data = request_data.get('exif_data', {})
        frontend_location = request_data.get('location')

        # Base64 디코딩
        try:
            # Data URL 형식 처리 (data:image/jpeg;base64,...)
            if file_data_b64.startswith('data:'):
                header, file_data_b64 = file_data_b64.split(',', 1)

            file_content = base64.b64decode(file_data_b64)
        except Exception as e:
            return create_api_response(400, message=f"Invalid file data: {str(e)}")

        # 파일 유효성 검사
        is_valid, validation_message = validate_image_file(
            file_content, filename, LocalConfig.MAX_FILE_SIZE
        )

        if not is_valid:
            return create_api_response(400, message=validation_message)

        # 고유 ID 및 파일명 생성
        photo_id = generate_photo_id()
        file_hash = generate_file_hash(file_content)
        file_extension = get_file_extension(filename)
        object_name = f"photos/{photo_id}.{file_extension}"

        # EXIF 데이터 및 위치 정보 처리
        if frontend_exif_data:
            # 프론트엔드에서 처리된 EXIF 데이터 사용
            exif_data = frontend_exif_data
            print("✅ 프론트엔드에서 처리된 EXIF 데이터 사용")
        else:
            # 백엔드에서 EXIF 데이터 추출 (fallback)
            exif_data = extract_exif_data(file_content)
            print("⚙️ 백엔드에서 EXIF 데이터 추출")

        # 위치 정보 처리
        if frontend_location:
            # 프론트엔드에서 처리된 위치 정보 사용
            location = frontend_location
            print(f"✅ 프론트엔드에서 처리된 위치 정보 사용: {location}")
        elif 'GPSInfo' in exif_data:
            # 백엔드에서 GPS 좌표 처리 (fallback)
            gps_coords = convert_gps_to_decimal(exif_data['GPSInfo'])
            if gps_coords:
                location = {
                    'latitude': gps_coords[0],
                    'longitude': gps_coords[1]
                }
                print(f"⚙️ 백엔드에서 GPS 좌표 처리: {location}")
            else:
                location = None
        else:
            location = None

        # 모의 업로드
        upload_result = mock_upload_file(file_content, object_name)

        if not upload_result['success']:
            return create_api_response(
                500,
                message=f"File upload failed: {upload_result.get('error', 'Unknown error')}"
            )

        # 썸네일 처리
        thumbnail_urls = {}

        if frontend_thumbnails:
            # 프론트엔드에서 생성된 썸네일 사용
            print("✅ 프론트엔드에서 생성된 썸네일 사용")
            try:
                for size_name, thumbnail_b64 in frontend_thumbnails.items():
                    if thumbnail_b64:
                        # Base64 디코딩
                        thumbnail_data = base64.b64decode(thumbnail_b64)

                        # 썸네일을 로컬에 저장
                        thumbnail_path = f"/tmp/photolog-storage/thumbnails/{photo_id}_{size_name}.jpg"
                        os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)

                        with open(thumbnail_path, 'wb') as f:
                            f.write(thumbnail_data)

                        thumbnail_urls[size_name] = f"http://localhost:8000/storage/thumbnails/{photo_id}_{size_name}.jpg"
                        print(f"   ✅ {size_name} 썸네일 저장 완료")

            except Exception as e:
                print(f"❌ 프론트엔드 썸네일 처리 실패: {str(e)}")
                # 프론트엔드 썸네일 실패 시 백엔드에서 생성
                frontend_thumbnails = {}

        # 프론트엔드 썸네일이 없거나 실패한 경우 백엔드에서 생성
        if not frontend_thumbnails:
            try:
                print(f"⚙️ 백엔드에서 썸네일 생성 시작 (Photo ID: {photo_id})")
                thumbnail_urls = generate_thumbnails(file_content, photo_id)
                print(f"🎯 백엔드 썸네일 생성 완료: {list(thumbnail_urls.keys())}")
            except Exception as e:
                print(f"❌ 백엔드 썸네일 생성 실패: {str(e)}")
                # 썸네일 생성 실패해도 메인 업로드는 계속 진행

        # 메타데이터 준비
        photo_metadata = {
            'id': photo_id,
            'filename': filename,
            'description': description,
            'file_url': upload_result['url'],
            'thumbnail_urls': thumbnail_urls,  # 썸네일 URL들 추가
            'file_size': len(file_content),
            'content_type': content_type,
            'upload_timestamp': get_current_timestamp(),
            'file_hash': file_hash,
            'exif_data': exif_data,
            'location': location
        }

        # 모의 DB 저장
        db_result = mock_save_metadata(photo_metadata)

        if not db_result['success']:
            return create_api_response(
                500,
                message=f"Database save failed: {db_result.get('error', 'Unknown error')}"
            )

        # 성공 응답
        response_data = {
            'photo_id': photo_id,
            'filename': filename,
            'file_url': upload_result['url'],
            'thumbnail_urls': thumbnail_urls,  # 썸네일 URL들 추가
            'file_size': len(file_content),
            'location': location,
            'exif_data': exif_data,  # 프론트엔드에서 처리한 전체 EXIF 데이터 반환
            'thumbnails_generated': len(thumbnail_urls)  # 생성된 썸네일 수
        }

        return create_api_response(
            201,
            data=response_data,
            message="Photo uploaded successfully"
        )

    except json.JSONDecodeError:
        return create_api_response(400, message="Invalid JSON format")

    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")

        return create_api_response(
            500,
            message="Internal server error"
        )

# 테스트 실행 부분
if __name__ == "__main__":
    print("🧪 로컬 사진 업로드 API 테스트")
    print("=" * 50)

    # 테스트용 작은 이미지 Base64 데이터 생성
    def create_test_image_b64():
        """테스트용 유효한 작은 이미지 Base64 데이터 생성"""
        # PIL로 간단한 10x10 이미지 생성
        test_image = Image.new('RGB', (10, 10), color='red')
        output = io.BytesIO()
        test_image.save(output, format='JPEG', quality=85)
        jpeg_data = output.getvalue()
        return base64.b64encode(jpeg_data).decode('utf-8')

    # 테스트 1: 성공적인 업로드
    print("\n✅ 테스트 1: 성공적인 사진 업로드")
    test_data = {
        "filename": "test-photo.jpg",
        "file_data": create_test_image_b64(),
        "content_type": "image/jpeg",
        "description": "테스트 사진입니다"
    }

    result = local_photo_upload_handler(test_data)
    response_data = json.loads(result['body'])

    print(f"상태 코드: {result['statusCode']}")
    print(f"성공 여부: {response_data['success']}")
    print(f"메시지: {response_data['message']}")

    if response_data['success'] and response_data.get('data'):
        data = response_data['data']
        print(f"사진 ID: {data.get('photo_id', 'N/A')}")
        print(f"파일 URL: {data.get('file_url', 'N/A')}")
        print(f"파일 크기: {data.get('file_size', 'N/A')} bytes")

    # 테스트 2: 필수 필드 누락
    print("\n❌ 테스트 2: 필수 필드 누락")
    test_data_invalid = {
        "filename": "test-photo.jpg"
        # file_data와 content_type 누락
    }

    result = local_photo_upload_handler(test_data_invalid)
    response_data = json.loads(result['body'])

    print(f"상태 코드: {result['statusCode']}")
    print(f"성공 여부: {response_data['success']}")
    print(f"에러 메시지: {response_data['message']}")

    print("\n🎉 로컬 테스트 완료!")