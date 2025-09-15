#!/usr/bin/env python3
"""
OCI photolog-storage 버킷 생성 스크립트
"""
import os
import sys

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    import oci
except ImportError as e:
    print(f"❌ 모듈 import 실패: {e}")
    sys.exit(1)

def create_photolog_bucket():
    """photolog-storage 버킷 생성"""
    try:
        # OCI 설정 로드
        config = oci.config.from_file()
        print("✅ OCI 설정 로드 성공")

        # Object Storage 클라이언트 생성
        object_storage = oci.object_storage.ObjectStorageClient(config)

        # 네임스페이스 조회
        namespace_response = object_storage.get_namespace()
        namespace = namespace_response.data
        print(f"✅ 네임스페이스: {namespace}")

        # Compartment ID (tenancy OCID 사용)
        compartment_id = config['tenancy']

        bucket_name = "photolog-storage"

        print(f"\n🔧 '{bucket_name}' 버킷 생성 중...")

        # 버킷 생성 요청
        create_bucket_details = oci.object_storage.models.CreateBucketDetails(
            name=bucket_name,
            compartment_id=compartment_id,
            public_access_type="NoPublicAccess",  # 보안을 위해 private으로 시작
            storage_tier="Standard"
        )

        bucket_response = object_storage.create_bucket(
            namespace_name=namespace,
            create_bucket_details=create_bucket_details
        )

        print(f"✅ 버킷 '{bucket_name}' 생성 성공!")
        print(f"   - ETag: {bucket_response.headers.get('etag')}")
        print(f"   - Namespace: {namespace}")
        print(f"   - Public Access: NoPublicAccess")
        print(f"   - Storage Tier: Standard")

        return True

    except oci.exceptions.ServiceError as e:
        if e.status == 409:  # Conflict - bucket already exists
            print(f"✅ 버킷 '{bucket_name}'이 이미 존재합니다.")
            return True
        else:
            print(f"❌ 버킷 생성 실패: {e}")
            return False
    except Exception as e:
        print(f"❌ 예상치 못한 오류: {e}")
        return False

def main():
    """메인 실행"""
    print("🚀 photolog-storage 버킷 생성 스크립트 시작\n")

    if create_photolog_bucket():
        print("\n🎉 버킷 생성 완료!")
        print("💡 이제 OCI Object Storage 연동 테스트를 실행할 수 있습니다.")
        print("   실행: cd backend/tests && python3 test_oci_connection.py")
        return True
    else:
        print("\n❌ 버킷 생성에 실패했습니다.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)