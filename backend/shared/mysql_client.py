"""
MySQL Database 클라이언트
사진 메타데이터 저장 및 조회 기능
"""
import pymysql
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from contextlib import contextmanager
from .config import Config


class MySQLClient:
    """MySQL Database 클라이언트"""

    def __init__(self):
        """MySQL 클라이언트 초기화"""
        self.connection_params = {
            'host': Config.MYSQL_HOST,
            'port': Config.MYSQL_PORT,
            'user': Config.MYSQL_USER,
            'password': Config.MYSQL_PASSWORD,
            'database': Config.MYSQL_DATABASE,
            'charset': 'utf8mb4',
            'autocommit': True
        }

    @contextmanager
    def get_connection(self):
        """MySQL 연결 컨텍스트 매니저"""
        connection = None
        try:
            connection = pymysql.connect(**self.connection_params)
            yield connection
        except Exception as e:
            if connection:
                connection.rollback()
            raise e
        finally:
            if connection:
                connection.close()

    def save_photo_metadata(self, photo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        사진 메타데이터를 MySQL DB에 저장

        Args:
            photo_data: 사진 메타데이터

        Returns:
            저장 결과
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # 타임스탬프 정규화
                if 'upload_timestamp' not in photo_data:
                    photo_data['upload_timestamp'] = datetime.now(timezone.utc)

                # JSON 필드 처리
                thumbnail_urls_json = json.dumps(photo_data.get('thumbnail_urls', {})) if photo_data.get('thumbnail_urls') else None
                location_json = json.dumps(photo_data.get('location', {})) if photo_data.get('location') else None
                exif_data_json = json.dumps(photo_data.get('exif_data', {})) if photo_data.get('exif_data') else None
                tags_json = json.dumps(photo_data.get('tags', []))

                # INSERT OR UPDATE 쿼리 (UPSERT)
                sql = """
                INSERT INTO photos (
                    id, filename, description, file_url, file_size, content_type,
                    upload_timestamp, taken_timestamp, travel_date,
                    latitude, longitude, location_address, location_city, location_country,
                    thumbnail_small, thumbnail_medium, thumbnail_large,
                    camera_make, camera_model, iso_speed, aperture, shutter_speed, focal_length,
                    thumbnail_urls_json, location_json, exif_data_json, tags
                ) VALUES (
                    %(id)s, %(filename)s, %(description)s, %(file_url)s, %(file_size)s, %(content_type)s,
                    %(upload_timestamp)s, %(taken_timestamp)s, %(travel_date)s,
                    %(latitude)s, %(longitude)s, %(location_address)s, %(location_city)s, %(location_country)s,
                    %(thumbnail_small)s, %(thumbnail_medium)s, %(thumbnail_large)s,
                    %(camera_make)s, %(camera_model)s, %(iso_speed)s, %(aperture)s, %(shutter_speed)s, %(focal_length)s,
                    %(thumbnail_urls_json)s, %(location_json)s, %(exif_data_json)s, %(tags)s
                ) ON DUPLICATE KEY UPDATE
                    filename = VALUES(filename),
                    description = VALUES(description),
                    file_url = VALUES(file_url),
                    file_size = VALUES(file_size),
                    content_type = VALUES(content_type),
                    upload_timestamp = VALUES(upload_timestamp),
                    taken_timestamp = VALUES(taken_timestamp),
                    travel_date = VALUES(travel_date),
                    latitude = VALUES(latitude),
                    longitude = VALUES(longitude),
                    location_address = VALUES(location_address),
                    location_city = VALUES(location_city),
                    location_country = VALUES(location_country),
                    thumbnail_small = VALUES(thumbnail_small),
                    thumbnail_medium = VALUES(thumbnail_medium),
                    thumbnail_large = VALUES(thumbnail_large),
                    camera_make = VALUES(camera_make),
                    camera_model = VALUES(camera_model),
                    iso_speed = VALUES(iso_speed),
                    aperture = VALUES(aperture),
                    shutter_speed = VALUES(shutter_speed),
                    focal_length = VALUES(focal_length),
                    thumbnail_urls_json = VALUES(thumbnail_urls_json),
                    location_json = VALUES(location_json),
                    exif_data_json = VALUES(exif_data_json),
                    tags = VALUES(tags)
                """

                params = {
                    'id': photo_data.get('id'),
                    'filename': photo_data.get('filename'),
                    'description': photo_data.get('description'),
                    'file_url': photo_data.get('file_url'),
                    'file_size': photo_data.get('file_size'),
                    'content_type': photo_data.get('content_type'),
                    'upload_timestamp': photo_data.get('upload_timestamp'),
                    'taken_timestamp': photo_data.get('taken_timestamp'),
                    'travel_date': photo_data.get('travel_date'),
                    'latitude': photo_data.get('latitude'),
                    'longitude': photo_data.get('longitude'),
                    'location_address': photo_data.get('location_address'),
                    'location_city': photo_data.get('location_city'),
                    'location_country': photo_data.get('location_country'),
                    'thumbnail_small': photo_data.get('thumbnail_small'),
                    'thumbnail_medium': photo_data.get('thumbnail_medium'),
                    'thumbnail_large': photo_data.get('thumbnail_large'),
                    'camera_make': photo_data.get('camera_make'),
                    'camera_model': photo_data.get('camera_model'),
                    'iso_speed': photo_data.get('iso_speed'),
                    'aperture': photo_data.get('aperture'),
                    'shutter_speed': photo_data.get('shutter_speed'),
                    'focal_length': photo_data.get('focal_length'),
                    'thumbnail_urls_json': thumbnail_urls_json,
                    'location_json': location_json,
                    'exif_data_json': exif_data_json,
                    'tags': tags_json
                }

                cursor.execute(sql, params)
                conn.commit()

                return {
                    "success": True,
                    "photo_id": photo_data['id'],
                    "affected_rows": cursor.rowcount
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_photo_metadata(self, photo_id: str) -> Optional[Dict[str, Any]]:
        """
        사진 메타데이터 조회

        Args:
            photo_id: 사진 ID

        Returns:
            사진 메타데이터 또는 None
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                sql = "SELECT * FROM photos WHERE id = %s"
                cursor.execute(sql, (photo_id,))
                result = cursor.fetchone()

                if result:
                    # photo_id 매핑 (NoSQL 호환성)
                    result['photo_id'] = result['id']

                    # JSON 필드 파싱
                    if result.get('thumbnail_urls_json'):
                        result['thumbnail_urls'] = json.loads(result['thumbnail_urls_json'])

                    if result.get('location_json'):
                        result['location'] = json.loads(result['location_json'])

                    if result.get('exif_data_json'):
                        result['exif_data'] = json.loads(result['exif_data_json'])

                    if result.get('tags'):
                        result['tags'] = json.loads(result['tags']) if isinstance(result['tags'], str) else result['tags']

                    return result

                return None

        except Exception as e:
            print(f"사진 조회 오류: {e}")
            return None

    def list_photos(
        self,
        limit: int = 20,
        page: Optional[str] = None,
        order_by: str = 'upload_timestamp',
        order: str = 'DESC'
    ) -> Dict[str, Any]:
        """
        사진 목록 조회 (페이지네이션 지원)

        Args:
            limit: 조회할 개수
            page: 페이지 번호 (1부터 시작)
            order_by: 정렬 기준
            order: 정렬 순서 (ASC/DESC)

        Returns:
            사진 목록과 페이지 정보
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 페이지 번호 처리
                page_num = int(page) if page and page.isdigit() else 1
                offset = (page_num - 1) * limit

                # 유효한 정렬 컬럼 검증
                valid_columns = ['upload_timestamp', 'taken_timestamp', 'travel_date', 'filename']
                if order_by not in valid_columns:
                    order_by = 'upload_timestamp'

                order = 'DESC' if order.upper() == 'DESC' else 'ASC'

                # 총 개수 조회
                count_sql = "SELECT COUNT(*) as total FROM photos"
                cursor.execute(count_sql)
                total_count = cursor.fetchone()['total']

                # 사진 목록 조회
                sql = f"""
                SELECT * FROM photos
                ORDER BY {order_by} {order}
                LIMIT %s OFFSET %s
                """
                cursor.execute(sql, (limit, offset))
                results = cursor.fetchall()

                photos = []
                for photo_data in results:
                    # photo_id 매핑 (NoSQL 호환성)
                    photo_data['photo_id'] = photo_data['id']

                    # JSON 필드 파싱
                    if photo_data.get('thumbnail_urls_json'):
                        photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls_json'])

                    if photo_data.get('location_json'):
                        photo_data['location'] = json.loads(photo_data['location_json'])

                    if photo_data.get('tags'):
                        photo_data['tags'] = json.loads(photo_data['tags']) if isinstance(photo_data['tags'], str) else photo_data['tags']

                    photos.append(photo_data)

                # 페이지 정보 계산
                total_pages = (total_count + limit - 1) // limit
                next_page = str(page_num + 1) if page_num < total_pages else None

                return {
                    "success": True,
                    "photos": photos,
                    "page_info": {
                        "current_page": str(page_num),
                        "next_page": next_page,
                        "total_pages": total_pages,
                        "total_count": total_count,
                        "count": len(photos),
                        "limit": limit
                    }
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "photos": [],
                "page_info": None
            }

    def search_photos_by_location(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        위치 기반 사진 검색

        Args:
            latitude: 위도
            longitude: 경도
            radius_km: 검색 반경 (km)
            limit: 조회할 개수

        Returns:
            검색된 사진 목록
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 하버사인 공식을 사용한 거리 계산
                sql = """
                SELECT *,
                    (6371 * acos(cos(radians(%s)) * cos(radians(latitude)) * cos(radians(longitude) - radians(%s)) + sin(radians(%s)) * sin(radians(latitude)))) AS distance
                FROM photos
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                HAVING distance <= %s
                ORDER BY distance
                LIMIT %s
                """

                cursor.execute(sql, (latitude, longitude, latitude, radius_km, limit))
                results = cursor.fetchall()

                photos = []
                for photo_data in results:
                    # photo_id 매핑 (NoSQL 호환성)
                    photo_data['photo_id'] = photo_data['id']

                    # JSON 필드 파싱
                    if photo_data.get('thumbnail_urls_json'):
                        photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls_json'])

                    if photo_data.get('location_json'):
                        photo_data['location'] = json.loads(photo_data['location_json'])

                    photos.append(photo_data)

                return {
                    "success": True,
                    "photos": photos,
                    "search_params": {
                        "latitude": latitude,
                        "longitude": longitude,
                        "radius_km": radius_km,
                        "count": len(photos)
                    }
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "photos": [],
                "search_params": None
            }

    def delete_photo_metadata(self, photo_id: str) -> Dict[str, Any]:
        """
        사진 메타데이터 삭제

        Args:
            photo_id: 사진 ID

        Returns:
            삭제 결과
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                sql = "DELETE FROM photos WHERE id = %s"
                cursor.execute(sql, (photo_id,))
                conn.commit()

                return {
                    "success": True,
                    "photo_id": photo_id,
                    "deleted": cursor.rowcount > 0,
                    "affected_rows": cursor.rowcount
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def update_photo_metadata(self, photo_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        사진 메타데이터 업데이트

        Args:
            photo_id: 사진 ID
            updates: 업데이트할 필드들

        Returns:
            업데이트 결과
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # 업데이트할 필드들 처리
                set_clauses = []
                params = []

                for field, value in updates.items():
                    if field == 'id':  # ID는 업데이트하지 않음
                        continue

                    # JSON 필드 처리
                    if field in ['thumbnail_urls', 'location', 'exif_data']:
                        field = f"{field}_json"
                        value = json.dumps(value) if value else None
                    elif field == 'tags':
                        value = json.dumps(value) if value else '[]'

                    set_clauses.append(f"{field} = %s")
                    params.append(value)

                if not set_clauses:
                    return {
                        "success": False,
                        "error": "업데이트할 필드가 없습니다."
                    }

                params.append(photo_id)
                sql = f"UPDATE photos SET {', '.join(set_clauses)} WHERE id = %s"

                cursor.execute(sql, params)
                conn.commit()

                return {
                    "success": True,
                    "photo_id": photo_id,
                    "affected_rows": cursor.rowcount
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }