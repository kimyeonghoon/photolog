#!/usr/bin/env python3
"""
OCI 연결 테스트 스크립트
OCI 계정 설정이 올바른지 검증
"""
import os
import sys
import json

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    import oci
    from shared.config import Config
    from shared.oci_client import OCIObjectStorageClient
except ImportError as e:
    print(f"❌ 모듈 import 실패: {e}")
    print("pip install oci 를 실행하거나 가상환경을 확인해주세요.")
    sys.exit(1)

def test_oci_config():
    """OCI 설정 파일 테스트"""
    print("🔍 OCI 설정 파일 테스트...")

    try:
        config = oci.config.from_file()
        print("✅ OCI 설정 파일 로드 성공")
        print(f"   - User: {config.get('user', 'N/A')[:20]}...")
        print(f"   - Tenancy: {config.get('tenancy', 'N/A')[:20]}...")
        print(f"   - Region: {config.get('region', 'N/A')}")
        print(f"   - Key file: {config.get('key_file', 'N/A')}")
        return True
    except Exception as e:
        print(f"❌ OCI 설정 파일 오류: {e}")
        print("💡 ~/.oci/config 파일을 확인해주세요.")
        return False

def test_config_validation():
    """환경변수 설정 테스트"""
    print("\n🔍 환경변수 설정 테스트...")

    try:
        Config.validate_config()
        print("✅ 환경변수 설정 유효")
        print(f"   - OCI_NAMESPACE: {Config.OCI_NAMESPACE}")
        print(f"   - OCI_BUCKET_NAME: {Config.OCI_BUCKET_NAME}")
        print(f"   - OCI_REGION: {Config.OCI_REGION}")
        print(f"   - NOSQL_COMPARTMENT_ID: {Config.NOSQL_COMPARTMENT_ID[:20]}...")
        return True
    except Exception as e:
        print(f"❌ 환경변수 설정 오류: {e}")
        print("💡 .env 파일이나 환경변수를 확인해주세요.")
        return False

def test_oci_connection():
    """OCI Object Storage 연결 테스트"""
    print("\n🔍 OCI Object Storage 연결 테스트...")

    try:
        client = OCIObjectStorageClient()

        # 네임스페이스 조회
        namespace_response = client.object_storage.get_namespace()
        namespace = namespace_response.data
        print(f"✅ 네임스페이스 조회 성공: {namespace}")

        # 설정된 네임스페이스와 비교
        if namespace != Config.OCI_NAMESPACE:
            print(f"⚠️  설정된 네임스페이스({Config.OCI_NAMESPACE})와 실제 네임스페이스({namespace})가 다릅니다.")

        return True, namespace
    except Exception as e:
        print(f"❌ OCI 연결 실패: {e}")
        print("💡 API 키, 권한, 네트워크를 확인해주세요.")
        return False, None

def test_bucket_access(namespace):
    """버킷 접근 테스트"""
    print("\n🔍 버킷 접근 테스트...")

    try:
        client = OCIObjectStorageClient()

        # 버킷 목록 조회
        buckets_response = client.object_storage.list_buckets(
            namespace_name=namespace,
            compartment_id=Config.NOSQL_COMPARTMENT_ID
        )

        bucket_names = [bucket.name for bucket in buckets_response.data]
        print(f"✅ 버킷 목록 조회 성공: {len(bucket_names)}개")

        # 설정된 버킷이 존재하는지 확인
        if Config.OCI_BUCKET_NAME in bucket_names:
            print(f"✅ 설정된 버킷 '{Config.OCI_BUCKET_NAME}' 존재 확인")
        else:
            print(f"⚠️  설정된 버킷 '{Config.OCI_BUCKET_NAME}'을 찾을 수 없습니다.")
            print(f"   사용 가능한 버킷: {bucket_names}")
            print("💡 OCI 콘솔에서 버킷을 생성하거나 OCI_BUCKET_NAME을 수정해주세요.")

        return True
    except Exception as e:
        print(f"❌ 버킷 접근 실패: {e}")
        print("💡 Compartment ID, 버킷 권한을 확인해주세요.")
        return False

def test_file_upload():
    """간단한 파일 업로드 테스트"""
    print("\n🔍 파일 업로드 테스트...")

    try:
        client = OCIObjectStorageClient()

        # 테스트 파일 생성
        test_content = b"OCI connection test file"
        test_object_name = "test/connection_test.txt"

        # 업로드 테스트
        result = client.upload_file(
            file_content=test_content,
            object_name=test_object_name,
            content_type="text/plain",
            metadata={"test": "connection_test"}
        )

        if result["success"]:
            print("✅ 파일 업로드 성공")
            print(f"   - Object: {result['object_name']}")
            print(f"   - URL: {result['url']}")
            print(f"   - Size: {result['size']} bytes")

            # 업로드된 파일 삭제 (정리)
            if client.delete_file(test_object_name):
                print("✅ 테스트 파일 삭제 완료")

            return True
        else:
            print(f"❌ 파일 업로드 실패: {result['error']}")
            return False

    except Exception as e:
        print(f"❌ 파일 업로드 테스트 실패: {e}")
        return False

def main():
    """메인 테스트 실행"""
    print("🚀 OCI 연결 테스트 시작\n")

    tests = [
        ("OCI 설정 파일", test_oci_config),
        ("환경변수 설정", test_config_validation),
    ]

    # 기본 테스트 실행
    success_count = 0
    for test_name, test_func in tests:
        if test_func():
            success_count += 1
        else:
            print(f"\n❌ {test_name} 테스트 실패. 설정을 확인한 후 다시 시도해주세요.")
            return False

    # OCI 연결 테스트
    connection_success, namespace = test_oci_connection()
    if connection_success:
        success_count += 1

        # 버킷 테스트
        if test_bucket_access(namespace):
            success_count += 1

            # 파일 업로드 테스트
            if test_file_upload():
                success_count += 1

    # 결과 출력
    print(f"\n📊 테스트 결과: {success_count}/5 성공")

    if success_count == 5:
        print("🎉 모든 테스트 통과! OCI 연동 준비 완료.")
        return True
    else:
        print("❌ 일부 테스트 실패. 설정을 확인해주세요.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)