#!/usr/bin/env python3
"""
통합 스토리지 서비스를 사용하는 사진 업로드 API 함수
로컬/OCI 자동 전환 지원
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
from typing import Dict, Any

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from shared.storage_service import UnifiedStorageService
    from shared.utils import generate_photo_id, get_current_timestamp
except ImportError as e:
    print(f"Import 오류: {e}")
    # Fallback 함수들
    def generate_photo_id():
        return str(uuid.uuid4())

    def get_current_timestamp():
        return datetime.now().isoformat()

# 테스트용 간단한 API 응답 함수
def create_api_response(status_code, data=None, message=""):
    response = {"status": status_code, "message": message}
    if data:
        response["data"] = data
    return response

def handler_unified(request_data: dict = None) -> dict:
    """
    통합 스토리지 서비스를 사용하는 사진 업로드 핸들러

    Args:
        request_data: 요청 데이터

    Returns:
        dict: 응답 데이터
    """
    try:
        if not request_data:
            return create_api_response(400, message="요청 데이터가 없습니다")

        # HTTP 메서드 확인
        method = request_data.get('method', 'POST')

        if method == 'OPTIONS':
            return create_api_response(200, message="CORS preflight")

        if method != 'POST':
            return create_api_response(405, message="POST 메서드만 지원됩니다")

        # 필수 필드 검증
        required_fields = ['files']
        missing_fields = [field for field in required_fields if field not in request_data]

        if missing_fields:
            return create_api_response(
                400,
                message=f"필수 필드가 누락되었습니다: {missing_fields}"
            )

        files_data = request_data['files']
        if not files_data:
            return create_api_response(400, message="업로드할 파일이 없습니다")

        print(f"📤 {len(files_data)}개 파일 업로드 요청 처리 중...")

        # 통합 스토리지 서비스 초기화
        storage_service = UnifiedStorageService()
        storage_info = storage_service.get_storage_info()
        print(f"🔧 사용중인 스토리지: {storage_info['storage_type']}")

        processed_files = []

        for file_data in files_data:
            try:
                # 파일 데이터 추출
                file_content_b64 = file_data.get('file')
                description = file_data.get('description', '')
                thumbnails_data = file_data.get('thumbnails', {})
                exif_data = file_data.get('exifData', {})
                location = file_data.get('location')

                if not file_content_b64:
                    print("⚠️  파일 데이터가 없는 항목 건너뛰기")
                    continue

                # Base64 디코딩
                try:
                    if file_content_b64.startswith('data:'):
                        header, file_content_b64 = file_content_b64.split(',', 1)

                    file_content = base64.b64decode(file_content_b64)
                    print(f"✅ 파일 디코딩 성공: {len(file_content)} bytes")
                except Exception as e:
                    print(f"❌ 파일 디코딩 실패: {str(e)}")
                    continue

                # 사진 ID 생성
                photo_id = generate_photo_id()

                # 파일 확장자 결정 (MIME 타입에서)
                file_extension = '.jpg'  # 기본값
                if 'image/png' in str(file_content_b64[:50]):
                    file_extension = '.png'
                elif 'image/webp' in str(file_content_b64[:50]):
                    file_extension = '.webp'

                print(f"📷 사진 ID: {photo_id}, 확장자: {file_extension}")

                # 썸네일 데이터 변환 (프론트엔드에서 온 것)
                processed_thumbnails = {}
                if thumbnails_data:
                    for size, thumb_data in thumbnails_data.items():
                        if 'dataUrl' in thumb_data:
                            try:
                                # Base64 디코딩
                                thumb_b64 = thumb_data['dataUrl']
                                if thumb_b64.startswith('data:'):
                                    _, thumb_b64 = thumb_b64.split(',', 1)

                                thumb_bytes = base64.b64decode(thumb_b64)

                                processed_thumbnails[size] = {
                                    'data': thumb_bytes,
                                    'width': thumb_data.get('width', 150),
                                    'height': thumb_data.get('height', 150)
                                }
                                print(f"  ✅ 썸네일 {size}: {len(thumb_bytes)} bytes")
                            except Exception as e:
                                print(f"  ⚠️  썸네일 {size} 처리 실패: {str(e)}")

                # 메타데이터 준비
                metadata = {
                    'photo_id': photo_id,
                    'description': description,
                    'upload_timestamp': get_current_timestamp(),
                    'file_size': str(len(file_content))
                }

                if exif_data:
                    metadata['exif_camera'] = exif_data.get('camera', '')
                    metadata['exif_timestamp'] = exif_data.get('timestamp', '')

                if location:
                    metadata['latitude'] = str(location.get('latitude', ''))
                    metadata['longitude'] = str(location.get('longitude', ''))

                # 통합 스토리지 서비스로 업로드
                print(f"🚀 스토리지 업로드 시작...")
                upload_result = storage_service.upload_photo(
                    file_content=file_content,
                    photo_id=photo_id,
                    file_extension=file_extension,
                    thumbnails=processed_thumbnails,
                    metadata=metadata
                )

                if upload_result['success']:
                    # 성공 응답 데이터 구성
                    response_data = {
                        'photo_id': photo_id,
                        'filename': upload_result['filename'],
                        'file_url': upload_result['file_url'],
                        'thumbnail_urls': upload_result['thumbnail_urls'],
                        'file_size': upload_result['file_size'],
                        'location': location,
                        'exif_data': exif_data,
                        'description': description,
                        'upload_timestamp': get_current_timestamp(),
                        'storage_type': upload_result['storage_type']
                    }

                    processed_files.append({
                        'success': True,
                        'data': response_data
                    })

                    print(f"✅ 업로드 성공: {photo_id}")
                    print(f"   - 파일 URL: {upload_result['file_url']}")
                    print(f"   - 썸네일: {len(upload_result['thumbnail_urls'])}개")

                else:
                    error_msg = upload_result.get('error', '알 수 없는 오류')
                    processed_files.append({
                        'success': False,
                        'error': error_msg
                    })
                    print(f"❌ 업로드 실패: {error_msg}")

            except Exception as e:
                error_msg = f"파일 처리 중 오류: {str(e)}"
                processed_files.append({
                    'success': False,
                    'error': error_msg
                })
                print(f"❌ 파일 처리 오류: {str(e)}")
                print(f"❌ Traceback: {traceback.format_exc()}")

        # 전체 결과 처리
        success_count = sum(1 for f in processed_files if f['success'])
        total_count = len(processed_files)

        if success_count > 0:
            return create_api_response(
                201,
                data={
                    'files': processed_files,
                    'summary': {
                        'total': total_count,
                        'success': success_count,
                        'failed': total_count - success_count,
                        'storage_type': storage_info['storage_type']
                    }
                },
                message=f"{success_count}/{total_count} 파일 업로드 완료"
            )
        else:
            return create_api_response(
                500,
                data={'files': processed_files},
                message="모든 파일 업로드 실패"
            )

    except Exception as e:
        print(f"❌ 핸들러 오류: {str(e)}")
        print(f"❌ Traceback: {traceback.format_exc()}")
        return create_api_response(500, message=f"서버 내부 오류: {str(e)}")

def main_test():
    """통합 스토리지 서비스 테스트를 위한 메인 함수"""
    print("🚀 통합 스토리지 서비스 사진 업로드 테스트")

    # 간단한 테스트 데이터
    test_image_data = b"FAKE_IMAGE_DATA" + os.urandom(1024)
    test_image_b64 = base64.b64encode(test_image_data).decode('utf-8')

    # 테스트 썸네일 데이터
    test_thumbnails = {
        'small': {
            'dataUrl': 'data:image/jpeg;base64,' + base64.b64encode(b"SMALL_THUMB" + os.urandom(200)).decode('utf-8'),
            'width': 150,
            'height': 150
        },
        'medium': {
            'dataUrl': 'data:image/jpeg;base64,' + base64.b64encode(b"MEDIUM_THUMB" + os.urandom(400)).decode('utf-8'),
            'width': 400,
            'height': 400
        }
    }

    test_request = {
        'method': 'POST',
        'files': [
            {
                'file': 'data:image/jpeg;base64,' + test_image_b64,
                'description': '통합 스토리지 테스트 사진',
                'thumbnails': test_thumbnails,
                'exifData': {
                    'camera': 'Test Camera',
                    'timestamp': '2025-09-15T15:00:00Z'
                },
                'location': {
                    'latitude': 37.5665,
                    'longitude': 126.9780
                }
            }
        ]
    }

    # 핸들러 실행
    result = handler_unified(test_request)

    print(f"\n📊 테스트 결과:")
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")

    if 'data' in result:
        data = result['data']
        if 'summary' in data:
            summary = data['summary']
            print(f"성공: {summary['success']}/{summary['total']}")
            print(f"스토리지 타입: {summary['storage_type']}")

    return result

if __name__ == "__main__":
    main_test()