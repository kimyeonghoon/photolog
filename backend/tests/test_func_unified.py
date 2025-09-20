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

        # 통합 스토리지 서비스 초기화 (환경변수에서 storage_type 결정)
        import os
        storage_type = os.getenv('STORAGE_TYPE', 'LOCAL')
        storage_service = UnifiedStorageService(storage_type)
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

                # 디버깅: EXIF 데이터 확인
                print(f"🔍 EXIF 데이터 디버깅:")
                print(f"   file_data keys: {list(file_data.keys())}")
                print(f"   exifData: {exif_data}")
                print(f"   exifData type: {type(exif_data)}")
                print(f"   location: {location}")

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

                # 완전한 EXIF 데이터 전달
                if exif_data:
                    metadata['exif_data'] = exif_data

                if location:
                    metadata['location'] = location

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
                    # DB 저장 상태 확인
                    if not upload_result.get('db_saved', True):
                        print(f"❌ 파일 업로드는 성공했지만 DB 저장 실패: {photo_id}")
                        processed_files.append({
                            'success': False,
                            'error': f'데이터베이스 저장 실패: {photo_id}'
                        })
                        continue

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


def get_photo_list(limit: int = 20, page: str = None, order_by: str = 'upload_timestamp', order: str = 'DESC') -> dict:
    """
    사진 목록 조회 API 함수

    Args:
        limit: 조회할 개수
        page: 페이지 토큰
        order_by: 정렬 기준
        order: 정렬 순서

    Returns:
        dict: 사진 목록과 페이지 정보
    """
    try:
        # 통합 스토리지 서비스 초기화
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 사진 목록 조회
        result = service.list_photos(limit, page, order_by, order)

        if result['success']:
            # 프론트엔드가 기대하는 형식으로 변환
            photos_data = []
            for photo in result['photos']:
                # photo_id를 id로 변경하고 기타 필드 조정
                photo_data = {
                    "id": photo['photo_id'],  # photo_id를 id로 변경
                    "filename": photo['filename'],
                    "description": photo['description'],
                    "file_url": photo['file_url'],
                    "thumbnail_urls": photo['thumbnail_urls'],
                    "file_size": photo['file_size'] or 0,
                    "content_type": "image/jpeg",  # 기본값
                    "upload_timestamp": photo['upload_timestamp'] or "",
                    "location": photo['location'],
                    "exif_data": photo['exif_data'] or {}
                }
                photos_data.append(photo_data)

            response_data = {
                "photos": photos_data,
                "count": len(photos_data),
                "total": len(photos_data),  # 현재는 전체 개수와 동일
                "has_more": False  # 현재는 페이징 미구현
            }

            return {
                "success": True,
                "message": "사진 목록 조회 성공",
                "data": response_data,
                "timestamp": get_current_timestamp()
            }
        else:
            return {
                "success": False,
                "message": f"사진 목록 조회 실패: {result.get('error')}",
                "timestamp": get_current_timestamp()
            }

    except Exception as e:
        return create_api_response(500, None, f"사진 목록 조회 중 오류: {str(e)}")


def get_photo_metadata(photo_id: str) -> dict:
    """
    특정 사진 메타데이터 조회 API 함수

    Args:
        photo_id: 사진 ID

    Returns:
        dict: 사진 메타데이터
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)
        metadata = service.get_photo_metadata(photo_id)

        if metadata:
            return create_api_response(200, {"photo": metadata}, "사진 메타데이터 조회 성공")
        else:
            return create_api_response(404, None, "사진을 찾을 수 없습니다")

    except Exception as e:
        return create_api_response(500, None, f"사진 메타데이터 조회 중 오류: {str(e)}")


def search_photos_by_location(latitude: float, longitude: float, radius_km: float = 10.0, limit: int = 20) -> dict:
    """
    위치 기반 사진 검색 API 함수

    Args:
        latitude: 위도
        longitude: 경도
        radius_km: 검색 반경 (km)
        limit: 조회할 개수

    Returns:
        dict: 검색된 사진 목록
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)
        result = service.search_photos_by_location(latitude, longitude, radius_km, limit)

        if result['success']:
            return create_api_response(200, result, f"위치 기반 검색 완료: {len(result['photos'])}개 발견")
        else:
            return create_api_response(500, None, f"위치 기반 검색 실패: {result.get('error')}")

    except Exception as e:
        return create_api_response(500, None, f"위치 기반 검색 중 오류: {str(e)}")

    return result


