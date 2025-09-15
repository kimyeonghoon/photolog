"""
썸네일 생성 자동화 함수
사진 업로드 시 자동으로 여러 크기의 썸네일을 생성하는 OCI Functions
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
    create_api_response,
    get_current_timestamp
)
from oci_client import OCIObjectStorageClient
from thumbnail_generator import ThumbnailGenerator

def handler(ctx, data: io.BytesIO = None):
    """
    썸네일 생성 핸들러 함수

    Args:
        ctx: OCI Functions 컨텍스트
        data: 요청 데이터

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
            return create_api_response(200, message="CORS preflight")

        if method != 'POST':
            return create_api_response(405, message="Method not allowed")

        # 필수 필드 검증
        required_fields = ['photo_id', 'file_data', 'content_type']
        missing_fields = [field for field in required_fields if field not in request_data]

        if missing_fields:
            return create_api_response(
                400,
                message=f"Missing required fields: {missing_fields}"
            )

        # 요청 데이터 추출
        photo_id = request_data['photo_id']
        file_data_b64 = request_data['file_data']
        content_type = request_data['content_type']
        sizes = request_data.get('sizes', None)  # 특정 크기 요청 시

        # Base64 디코딩
        try:
            if file_data_b64.startswith('data:'):
                header, file_data_b64 = file_data_b64.split(',', 1)

            file_content = base64.b64decode(file_data_b64)
        except Exception as e:
            return create_api_response(400, message=f"Invalid file data: {str(e)}")

        # 이미지 포맷 검증
        generator = ThumbnailGenerator()
        is_valid, format_info = generator.validate_image_format(file_content)

        if not is_valid:
            return create_api_response(400, message=f"Invalid image format: {format_info}")

        # 썸네일 생성 모드 결정
        if sizes:
            # 특정 크기 요청
            thumbnails = {}
            for size_config in sizes:
                name = size_config['name']
                width = size_config['width']
                height = size_config['height']
                smart_crop = size_config.get('smart_crop', False)

                try:
                    if smart_crop:
                        thumbnail_data = generator.create_smart_crop_thumbnail(
                            file_content, width, height
                        )
                    else:
                        # 임시 설정으로 단일 썸네일 생성
                        generator.thumbnail_sizes = [size_config]
                        result = generator.create_thumbnails(file_content)
                        thumbnail_data = result[name]

                    thumbnails[name] = thumbnail_data

                except Exception as e:
                    print(f"Failed to create thumbnail {name}: {str(e)}")
                    continue
        else:
            # 기본 크기들로 생성
            thumbnails = generator.create_thumbnails(file_content)

        if not thumbnails:
            return create_api_response(500, message="Failed to create any thumbnails")

        # Object Storage에 썸네일 업로드
        storage_client = OCIObjectStorageClient()
        uploaded_thumbnails = {}
        upload_errors = []

        for size_name, thumbnail_info in thumbnails.items():
            try:
                # 썸네일 객체명 생성
                object_name = f"thumbnails/{photo_id}_{size_name}.jpg"

                # 업로드
                upload_result = storage_client.upload_file(
                    file_content=thumbnail_info['data'],
                    object_name=object_name,
                    content_type='image/jpeg',
                    metadata={
                        'photo_id': photo_id,
                        'thumbnail_size': size_name,
                        'original_width': str(thumbnail_info['width']),
                        'original_height': str(thumbnail_info['height']),
                        'generated_at': get_current_timestamp()
                    }
                )

                if upload_result['success']:
                    uploaded_thumbnails[size_name] = {
                        'url': upload_result['url'],
                        'width': thumbnail_info['width'],
                        'height': thumbnail_info['height'],
                        'size': thumbnail_info['size'],
                        'object_name': object_name
                    }
                else:
                    upload_errors.append(f"{size_name}: {upload_result.get('error', 'Upload failed')}")

            except Exception as e:
                upload_errors.append(f"{size_name}: {str(e)}")

        # 결과 처리
        if uploaded_thumbnails:
            # 성공 응답
            response_data = {
                'photo_id': photo_id,
                'thumbnails': uploaded_thumbnails,
                'generated_count': len(uploaded_thumbnails),
                'total_requested': len(thumbnails),
                'errors': upload_errors if upload_errors else None
            }

            status_code = 201 if not upload_errors else 207  # 207: Multi-Status
            message = "Thumbnails generated successfully"

            if upload_errors:
                message += f" (with {len(upload_errors)} errors)"

            return create_api_response(
                status_code,
                data=response_data,
                message=message
            )
        else:
            # 모든 업로드 실패
            return create_api_response(
                500,
                message=f"Failed to upload thumbnails: {'; '.join(upload_errors)}"
            )

    except json.JSONDecodeError:
        return create_api_response(400, message="Invalid JSON format")

    except Exception as e:
        # 에러 로깅
        print(f"Unexpected error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")

        return create_api_response(
            500,
            message="Internal server error"
        )

def main(ctx, data: io.BytesIO = None):
    """OCI Functions 메인 진입점"""
    return handler(ctx, data)