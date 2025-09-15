#!/usr/bin/env python3
"""
로컬 테스트 스크립트
OCI Functions 환경을 시뮬레이션하여 사진 업로드 API 테스트
"""
import sys
import os
import json
import base64
import io
from unittest.mock import Mock, patch

# 백엔드 모듈 경로 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '../shared'))
sys.path.append(os.path.join(os.path.dirname(__file__), '../functions/photo-upload'))

# 테스트용 환경 변수 설정
os.environ.update({
    'OCI_NAMESPACE': 'test-namespace',
    'OCI_BUCKET_NAME': 'test-bucket',
    'OCI_REGION': 'ap-seoul-1',
    'NOSQL_COMPARTMENT_ID': 'test-compartment',
    'NOSQL_TABLE_NAME': 'photos',
    'MAX_FILE_SIZE': '52428800'  # 50MB
})

def create_test_image_b64():
    """테스트용 작은 이미지 Base64 데이터 생성"""
    # 1x1 픽셀 JPEG 이미지 (최소 크기)
    jpeg_data = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9'
    return base64.b64encode(jpeg_data).decode('utf-8')

def create_mock_context():
    """OCI Functions 컨텍스트 모의 객체 생성"""
    mock_ctx = Mock()
    mock_ctx.Method.return_value = 'POST'
    return mock_ctx

def mock_oci_services():
    """OCI 서비스 모의 객체 설정"""

    # Object Storage 모의
    class MockObjectStorageClient:
        def upload_file(self, file_content, object_name, content_type=None, metadata=None):
            return {
                "success": True,
                "object_name": object_name,
                "url": f"https://mock-storage.com/{object_name}",
                "etag": "mock-etag-123",
                "size": len(file_content)
            }

        def delete_file(self, object_name):
            return True

    # NoSQL 모의
    class MockNoSQLClient:
        def insert_photo_metadata(self, photo_data):
            return {
                "success": True,
                "photo_id": photo_data["id"],
                "query_result": {"status": "success"}
            }

    return MockObjectStorageClient, MockNoSQLClient

def test_photo_upload_success():
    """성공적인 사진 업로드 테스트"""
    print("🧪 테스트 1: 성공적인 사진 업로드")

    # 테스트 데이터 준비
    test_data = {
        "filename": "test-photo.jpg",
        "file_data": create_test_image_b64(),
        "content_type": "image/jpeg",
        "description": "테스트 사진입니다"
    }

    # 모의 객체 설정
    MockObjectStorage, MockNoSQL = mock_oci_services()

    with patch('oci_client.OCIObjectStorageClient', MockObjectStorage), \
         patch('oci_client.OCINoSQLClient', MockNoSQL):

        # 함수 import (모의 객체 설정 후)
        from func import handler

        # 테스트 실행
        mock_ctx = create_mock_context()
        test_body = json.dumps(test_data).encode('utf-8')
        test_io = io.BytesIO(test_body)

        result = handler(mock_ctx, test_io)

        # 결과 검증
        if result and 'body' in result:
            response_data = json.loads(result['body'])

            print(f"✅ 상태 코드: {result['statusCode']}")
            print(f"✅ 성공 여부: {response_data['success']}")
            print(f"✅ 메시지: {response_data['message']}")

            if response_data['success'] and response_data.get('data'):
                data = response_data['data']
                print(f"✅ 사진 ID: {data.get('photo_id', 'N/A')}")
                print(f"✅ 파일 URL: {data.get('file_url', 'N/A')}")
                print(f"✅ 파일 크기: {data.get('file_size', 'N/A')} bytes")

            return response_data['success']
        else:
            print("❌ 응답 형식 오류")
            return False