def get_photo_list(limit: int = 20, page: str = None, order_by: str = 'upload_timestamp', order: str = 'DESC') -> dict:
    """
    사진 목록 조회 API 함수 (Database 사용)

    Args:
        limit: 조회할 사진 수
        page: 페이지 토큰
        order_by: 정렬 기준
        order: 정렬 순서

    Returns:
        dict: 사진 목록과 페이지 정보
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 데이터베이스 클라이언트가 있는 경우 데이터베이스에서 조회
        if hasattr(service, 'db_client') and service.db_client:
            print(f"📋 데이터베이스에서 사진 목록 조회 중... (limit: {limit})")
            result = service.db_client.list_photos(limit=limit, page=page, order_by=order_by, order=order)

            if result['success']:
                photos = result['photos']
                print(f"✅ 데이터베이스에서 {len(photos)}개 사진 조회 성공")

                # API 응답 형식으로 변환
                formatted_photos = []
                for photo in photos:
                    formatted_photo = {
                        "id": photo.get('photo_id', ''),
                        "filename": photo.get('filename', ''),
                        "description": photo.get('description', ''),
                        "file_url": photo.get('file_url', ''),
                        "thumbnail_urls": photo.get('thumbnail_urls', {}),
                        "file_size": photo.get('file_size', 0),
                        "content_type": "image/jpeg",
                        "upload_timestamp": photo.get('upload_timestamp', ''),
                        "location": photo.get('location'),
                        "exif_data": photo.get('exif_data', {})
                    }
                    formatted_photos.append(formatted_photo)

                response_data = {
                    "photos": formatted_photos,
                    "count": len(formatted_photos),
                    "total": len(formatted_photos),
                    "has_more": result.get('page_info', {}).get('next_page') is not None
                }

                return create_api_response(200, response_data, "사진 목록 조회 성공")
            else:
                print(f"❌ 데이터베이스 조회 실패: {result.get('error')}")
                # 데이터베이스 실패 시 Object Storage에서 조회
                return get_photo_list_from_storage(service, limit)

        else:
            print("📦 데이터베이스 클라이언트가 없어서 Object Storage에서 조회")
            # 데이터베이스가 없는 경우 Object Storage에서 직접 조회
            return get_photo_list_from_storage(service, limit)

    except Exception as e:
        print(f"❌ 사진 목록 조회 중 오류: {e}")
        return create_api_response(500, None, f"사진 목록 조회 중 오류: {str(e)}")


def get_photo_list_from_storage(service, limit: int) -> dict:
    """Object Storage에서 직접 사진 목록 조회 (fallback)"""
    try:
        print(f"📦 Object Storage에서 사진 목록 조회 중...")
        files = service.list_photos_from_storage(limit)

        formatted_photos = []
        for file_info in files[:limit]:
            photo = {
                "id": file_info.get('name', '').replace('.jpg', '').replace('photos/', ''),
                "filename": file_info.get('name', ''),
                "description": "",  # Object Storage에는 설명이 없음
                "file_url": file_info.get('url', ''),
                "thumbnail_urls": {},  # 썸네일은 별도 조회 필요
                "file_size": file_info.get('size', 0),
                "content_type": "image/jpeg",
                "upload_timestamp": file_info.get('last_modified', ''),
                "location": None,
                "exif_data": {}
            }
            formatted_photos.append(photo)

        response_data = {
            "photos": formatted_photos,
            "count": len(formatted_photos),
            "total": len(formatted_photos),
            "has_more": len(files) > limit
        }

        return create_api_response(200, response_data, "사진 목록 조회 성공 (Object Storage)")

    except Exception as e:
        print(f"❌ Object Storage 조회 실패: {e}")
        return create_api_response(500, None, f"Object Storage 조회 실패: {str(e)}")


def delete_photo(photo_id: str) -> dict:
    """
    사진 삭제 API 함수
    데이터베이스 메타데이터와 Object Storage의 파일들(원본 + 썸네일)을 모두 삭제

    Args:
        photo_id: 삭제할 사진의 ID

    Returns:
        dict: 삭제 성공/실패 결과
    """
    try:
        print(f"🗑️ 사진 삭제 시작: {photo_id}")
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 1. 데이터베이스에서 사진 메타데이터 조회 (삭제 전에 썸네일 정보 확인용)
        photo_metadata = None
        if hasattr(service, 'db_client') and service.db_client:
            try:
                photo_metadata = service.db_client.get_photo_metadata(photo_id)
                if not photo_metadata:
                    return {
                        'success': False,
                        'message': f'사진을 찾을 수 없습니다: {photo_id}'
                    }
                print(f"📋 사진 메타데이터 확인: {photo_metadata.get('filename', '')}")
            except Exception as e:
                print(f"⚠️ 메타데이터 조회 실패: {e}")

        # 2. Object Storage에서 파일 삭제
        deletion_results = []

        # 원본 사진 삭제
        original_key = f"photos/{photo_id}.jpg"
        try:
            delete_result = service.storage.delete_file(original_key)
            if delete_result:
                print(f"✅ 원본 사진 삭제 성공: {original_key}")
                deletion_results.append(f"원본: {original_key}")
            else:
                print(f"⚠️ 원본 사진 삭제 실패: {original_key}")
        except Exception as e:
            print(f"❌ 원본 사진 삭제 중 오류: {e}")

        # 썸네일들 삭제
        thumbnail_sizes = ['small', 'medium', 'large']
        for size in thumbnail_sizes:
            thumbnail_key = f"thumbnails/{photo_id}_{size}.jpg"
            try:
                delete_result = service.storage.delete_file(thumbnail_key)
                if delete_result:
                    print(f"✅ 썸네일 삭제 성공: {thumbnail_key}")
                    deletion_results.append(f"썸네일 {size}: {thumbnail_key}")
                else:
                    print(f"⚠️ 썸네일 삭제 실패 (무시): {thumbnail_key}")
            except Exception as e:
                print(f"⚠️ 썸네일 삭제 중 오류 (무시): {thumbnail_key} - {e}")

        # 3. 데이터베이스에서 메타데이터 삭제
        if hasattr(service, 'db_client') and service.db_client:
            try:
                db_delete_result = service.db_client.delete_photo_metadata(photo_id)
                if db_delete_result.get('success', False):
                    print(f"✅ 데이터베이스 메타데이터 삭제 성공: {photo_id}")
                    deletion_results.append(f"메타데이터: 데이터베이스")
                else:
                    print(f"❌ 데이터베이스 메타데이터 삭제 실패: {db_delete_result.get('error', 'Unknown error')}")
                    return {
                        'success': False,
                        'message': f'메타데이터 삭제 실패: {db_delete_result.get("error", "Unknown error")}'
                    }
            except Exception as e:
                print(f"❌ 데이터베이스 삭제 중 오류: {e}")
                return {
                    'success': False,
                    'message': f'메타데이터 삭제 중 오류: {str(e)}'
                }

        print(f"🎉 사진 삭제 완료: {photo_id}")
        print(f"   삭제된 항목들: {', '.join(deletion_results)}")

        return {
            'success': True,
            'message': f'사진이 성공적으로 삭제되었습니다',
            'photo_id': photo_id,
            'deleted_items': deletion_results
        }

    except Exception as e:
        print(f"❌ 사진 삭제 중 예상치 못한 오류: {str(e)}")
        return {
            'success': False,
            'message': f'삭제 중 오류가 발생했습니다: {str(e)}'
        }


def get_photo_stats() -> dict:
    """
    사진 통계 조회 API 함수

    Returns:
        dict: 전체 사진 통계 정보
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 데이터베이스 클라이언트가 있는 경우 데이터베이스에서 통계 조회
        if hasattr(service, 'db_client') and service.db_client:
            print("📊 데이터베이스에서 사진 통계 조회 중...")
            result = service.db_client.get_stats()

            if result['success']:
                stats = result['stats']
                print(f"✅ 통계 조회 성공:")
                print(f"   총 사진: {stats['total_photos']}장")
                print(f"   위치 정보: {stats['photos_with_location']}장 ({stats['location_percentage']}%)")
                print(f"   설명 있음: {stats['photos_with_description']}장 ({stats['description_percentage']}%)")
                print(f"   이번 달: {stats['this_month_photos']}장")
                print(f"   총 용량: {stats['total_size']} bytes")

                return create_api_response(200, stats, "통계 조회 성공")
            else:
                return create_api_response(500, None, f"통계 조회 실패: {result.get('error')}")
        else:
            return create_api_response(500, None, "데이터베이스 클라이언트를 사용할 수 없습니다")

    except Exception as e:
        print(f"❌ 통계 조회 중 오류: {str(e)}")
        return create_api_response(500, None, f"통계 조회 중 오류: {str(e)}")


