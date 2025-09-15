#!/usr/bin/env python3
"""
OCI 버킷 리스트 조회 스크립트
"""
import os
import sys

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    import oci
    from shared.config import Config
except ImportError as e:
    print(f"❌ 모듈 import 실패: {e}")
    sys.exit(1)

def list_buckets():
    """버킷 목록 조회"""
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
        print(f"✅ Compartment ID: {compartment_id[:30]}...")

        # 버킷 목록 조회
        print("\n🔍 버킷 목록 조회 중...")
        buckets_response = object_storage.list_buckets(
            namespace_name=namespace,
            compartment_id=compartment_id
        )

        buckets = buckets_response.data
        print(f"✅ 버킷 조회 성공: {len(buckets)}개 발견")

        if buckets:
            print("\n📦 기존 버킷 목록:")
            for i, bucket in enumerate(buckets, 1):
                print(f"   {i}. {bucket.name}")
                print(f"      - Created: {bucket.time_created}")
                print(f"      - Public Access: {bucket.public_access_type}")
                print(f"      - Storage Tier: {bucket.storage_tier}")
                print()
        else:
            print("\n📦 버킷이 없습니다. photolog-storage 버킷을 생성해야 합니다.")

        return True, namespace, compartment_id, buckets

    except Exception as e:
        print(f"❌ 버킷 조회 실패: {e}")
        return False, None, None, None

def create_bucket_if_needed(namespace, compartment_id):
    """필요한 경우 photolog-storage 버킷 생성"""
    try:
        config = oci.config.from_file()
        object_storage = oci.object_storage.ObjectStorageClient(config)

        bucket_name = "photolog-storage"

        print(f"\n🔧 '{bucket_name}' 버킷 생성 중...")

        # 버킷 생성 요청
        create_bucket_details = oci.object_storage.models.CreateBucketDetails(
            name=bucket_name,
            compartment_id=compartment_id,
            public_access_type="NoPublicAccess",  # 또는 "ObjectRead" for public
            storage_tier="Standard"
        )

        bucket_response = object_storage.create_bucket(
            namespace_name=namespace,
            create_bucket_details=create_bucket_details
        )

        print(f"✅ 버킷 '{bucket_name}' 생성 성공!")
        print(f"   - ETag: {bucket_response.headers.get('etag')}")

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
    print("🚀 OCI 버킷 관리 스크립트 시작\n")

    # 버킷 리스트 조회
    success, namespace, compartment_id, buckets = list_buckets()

    if not success:
        print("❌ 버킷 조회에 실패했습니다.")
        return False

    # photolog-storage 버킷이 있는지 확인
    bucket_names = [bucket.name for bucket in buckets] if buckets else []

    if "photolog-storage" not in bucket_names:
        print(f"\n⚠️  'photolog-storage' 버킷이 없습니다.")

        # 사용자 확인
        response = input("버킷을 생성하시겠습니까? (y/N): ").lower().strip()

        if response in ['y', 'yes']:
            if create_bucket_if_needed(namespace, compartment_id):
                print("\n🎉 버킷 생성 완료! 이제 OCI 연동 테스트를 다시 실행할 수 있습니다.")
            else:
                print("\n❌ 버킷 생성에 실패했습니다.")
                return False
        else:
            print("\n💡 수동으로 OCI 콘솔에서 'photolog-storage' 버킷을 생성해주세요.")
    else:
        print(f"\n✅ 'photolog-storage' 버킷이 이미 존재합니다!")

    return True

if __name__ == "__main__":
    main()