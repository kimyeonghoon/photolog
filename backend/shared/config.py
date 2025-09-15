"""
공통 설정 모듈
환경 변수를 통한 OCI 서비스 설정 관리
"""
import os
from typing import Optional

class Config:
    """OCI 서비스 설정"""

    # OCI Object Storage 설정
    OCI_NAMESPACE: str = os.getenv('OCI_NAMESPACE', 'your-tenancy-namespace')
    OCI_BUCKET_NAME: str = os.getenv('OCI_BUCKET_NAME', 'photolog-storage')
    OCI_REGION: str = os.getenv('OCI_REGION', 'ap-chuncheon-1')

    # OCI NoSQL Database 설정
    NOSQL_COMPARTMENT_ID: str = os.getenv('NOSQL_COMPARTMENT_ID', '')
    NOSQL_TABLE_NAME: str = os.getenv('NOSQL_TABLE_NAME', 'photos')

    # 파일 업로드 제한
    MAX_FILE_SIZE: int = int(os.getenv('MAX_FILE_SIZE', '50')) * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: set = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}

    # 썸네일 설정
    THUMBNAIL_SIZES: list = [
        {'name': 'small', 'width': 150, 'height': 150},
        {'name': 'medium', 'width': 400, 'height': 400},
        {'name': 'large', 'width': 800, 'height': 600}
    ]

    @classmethod
    def validate_config(cls) -> bool:
        """필수 설정값 검증"""
        required_vars = [
            'OCI_NAMESPACE',
            'OCI_BUCKET_NAME',
            'NOSQL_COMPARTMENT_ID'
        ]

        missing_vars = []
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)

        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")

        return True