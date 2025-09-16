#!/usr/bin/env python3
"""
실제 OCI 서비스와 연동하여 업로드를 테스트하는 스크립트
"""
import sys
import os
import base64
import json
import io

# 프로젝트 루트 및 shared 폴더를 sys.path에 추가
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../shared')))

# 실제 핸들러 import
from functions.photo_upload.func import handler

class MockContext:
    """OCI Functions의 컨텍스트 객체를 모방하는 클래스"""
    def __init__(self, method='POST'):
        self._method = method

    def Method(self):
        return self._method

def create_test_jpeg():
    """테스트용 JPG 이미지 파일을 생성하여 public 폴더에 저장"""
    try:
        from PIL import Image
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../public/test_image.jpg'))
        if os.path.exists(file_path):
            print("- 테스트용 이미지 파일 'public/test_image.jpg'가 이미 존재합니다.")
            return

        print("- 테스트용 이미지 파일 'public/test_image.jpg' 생성 중...")
        img = Image.new('RGB', (10, 10), color='red')
        img.save(file_path, format='JPEG')
        print("✅ 생성 완료.")
    except Exception as e:
        print(f"❌ 테스트 이미지 생성 실패: {e}")
        raise

def run_real_upload_test(test_name, filename, content_type, description):
    """실제 업로드 테스트 실행 함수"""
    print(f"\n📋 테스트: {test_name}")
    print("-" * 40)

    try:
        # 테스트할 파일 읽기
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), f'../../{filename}'))
        print(f"- 테스트 파일: {file_path}")
        with open(file_path, 'rb') as f:
            file_content = f.read()

        # Base64 인코딩
        file_data_b64 = base64.b64encode(file_content).decode('utf-8')

        # 핸들러에 전달할 데이터 구성
        request_data = {
            "filename": os.path.basename(filename),
            "file_data": file_data_b64,
            "content_type": content_type,
            "description": description
        }

        # 모의 컨텍스트 생성
        ctx = MockContext()

        # 핸들러 실행
        print("- 실제 업로드 핸들러 호출...")
        result = handler(ctx, data=io.BytesIO(json.dumps(request_data).encode('utf-8')))

        # 결과 분석
        status_code = result['statusCode']
        response_body = json.loads(result['body'])

        print(f"- HTTP 상태 코드: {status_code}")
        print(f"- 응답 성공 여부: {response_body.get('success')}")
        print(f"- 메시지: {response_body.get('message')}")

        if response_body.get('success'):
            photo_id = response_body.get('data', {}).get('photo_id')
            print(f"- 성공! 사진 ID: {photo_id}")
            return True, photo_id
        else:
            print(f"- 실패. 원인: {response_body.get('message')}")
            return False, None

    except FileNotFoundError:
        print(f"❌ 테스트 파일 '{filename}'을(를) 찾을 수 없습니다.")
        return False, None
    except Exception as e:
        print(f"❌ 테스트 중 예외 발생: {e}")
        import traceback
        traceback.print_exc()
        return False, None

if __name__ == "__main__":
    print("🧪 실제 OCI 연동 업로드 테스트 시작")
    print("=" * 50)

    # 테스트용 이미지 생성
    create_test_jpeg()

    # --- 테스트 1: 잘못된 파일 형식 (SVG) --- #
    test1_success, _ = run_real_upload_test(
        test_name="잘못된 파일 형식(SVG) 업로드",
        filename="public/vite.svg",
        content_type="image/svg+xml",
        description="Vite 로고 SVG 파일"
    )

    print("\n--- 테스트 1 결과 ---")
    if not test1_success:
        print("✅ 정상: 잘못된 파일 형식을 올바르게 차단했습니다.")
    else:
        print("❌ 비정상: 잘못된 파일 형식이 차단되지 않았습니다.")

    # --- 테스트 2: 정상 이미지 파일 (JPG) --- #
    test2_success, photo_id = run_real_upload_test(
        test_name="정상 이미지(JPG) 업로드",
        filename="public/test_image.jpg",
        content_type="image/jpeg",
        description="자동 생성된 테스트 이미지"
    )

    print("\n--- 테스트 2 결과 ---")
    if test2_success:
        print(f"✅ 정상: 이미지 업로드 성공 (사진 ID: {photo_id})")
        # --- 검증 단계 --- #
        print("\n--- 검증: NoSQL에서 데이터 확인 ---")
        try:
            from shared.oci_client import OCINoSQLClient
            nosql_client = OCINoSQLClient()
            retrieved_data = nosql_client.get_photo_by_id(photo_id)
            if retrieved_data and retrieved_data.get('success'):
                print(f"✅ 검증 성공: NoSQL에서 Photo ID {photo_id[:8]}... 를 찾았습니다.")
            else:
                print(f"❌ 검증 실패: NoSQL에서 Photo ID {photo_id[:8]}... 를 찾지 못했습니다. {retrieved_data.get('error')}")
        except Exception as e:
            print(f"❌ 검증 중 오류 발생: {e}")
    else:
        print("❌ 비정상: 이미지 업로드에 실패했습니다.")


    print("\n🏁 테스트 완료")