def test_photo_upload_missing_fields():
    """필수 필드 누락 테스트"""
    print("\n🧪 테스트 2: 필수 필드 누락")

    # 불완전한 테스트 데이터
    test_data = {
        "filename": "test-photo.jpg"
        # file_data와 content_type 누락
    }

    MockObjectStorage, MockNoSQL = mock_oci_services()

    with patch('oci_client.OCIObjectStorageClient', MockObjectStorage), \
         patch('oci_client.OCINoSQLClient', MockNoSQL):

        from func import handler

        mock_ctx = create_mock_context()
        test_body = json.dumps(test_data).encode('utf-8')
        test_io = io.BytesIO(test_body)

        result = handler(mock_ctx, test_io)

        if result and 'body' in result:
            response_data = json.loads(result['body'])

            print(f"✅ 상태 코드: {result['statusCode']}")
            print(f"✅ 성공 여부: {response_data['success']}")
            print(f"✅ 에러 메시지: {response_data['message']}")

            # 400 에러가 나와야 정상
            return result['statusCode'] == 400 and not response_data['success']
        else:
            print("❌ 응답 형식 오류")
            return False

def test_photo_upload_invalid_json():
    """잘못된 JSON 형식 테스트"""
    print("\n🧪 테스트 3: 잘못된 JSON 형식")

    MockObjectStorage, MockNoSQL = mock_oci_services()

    with patch('oci_client.OCIObjectStorageClient', MockObjectStorage), \
         patch('oci_client.OCINoSQLClient', MockNoSQL):

        from func import handler

        mock_ctx = create_mock_context()
        # 잘못된 JSON
        test_body = b'{"invalid": json data'
        test_io = io.BytesIO(test_body)

        result = handler(mock_ctx, test_io)

        if result and 'body' in result:
            response_data = json.loads(result['body'])

            print(f"✅ 상태 코드: {result['statusCode']}")
            print(f"✅ 성공 여부: {response_data['success']}")
            print(f"✅ 에러 메시지: {response_data['message']}")

            return result['statusCode'] == 400 and not response_data['success']
        else:
            print("❌ 응답 형식 오류")
            return False

def test_cors_preflight():
    """CORS preflight 요청 테스트"""
    print("\n🧪 테스트 4: CORS preflight 요청")

    MockObjectStorage, MockNoSQL = mock_oci_services()

    with patch('oci_client.OCIObjectStorageClient', MockObjectStorage), \
         patch('oci_client.OCINoSQLClient', MockNoSQL):

        from func import handler

        # OPTIONS 요청 모의
        mock_ctx = create_mock_context()
        mock_ctx.Method.return_value = 'OPTIONS'

        test_io = io.BytesIO(b'')

        result = handler(mock_ctx, test_io)

        if result and 'headers' in result:
            headers = result['headers']

            print(f"✅ 상태 코드: {result['statusCode']}")
            print(f"✅ CORS 헤더: {headers.get('Access-Control-Allow-Origin', 'N/A')}")
            print(f"✅ 허용 메서드: {headers.get('Access-Control-Allow-Methods', 'N/A')}")

            return (result['statusCode'] == 200 and
                   headers.get('Access-Control-Allow-Origin') == '*')
        else:
            print("❌ 응답 형식 오류")
            return False

def main():
    """메인 테스트 실행"""
    print("=" * 60)
    print("🚀 포토로그 사진 업로드 API 로컬 테스트")
    print("=" * 60)

    tests = [
        test_photo_upload_success,
        test_photo_upload_missing_fields,
        test_photo_upload_invalid_json,
        test_cors_preflight
    ]

    passed = 0
    total = len(tests)

    for test_func in tests:
        try:
            if test_func():
                passed += 1
                print("✅ 테스트 통과\n")
            else:
                print("❌ 테스트 실패\n")
        except Exception as e:
            print(f"❌ 테스트 오류: {str(e)}\n")

    print("=" * 60)
    print(f"📊 테스트 결과: {passed}/{total} 통과")

    if passed == total:
        print("🎉 모든 테스트가 성공했습니다!")
    else:
        print("⚠️  일부 테스트가 실패했습니다. 코드를 확인해보세요.")

    print("=" * 60)

if __name__ == "__main__":
    main()