def get_photos_by_location() -> dict:
    """
    지역별 사진 분포 조회 API 함수

    Returns:
        dict: 지역별 사진 개수 및 분포 정보
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 데이터베이스 클라이언트가 있는 경우 데이터베이스에서 지역별 분포 조회
        if hasattr(service, 'db_client') and service.db_client:
            print("🌍 데이터베이스에서 지역별 사진 분포 조회 중...")
            result = service.db_client.get_photos_by_location()

            if result['success']:
                distribution = result['distribution']
                print(f"✅ 지역별 분포 조회 성공: {len(distribution)}개 지역")

                # 로그로 분포 정보 출력
                for location_data in distribution:
                    location_name = location_data.get('location_name', '위치 정보 없음')
                    count = location_data.get('photo_count', 0)
                    print(f"   {location_name}: {count}장")

                return create_api_response(200, {
                    'distribution': distribution,
                    'total_locations': len(distribution),
                    'total_photos_with_location': sum(item.get('photo_count', 0) for item in distribution)
                }, "지역별 분포 조회 성공")
            else:
                return create_api_response(500, None, f"지역별 분포 조회 실패: {result.get('error')}")
        else:
            return create_api_response(500, None, "데이터베이스 클라이언트를 사용할 수 없습니다")

    except Exception as e:
        print(f"❌ 지역별 분포 조회 중 오류: {str(e)}")
        return create_api_response(500, None, f"지역별 분포 조회 중 오류: {str(e)}")


def get_photos_by_date() -> dict:
    """
    년도별/월별 사진 통계 조회 API 함수

    Returns:
        dict: 년도별, 월별 사진 통계 정보
    """
    try:
        storage_type = os.getenv('STORAGE_TYPE', 'OCI')
        service = UnifiedStorageService(storage_type)

        # 데이터베이스 클라이언트가 있는 경우 데이터베이스에서 날짜별 통계 조회
        if hasattr(service, 'db_client') and service.db_client:
            print("📅 데이터베이스에서 년도별/월별 사진 통계 조회 중...")
            result = service.db_client.get_photos_by_date()

            if result['success']:
                yearly_stats = result.get('yearly_stats', [])
                monthly_stats = result.get('monthly_stats', [])
                print(f"✅ 날짜별 통계 조회 성공:")
                print(f"   년도별 통계: {len(yearly_stats)}개 년도")
                print(f"   월별 통계: {len(monthly_stats)}개 월")

                # 로그로 년도별 통계 출력
                for year_data in yearly_stats:
                    year = year_data.get('year', 'Unknown')
                    count = year_data.get('photo_count', 0)
                    print(f"   {year}년: {count}장")

                return create_api_response(200, {
                    'yearly_stats': yearly_stats,
                    'monthly_stats': monthly_stats
                }, "년도별/월별 통계 조회 성공")
            else:
                return create_api_response(500, None, f"날짜별 통계 조회 실패: {result.get('error')}")
        else:
            return create_api_response(500, None, "데이터베이스 클라이언트를 사용할 수 없습니다")

    except Exception as e:
        print(f"❌ 날짜별 통계 조회 중 오류: {str(e)}")
        return create_api_response(500, None, f"날짜별 통계 조회 중 오류: {str(e)}")


if __name__ == "__main__":
    main_test()