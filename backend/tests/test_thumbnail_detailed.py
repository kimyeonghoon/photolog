#!/usr/bin/env python3
"""
썸네일 생성 기능 상세 테스트
"""
import json
import base64
from test_func_local import local_photo_upload_handler

def create_test_image_b64():
    """테스트용 유효한 작은 이미지 Base64 데이터 생성"""
    import io
    from PIL import Image
    # PIL로 간단한 10x10 이미지 생성
    test_image = Image.new('RGB', (10, 10), color='blue')
    output = io.BytesIO()
    test_image.save(output, format='JPEG', quality=85)
    jpeg_data = output.getvalue()
    return base64.b64encode(jpeg_data).decode('utf-8')

def test_thumbnail_response():
    """썸네일 응답 상세 테스트"""
    print("🖼️ 썸네일 생성 기능 상세 테스트")
    print("=" * 50)

    # 테스트 데이터
    test_data = {
        "filename": "thumbnail-test.jpg",
        "file_data": create_test_image_b64(),
        "content_type": "image/jpeg",
        "description": "썸네일 생성 테스트 이미지"
    }

    # API 호출
    result = local_photo_upload_handler(test_data)
    response_data = json.loads(result['body'])

    print(f"📊 응답 상태 코드: {result['statusCode']}")
    print(f"✅ 성공 여부: {response_data['success']}")
    print(f"📝 메시지: {response_data['message']}")
    print()

    if response_data['success'] and response_data.get('data'):
        data = response_data['data']

        print("📸 업로드된 사진 정보:")
        print(f"   🆔 Photo ID: {data.get('photo_id', 'N/A')}")
        print(f"   📁 파일명: {data.get('filename', 'N/A')}")
        print(f"   🔗 원본 URL: {data.get('file_url', 'N/A')}")
        print(f"   📏 파일 크기: {data.get('file_size', 'N/A')} bytes")
        print()

        # 썸네일 정보 확인
        thumbnail_urls = data.get('thumbnail_urls', {})
        thumbnails_generated = data.get('thumbnails_generated', 0)

        print("🖼️ 썸네일 정보:")
        print(f"   📊 생성된 썸네일 수: {thumbnails_generated}")

        if thumbnail_urls:
            print("   🔗 썸네일 URL들:")
            for size, url in thumbnail_urls.items():
                print(f"      • {size}: {url}")

            print()
            print("✅ 썸네일이 성공적으로 생성되었습니다!")

            # 각 썸네일 크기 정보 출력
            expected_sizes = {
                'small': '150x150',
                'medium': '400x400',
                'large': '800x600'
            }

            print("\n📐 예상 썸네일 크기:")
            for size, dimensions in expected_sizes.items():
                if size in thumbnail_urls:
                    print(f"   ✅ {size}: {dimensions}")
                else:
                    print(f"   ❌ {size}: 누락됨")
        else:
            print("   ❌ 썸네일이 생성되지 않았습니다.")

        # EXIF 정보 확인
        exif_data = data.get('exif_data', {})
        print(f"\n📷 EXIF 정보:")
        print(f"   카메라: {exif_data.get('camera', 'N/A')}")
        print(f"   촬영시간: {exif_data.get('datetime', 'N/A')}")

        # 위치 정보 확인
        location = data.get('location')
        if location:
            print(f"\n📍 위치 정보:")
            print(f"   위도: {location.get('latitude', 'N/A')}")
            print(f"   경도: {location.get('longitude', 'N/A')}")
        else:
            print(f"\n📍 위치 정보: GPS 정보 없음")

    else:
        print("❌ 업로드 실패 또는 데이터 없음")
        if not response_data['success']:
            print(f"   오류: {response_data.get('message', '알 수 없는 오류')}")

    print("\n" + "=" * 50)

if __name__ == "__main__":
    test_thumbnail_response()