"""
사진 업로드 API 함수
OCI Functions에서 실행되는 메인 핸들러
"""
import io
import json
import base64
import traceback
from typing import Dict, Any
from fdk import response

# 공통 모듈 import
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../../shared'))

from config import Config
from utils import (
    generate_photo_id,
    generate_file_hash,
    get_file_extension,
    validate_image_file,
    extract_exif_data,
    convert_gps_to_decimal,
    create_api_response,
    get_current_timestamp
)
from oci_client import OCIObjectStorageClient, OCINoSQLClient
from thumbnail_generator import ThumbnailGenerator

def handler(ctx, data: io.BytesIO = None):
    """
    사진 업로드 핸들러 함수

    Args:
        ctx: OCI Functions 컨텍스트
        data: 요청 데이터 (HTTP 요청 본문)

    Returns:
        HTTP 응답 (JSON)
    """
    try:
        # 설정 검증
        Config.validate_config()

        # 요청 데이터 파싱
        body = data.getvalue()
        if isinstance(body, bytes):
            body = body.decode('utf-8')

        request_data = json.loads(body) if body else {}

        # HTTP 메서드 확인
        method = ctx.Method() if hasattr(ctx, 'Method') else 'POST'

        if method == 'OPTIONS':
            # CORS preflight 요청 처리
            return create_api_response(200, message="CORS preflight")

        if method != 'POST':
            return create_api_response(405, message="Method not allowed")

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
            file_content, filename, Config.MAX_FILE_SIZE
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
            print("프론트엔드에서 처리된 EXIF 데이터 사용")
        else:
            # 백엔드에서 EXIF 데이터 추출 (fallback)
            exif_data = extract_exif_data(file_content)
            print("백엔드에서 EXIF 데이터 추출")

        # 위치 정보 처리
        if frontend_location:
            # 프론트엔드에서 처리된 위치 정보 사용
            location = frontend_location
            print("프론트엔드에서 처리된 위치 정보 사용:", location)
        elif 'GPSInfo' in exif_data:
            # 백엔드에서 GPS 좌표 처리 (fallback)
            gps_coords = convert_gps_to_decimal(exif_data['GPSInfo'])
            if gps_coords:
                location = {
                    'latitude': gps_coords[0],
                    'longitude': gps_coords[1]
                }
                print("백엔드에서 GPS 좌표 처리:", location)
            else:
                location = None
        else:
            location = None

        # Object Storage에 업로드
        storage_client = OCIObjectStorageClient()
        upload_result = storage_client.upload_file(
            file_content=file_content,
            object_name=object_name,
            content_type=content_type,
            metadata={
                'photo_id': photo_id,
                'original_filename': filename,
                'file_hash': file_hash
            }
        )

        if not upload_result['success']:
            return create_api_response(
                500,
                message=f"File upload failed: {upload_result['error']}"
            )

        # 썸네일 처리
        thumbnail_urls = {}

        if frontend_thumbnails:
            # 프론트엔드에서 생성된 썸네일 업로드
            print("프론트엔드에서 생성된 썸네일 사용")
            try:
                for size_name, thumbnail_b64 in frontend_thumbnails.items():
                    if thumbnail_b64:
                        # Base64 디코딩
                        thumbnail_data = base64.b64decode(thumbnail_b64)
                        thumbnail_object_name = f"thumbnails/{photo_id}_{size_name}.jpg"

                        thumbnail_upload_result = storage_client.upload_file(
                            file_content=thumbnail_data,
                            object_name=thumbnail_object_name,
                            content_type='image/jpeg',
                            metadata={
                                'photo_id': photo_id,
                                'thumbnail_size': size_name,
                                'generated_by': 'frontend'
                            }
                        )

                        if thumbnail_upload_result['success']:
                            thumbnail_urls[size_name] = thumbnail_upload_result['url']
                            print(f"Frontend thumbnail {size_name} uploaded successfully")
                        else:
                            print(f"Frontend thumbnail upload failed for {size_name}: {thumbnail_upload_result.get('error')}")

            except Exception as e:
                print(f"Frontend thumbnail processing failed: {str(e)}")
                # 프론트엔드 썸네일 실패 시 백엔드에서 생성
                frontend_thumbnails = {}

        # 프론트엔드 썸네일이 없거나 실패한 경우 백엔드에서 생성
        if not frontend_thumbnails:
            print("백엔드에서 썸네일 생성")
            try:
                thumbnail_generator = ThumbnailGenerator()
                thumbnails = thumbnail_generator.create_thumbnails(file_content)

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
                        print(f"Backend thumbnail {size_name} uploaded successfully")
                    else:
                        print(f"Backend thumbnail upload failed for {size_name}: {thumbnail_upload_result.get('error')}")

            except Exception as e:
                print(f"Backend thumbnail generation failed: {str(e)}")
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

        # NoSQL DB에 메타데이터 저장
        nosql_client = OCINoSQLClient()
        db_result = nosql_client.insert_photo_metadata(photo_metadata)

        if not db_result['success']:
            # 업로드된 파일 삭제 (롤백)
            storage_client.delete_file(object_name)
            return create_api_response(
                500,
                message=f"Database save failed: {db_result['error']}"
            )

        # 성공 응답
        response_data = {
            'photo_id': photo_id,
            'filename': filename,
            'file_url': upload_result['url'],
            'thumbnail_urls': thumbnail_urls,  # 썸네일 URL들 추가
            'file_size': len(file_content),
            'location': location,
            'exif_data': {
                'camera': exif_data.get('Make', '') + ' ' + exif_data.get('Model', ''),
                'datetime': exif_data.get('DateTime', ''),
                'orientation': exif_data.get('Orientation', 1)
            },
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
        # 에러 로깅 (실제 환경에서는 OCI Logging 사용)
        print(f"Unexpected error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")

        return create_api_response(
            500,
            message="Internal server error"
        )

# OCI Functions 진입점
def main(ctx, data: io.BytesIO = None):
    """OCI Functions 메인 진입점"""
    return handler(ctx, data)