#!/usr/bin/env python3
"""
통합 스토리지 서비스 테스트 스크립트
로컬 및 OCI 스토리지 전환 테스트
"""
import os
import sys
import json
from datetime import datetime

# 상위 디렉토리를 Python 경로에 추가
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from shared.storage_service import (
        UnifiedStorageService,
        LocalStorageService,
        get_default_storage
    )
except ImportError as e:
    print(f"❌ 모듈 import 실패: {e}")
    sys.exit(1)

def create_test_image_data():
    """테스트용 이미지 데이터 생성"""
    # 간단한 바이너리 데이터로 이미지 시뮬레이션
    return b"FAKE_IMAGE_DATA_FOR_TESTING" + os.urandom(1024)

def create_test_thumbnails():
    """테스트용 썸네일 데이터 생성"""
    return {
        "small": {
            "data": b"SMALL_THUMBNAIL" + os.urandom(200),
            "width": 150,
            "height": 150
        },
        "medium": {
            "data": b"MEDIUM_THUMBNAIL" + os.urandom(400),
            "width": 400,
            "height": 400
        },
        "large": {
            "data": b"LARGE_THUMBNAIL" + os.urandom(800),
            "width": 800,
            "height": 600
        }
    }

def test_local_storage():
    """로컬 스토리지 테스트"""
    print("🔍 로컬 스토리지 테스트...")

    try:
        # 로컬 스토리지 서비스 생성
        storage = UnifiedStorageService("LOCAL")

        print(f"✅ 스토리지 타입: {storage.get_storage_info()}")

        # 테스트 데이터 준비
        photo_id = f"test_photo_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        file_content = create_test_image_data()
        thumbnails = create_test_thumbnails()

        metadata = {
            "description": "테스트 사진",
            "camera": "Test Camera",
            "location": "Test Location"
        }

        # 사진 업로드 테스트
        print(f"📤 사진 업로드 테스트 (ID: {photo_id})...")
        upload_result = storage.upload_photo(
            file_content=file_content,
            photo_id=photo_id,
            file_extension=".jpg",
            thumbnails=thumbnails,
            metadata=metadata
        )

        if upload_result["success"]:
            print("✅ 업로드 성공!")
            print(f"   - 파일 URL: {upload_result['file_url']}")
            print(f"   - 썸네일 URLs: {len(upload_result['thumbnail_urls'])}개")
            for size, url in upload_result['thumbnail_urls'].items():
                print(f"     {size}: {url}")
        else:
            print(f"❌ 업로드 실패: {upload_result['error']}")
            return False

        # 파일 목록 조회 테스트
        print("\n📋 파일 목록 조회 테스트...")
        photo_list = storage.list_photos()
        print(f"✅ 사진 목록 조회: {len(photo_list)}개 발견")

        # 업로드한 파일 찾기
        uploaded_photo = None
        for photo in photo_list:
            if photo_id in photo['object_name']:
                uploaded_photo = photo
                break

        if uploaded_photo:
            print(f"✅ 업로드한 사진 확인: {uploaded_photo['object_name']}")
        else:
            print("⚠️  업로드한 사진을 목록에서 찾을 수 없음")

        # 파일 삭제 테스트
        print(f"\n🗑️  파일 삭제 테스트...")
        delete_result = storage.delete_photo(photo_id, ".jpg")

        if delete_result:
            print("✅ 파일 삭제 성공")
        else:
            print("⚠️  파일 삭제 실패 (파일이 없거나 권한 문제)")

        return True

    except Exception as e:
        print(f"❌ 로컬 스토리지 테스트 실패: {str(e)}")
        return False

def test_storage_switching():
    """스토리지 전환 테스트"""
    print("\n🔄 스토리지 전환 테스트...")

    try:
        # 환경변수 변경으로 스토리지 전환 테스트
        original_storage_type = os.getenv('STORAGE_TYPE', 'LOCAL')

        # LOCAL 스토리지 테스트
        os.environ['STORAGE_TYPE'] = 'LOCAL'
        local_storage = get_default_storage()
        local_info = local_storage.get_storage_info()
        print(f"✅ LOCAL 스토리지: {local_info}")

        # OCI 스토리지 테스트 (fallback to LOCAL expected)
        os.environ['STORAGE_TYPE'] = 'OCI'
        oci_storage = get_default_storage()
        oci_info = oci_storage.get_storage_info()
        print(f"✅ OCI 스토리지 (fallback): {oci_info}")

        # 원래 설정 복원
        os.environ['STORAGE_TYPE'] = original_storage_type

        return True

    except Exception as e:
        print(f"❌ 스토리지 전환 테스트 실패: {str(e)}")
        return False

def test_api_compatibility():
    """API 호환성 테스트"""
    print("\n🔌 API 호환성 테스트...")

    try:
        storage = get_default_storage()

        # 기본 인터페이스 메서드 확인
        methods_to_check = [
            'upload_photo',
            'delete_photo',
            'list_photos',
            'get_storage_info'
        ]

        for method_name in methods_to_check:
            if hasattr(storage, method_name):
                print(f"✅ {method_name} 메서드 존재")
            else:
                print(f"❌ {method_name} 메서드 없음")
                return False

        return True

    except Exception as e:
        print(f"❌ API 호환성 테스트 실패: {str(e)}")
        return False

def main():
    """메인 테스트 실행"""
    print("🚀 통합 스토리지 서비스 테스트 시작\n")

    tests = [
        ("로컬 스토리지", test_local_storage),
        ("스토리지 전환", test_storage_switching),
        ("API 호환성", test_api_compatibility)
    ]

    success_count = 0
    for test_name, test_func in tests:
        print(f"{'='*50}")
        print(f"테스트: {test_name}")
        print(f"{'='*50}")

        if test_func():
            success_count += 1
            print(f"✅ {test_name} 테스트 성공\n")
        else:
            print(f"❌ {test_name} 테스트 실패\n")

    # 결과 출력
    print(f"{'='*50}")
    print(f"📊 테스트 결과: {success_count}/{len(tests)} 성공")

    if success_count == len(tests):
        print("🎉 모든 테스트 통과! 스토리지 추상화 레이어 준비 완료.")
        return True
    else:
        print("❌ 일부 테스트 실패. 코드를 확인해주세요.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)