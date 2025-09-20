"""
MySQL 데이터베이스 클라이언트
MySQL 전용으로 간소화
"""
import os
import sys
from typing import Any

# 현재 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# MySQL Client import with fallback
try:
    from mysql_client import MySQLClient
except ImportError:
    try:
        from .mysql_client import MySQLClient
    except ImportError:
        import importlib.util
        mysql_spec = importlib.util.spec_from_file_location("mysql_client", os.path.join(current_dir, "mysql_client.py"))
        mysql_module = importlib.util.module_from_spec(mysql_spec)
        mysql_spec.loader.exec_module(mysql_module)
        MySQLClient = mysql_module.MySQLClient


class DatabaseClientFactory:
    """MySQL 데이터베이스 클라이언트 팩토리 클래스"""

    @staticmethod
    def get_client() -> MySQLClient:
        """
        MySQL 클라이언트 반환

        Returns:
            MySQL 클라이언트
        """
        return MySQLClient()


# 편의를 위한 전역 함수
def get_database_client() -> MySQLClient:
    """MySQL 데이터베이스 클라이언트 인스턴스 반환"""
    return DatabaseClientFactory.get_client()