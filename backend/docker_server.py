#!/usr/bin/env python3
"""
Docker 환경용 API 서버 엔트리포인트
"""
import sys
import os

# Python 경로 설정
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/tests')
sys.path.insert(0, '/app/shared')

# 작업 디렉토리를 tests로 변경
os.chdir('/app/tests')

# simple_server 모듈 임포트 및 실행
from simple_server import run_server

if __name__ == "__main__":
    # 스토리지 타입 자동 감지
    if 'STORAGE_TYPE' not in os.environ:
        # OCI 환경변수가 설정되어 있으면 OCI 사용, 아니면 LOCAL 사용
        if os.getenv('OCI_NAMESPACE') and os.getenv('OCI_BUCKET_NAME'):
            os.environ['STORAGE_TYPE'] = 'OCI'
            print("🔧 OCI 환경변수 감지: STORAGE_TYPE을 OCI로 설정")
        else:
            os.environ['STORAGE_TYPE'] = 'LOCAL'
            print("🔧 로컬 테스트 환경: STORAGE_TYPE을 LOCAL로 설정")
    else:
        print(f"🔧 환경변수 STORAGE_TYPE: {os.environ['STORAGE_TYPE']}")

    print("🐳 Docker 컨테이너에서 백엔드 API 서버 시작...")
    run_server(8001)