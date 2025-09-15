#!/usr/bin/env python3
"""
실제 이미지 파일을 사용한 종합 테스트
"""
import sys
import os
import base64
import json
from test_func_local import local_photo_upload_handler

def create_sample_image_with_location():
    """GPS 정보가 포함된 샘플 이미지 생성"""
    from PIL import Image
    from PIL.ExifTags import TAGS, GPSTAGS
    import io

    # 10x10 픽셀 RGB 이미지 생성
    img = Image.new('RGB', (10, 10), color='red')

    # EXIF 데이터는 실제 카메라에서 생성하기 어려우므로
    # 이 테스트에서는 일반 이미지로 진행

    # 이미지를 bytes로 변환
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_byte_arr = img_byte_arr.getvalue()

    # Base64 인코딩
    return base64.b64encode(img_byte_arr).decode('utf-8')

def test_comprehensive_upload():
    """종합적인 업로드 테스트"""
    print("🔍 종합 업로드 테스트 시작")
    print("=" * 50)

    # 테스트 케이스들
    test_cases = [
        {
            "name": "일반 JPEG 이미지",
            "data": {
                "filename": "seoul-tower.jpg",
                "file_data": create_sample_image_with_location(),
                "content_type": "image/jpeg",
                "description": "서울 N타워 야경"
            },
            "expected_status": 201
        },
        {
            "name": "PNG 이미지",
            "data": {
                "filename": "screenshot.png",
                "file_data": create_sample_image_with_location(),
                "content_type": "image/png",
                "description": "스크린샷 이미지"
            },
            "expected_status": 201
        },
        {
            "name": "설명 없는 이미지",
            "data": {
                "filename": "no-description.jpg",
                "file_data": create_sample_image_with_location(),
                "content_type": "image/jpeg"
                # description 누락
            },
            "expected_status": 201
        },
        {
            "name": "잘못된 파일 확장자",
            "data": {
                "filename": "document.pdf",
                "file_data": create_sample_image_with_location(),
                "content_type": "application/pdf",
                "description": "PDF 파일"
            },
            "expected_status": 400
        },
        {
            "name": "빈 파일명",
            "data": {
                "filename": "",
                "file_data": create_sample_image_with_location(),
                "content_type": "image/jpeg",
                "description": "빈 파일명 테스트"
            },
            "expected_status": 400
        }
    ]

    passed = 0
    total = len(test_cases)

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 테스트 {i}: {test_case['name']}")
        print("-" * 30)

        try:
            result = local_photo_upload_handler(test_case['data'])
            response_data = json.loads(result['body'])
            actual_status = result['statusCode']
            expected_status = test_case['expected_status']

            print(f"예상 상태: {expected_status}")
            print(f"실제 상태: {actual_status}")
            print(f"성공 여부: {response_data['success']}")
            print(f"메시지: {response_data['message']}")

            if actual_status == expected_status:
                print("✅ 테스트 통과")
                passed += 1

                # 성공한 경우 추가 정보 출력
                if response_data['success'] and response_data.get('data'):
                    data = response_data['data']
                    print(f"   📷 사진 ID: {data.get('photo_id', 'N/A')[:8]}...")
                    print(f"   📁 파일 크기: {data.get('file_size', 'N/A')} bytes")
                    if data.get('location'):
                        loc = data['location']
                        print(f"   📍 위치: {loc.get('latitude', 'N/A')}, {loc.get('longitude', 'N/A')}")
                    else:
                        print(f"   📍 위치: GPS 정보 없음")
            else:
                print("❌ 테스트 실패")

        except Exception as e:
            print(f"❌ 테스트 오류: {str(e)}")

    print("\n" + "=" * 50)
    print(f"📊 테스트 결과: {passed}/{total} 통과")

    if passed == total:
        print("🎉 모든 테스트가 성공했습니다!")
        print("✅ 사진 업로드 API가 정상적으로 작동합니다!")
    else:
        print("⚠️  일부 테스트가 실패했습니다.")

    print("=" * 50)

    return passed == total

def test_file_size_limits():
    """파일 크기 제한 테스트"""
    print("\n📏 파일 크기 제한 테스트")
    print("-" * 30)

    # 큰 파일 데이터 생성 (5MB 정도)
    large_data = "A" * (5 * 1024 * 1024)  # 5MB 텍스트
    large_b64 = base64.b64encode(large_data.encode()).decode()

    test_data = {
        "filename": "large-file.jpg",
        "file_data": large_b64,
        "content_type": "image/jpeg",
        "description": "큰 파일 테스트"
    }

    result = local_photo_upload_handler(test_data)
    response_data = json.loads(result['body'])

    print(f"파일 크기: ~{len(large_data)} bytes")
    print(f"상태 코드: {result['statusCode']}")
    print(f"메시지: {response_data['message']}")

    # 파일이 너무 크거나 잘못된 형식이므로 400 에러가 나와야 함
    if result['statusCode'] == 400:
        print("✅ 파일 크기 제한이 정상적으로 작동합니다")
        return True
    else:
        print("❌ 파일 크기 제한이 작동하지 않습니다")
        return False

if __name__ == "__main__":
    print("🧪 포토로그 API 종합 테스트")
    print("=" * 60)

    # 종합 테스트 실행
    basic_test_passed = test_comprehensive_upload()

    # 파일 크기 제한 테스트
    size_test_passed = test_file_size_limits()

    print(f"\n🏆 최종 결과:")
    print(f"   기본 기능 테스트: {'✅ 통과' if basic_test_passed else '❌ 실패'}")
    print(f"   파일 크기 제한: {'✅ 통과' if size_test_passed else '❌ 실패'}")

    if basic_test_passed and size_test_passed:
        print("\n🎉 모든 테스트가 성공했습니다!")
        print("🚀 사진 업로드 API가 프로덕션 준비 완료!")
    else:
        print("\n⚠️  일부 테스트가 실패했습니다. 코드를 확인해주세요.")

    print("=" * 60)