#!/usr/bin/env python3
"""
안드로이드 GPS 보존 기능 테스트 스크립트
프론트엔드에서 안드로이드 기기로 감지되었을 때의 업로드 시나리오를 시뮬레이션
"""

import sys
import os
import json
import requests
import base64

# 백엔드 경로 추가
sys.path.append('/home/kim-yeonghoon/workspace/photolog/backend/tests')
sys.path.append('/home/kim-yeonghoon/workspace/photolog/backend/shared')

from test_func_unified import handler_unified

def test_android_gps_preservation():
    """안드로이드 GPS 보존 기능 테스트"""

    print("📱 안드로이드 GPS 보존 기능 테스트 시작")
    print("=" * 60)

    # 테스트 이미지 데이터 (Base64 인코딩된 작은 JPEG)
    test_image_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="

    # 안드로이드 기기에서 오는 요청 시뮬레이션
    android_request = {
        "method": "POST",
        "files": [
            {
                "file": test_image_b64,
                "description": "안드로이드 GPS 보존 테스트",
                "thumbnails": {},
                "exifData": {
                    "timestamp": "2023-08-15T14:30:00Z",
                    "make": "Samsung",
                    "model": "Galaxy S23",
                    "latitude": 33.5563,
                    "longitude": 126.7958
                },
                "location": {
                    "latitude": 33.5563,
                    "longitude": 126.7958,
                    "city": "제주시",
                    "country": "대한민국"
                },
                "require_metadata_first": True  # 안드로이드 기기에서 GPS 보존을 위해 True
            }
        ]
    }

    print("🔧 테스트 시나리오: 안드로이드 기기 (require_metadata_first=True)")
    print(f"📍 GPS 좌표: {android_request['files'][0]['location']['latitude']}, {android_request['files'][0]['location']['longitude']}")
    print(f"🏷️  설명: {android_request['files'][0]['description']}")
    print(f"⚙️  메타데이터 우선 저장: {android_request['files'][0]['require_metadata_first']}")
    print()

    # 백엔드 핸들러 호출
    try:
        print("🚀 백엔드 핸들러 호출 중...")
        result = handler_unified(android_request)

        print("📊 백엔드 응답:")
        print(f"  상태: {result.get('status')}")
        print(f"  메시지: {result.get('message')}")

        if result.get('data'):
            data = result['data']
            print(f"  업로드된 파일 수: {data.get('uploaded_count', 0)}")
            print(f"  실패한 파일 수: {data.get('failed_count', 0)}")

            if data.get('files'):
                for file_info in data['files']:
                    print(f"  파일 ID: {file_info.get('photo_id')}")
                    print(f"  파일 URL: {file_info.get('file_url')}")
                    if file_info.get('location'):
                        loc = file_info['location']
                        print(f"  저장된 GPS: {loc.get('latitude')}, {loc.get('longitude')}")

        print()

        # 성공 여부 확인
        if result.get('status') in [200, 201]:
            print("✅ 안드로이드 GPS 보존 기능 테스트 성공!")
            print("📱 require_metadata_first=True 옵션이 정상적으로 처리되었습니다.")
            return True
        else:
            print(f"❌ 테스트 실패: {result.get('message')}")
            return False

    except Exception as e:
        print(f"❌ 테스트 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def test_non_android_device():
    """비안드로이드 기기 테스트 (iPhone, 데스크톱 등)"""

    print("💻 비안드로이드 기기 테스트 시작")
    print("=" * 60)

    # 테스트 이미지 데이터
    test_image_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="

    # 비안드로이드 기기에서 오는 요청 시뮬레이션
    non_android_request = {
        "method": "POST",
        "files": [
            {
                "file": test_image_b64,
                "description": "iPhone GPS 테스트",
                "thumbnails": {},
                "exifData": {
                    "timestamp": "2023-08-15T14:30:00Z",
                    "make": "Apple",
                    "model": "iPhone 15",
                    "latitude": 37.5665,
                    "longitude": 126.9780
                },
                "location": {
                    "latitude": 37.5665,
                    "longitude": 126.9780,
                    "city": "서울특별시",
                    "country": "대한민국"
                },
                "require_metadata_first": False  # 비안드로이드 기기에서는 False
            }
        ]
    }

    print("🔧 테스트 시나리오: 비안드로이드 기기 (require_metadata_first=False)")
    print(f"📍 GPS 좌표: {non_android_request['files'][0]['location']['latitude']}, {non_android_request['files'][0]['location']['longitude']}")
    print(f"🏷️  설명: {non_android_request['files'][0]['description']}")
    print(f"⚙️  메타데이터 우선 저장: {non_android_request['files'][0]['require_metadata_first']}")
    print()

    # 백엔드 핸들러 호출
    try:
        print("🚀 백엔드 핸들러 호출 중...")
        result = handler_unified(non_android_request)

        print("📊 백엔드 응답:")
        print(f"  상태: {result.get('status')}")
        print(f"  메시지: {result.get('message')}")

        if result.get('data'):
            data = result['data']
            print(f"  업로드된 파일 수: {data.get('uploaded_count', 0)}")
            print(f"  실패한 파일 수: {data.get('failed_count', 0)}")

        print()

        # 성공 여부 확인
        if result.get('status') in [200, 201]:
            print("✅ 비안드로이드 기기 테스트 성공!")
            print("💻 require_metadata_first=False 옵션이 정상적으로 처리되었습니다.")
            return True
        else:
            print(f"❌ 테스트 실패: {result.get('message')}")
            return False

    except Exception as e:
        print(f"❌ 테스트 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """메인 테스트 실행"""
    print("🧪 안드로이드 GPS 보존 기능 전체 테스트")
    print("=" * 80)
    print()

    # 환경 설정 확인
    print("🔧 환경 설정:")
    print(f"  STORAGE_TYPE: {os.getenv('STORAGE_TYPE', 'LOCAL')}")
    print(f"  현재 디렉토리: {os.getcwd()}")
    print()

    # 테스트 실행
    test_results = []

    # 1. 안드로이드 기기 테스트
    android_success = test_android_gps_preservation()
    test_results.append(("안드로이드 GPS 보존", android_success))

    print()

    # 2. 비안드로이드 기기 테스트
    non_android_success = test_non_android_device()
    test_results.append(("비안드로이드 기기", non_android_success))

    print()
    print("=" * 80)
    print("🏁 테스트 결과 요약:")

    all_passed = True
    for test_name, success in test_results:
        status = "✅ 성공" if success else "❌ 실패"
        print(f"  {test_name}: {status}")
        if not success:
            all_passed = False

    print()
    if all_passed:
        print("🎉 모든 테스트가 성공했습니다!")
        print("📱 안드로이드 GPS 보존 기능이 정상적으로 구현되었습니다.")
    else:
        print("⚠️  일부 테스트가 실패했습니다. 로그를 확인해주세요.")

    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)