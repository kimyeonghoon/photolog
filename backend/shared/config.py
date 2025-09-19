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
    OCI_BUCKET_NAME: str = os.getenv('OCI_BUCKET_NAME', 'your-bucket-name')
    OCI_REGION: str = os.getenv('OCI_REGION', 'ap-chuncheon-1')

    # OCI NoSQL Database 설정 (레거시)
    NOSQL_COMPARTMENT_ID: str = os.getenv('NOSQL_COMPARTMENT_ID', '')
    NOSQL_TABLE_NAME: str = os.getenv('NOSQL_TABLE_NAME', 'photos')

    # MySQL Database 설정
    MYSQL_HOST: str = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_PORT: int = int(os.getenv('MYSQL_PORT', '3306'))
    MYSQL_USER: str = os.getenv('MYSQL_USER', 'root')
    MYSQL_PASSWORD: str = os.getenv('MYSQL_PASSWORD', '')
    MYSQL_DATABASE: str = os.getenv('MYSQL_DATABASE', 'photolog')

    # 데이터베이스 타입 선택 (mysql 또는 nosql)
    DATABASE_TYPE: str = os.getenv('DATABASE_TYPE', 'mysql')

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
            'OCI_BUCKET_NAME'
        ]

        # 데이터베이스 타입에 따른 추가 검증
        if cls.DATABASE_TYPE == 'mysql':
            required_vars.extend([
                'MYSQL_HOST',
                'MYSQL_USER',
                'MYSQL_DATABASE'
            ])
        elif cls.DATABASE_TYPE == 'nosql':
            required_vars.append('NOSQL_COMPARTMENT_ID')

        missing_vars = []
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)

        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")

        return True