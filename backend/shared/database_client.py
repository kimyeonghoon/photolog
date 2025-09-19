"""
데이터베이스 클라이언트 팩토리
설정에 따라 MySQL 또는 NoSQL 클라이언트를 반환
"""
from typing import Union
from .config import Config
from .mysql_client import MySQLClient
from .nosql_client import OCINoSQLClient


class DatabaseClientFactory:
    """데이터베이스 클라이언트 팩토리 클래스"""

    @staticmethod
    def get_client() -> Union[MySQLClient, OCINoSQLClient]:
        """
        설정에 따라 적절한 데이터베이스 클라이언트를 반환

        Returns:
            MySQL 또는 NoSQL 클라이언트
        """
        if Config.DATABASE_TYPE.lower() == 'mysql':
            return MySQLClient()
        elif Config.DATABASE_TYPE.lower() == 'nosql':
            return OCINoSQLClient()
        else:
            raise ValueError(f"지원하지 않는 데이터베이스 타입: {Config.DATABASE_TYPE}")


# 편의를 위한 전역 함수
def get_database_client() -> Union[MySQLClient, OCINoSQLClient]:
    """데이터베이스 클라이언트 인스턴스 반환"""
    return DatabaseClientFactory.get_client()