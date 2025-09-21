"""
MySQL Database 클라이언트
사진 메타데이터 저장 및 조회 기능
"""
import pymysql
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from contextlib import contextmanager
# Config import with fallback
try:
    from config import Config
except ImportError:
    try:
        from .config import Config
    except ImportError:
        import importlib.util
        import os
        config_spec = importlib.util.spec_from_file_location("config", os.path.join(os.path.dirname(__file__), "config.py"))
        config_module = importlib.util.module_from_spec(config_spec)
        config_spec.loader.exec_module(config_module)
        Config = config_module.Config


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

                # 타임스탬프 정규화 및 MySQL 호환 형식으로 변환
                if 'upload_timestamp' not in photo_data:
                    photo_data['upload_timestamp'] = datetime.now(timezone.utc)

                # datetime 필드들을 MySQL 호환 형식으로 변환
                def normalize_timestamp(timestamp):
                    """타임스탬프를 MySQL 호환 형식으로 변환"""
                    if isinstance(timestamp, datetime):
                        return timestamp.strftime('%Y-%m-%d %H:%M:%S')
                    elif isinstance(timestamp, str):
                        try:
                            # ISO 8601 형식 파싱 후 MySQL 형식으로 변환
                            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                            return dt.strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            # 이미 MySQL 형식이거나 파싱 불가능한 경우 그대로 반환
                            return timestamp
                    return timestamp

                if photo_data.get('upload_timestamp'):
                    photo_data['upload_timestamp'] = normalize_timestamp(photo_data['upload_timestamp'])
                if photo_data.get('taken_timestamp'):
                    photo_data['taken_timestamp'] = normalize_timestamp(photo_data['taken_timestamp'])

                # JSON 필드 처리
                thumbnail_urls_json = json.dumps(photo_data.get('thumbnail_urls', {})) if photo_data.get('thumbnail_urls') else None
                location_json = json.dumps(photo_data.get('location', {})) if photo_data.get('location') else None
                exif_data_json = json.dumps(photo_data.get('exif_data', {})) if photo_data.get('exif_data') else None
                tags_json = json.dumps(photo_data.get('tags', []))

                # INSERT OR UPDATE 쿼리 (UPSERT)
                sql = """
                INSERT INTO photos (
                    id, filename, description, file_url, file_size, content_type,
                    upload_timestamp, upload_status, taken_timestamp, travel_date,
                    latitude, longitude, location_address, location_city, location_country,
                    thumbnail_small, thumbnail_medium, thumbnail_large,
                    camera_make, camera_model, iso_speed, aperture, shutter_speed, focal_length,
                    thumbnail_urls_json, location_json, exif_data_json, tags
                ) VALUES (
                    %(id)s, %(filename)s, %(description)s, %(file_url)s, %(file_size)s, %(content_type)s,
                    %(upload_timestamp)s, %(upload_status)s, %(taken_timestamp)s, %(travel_date)s,
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
                    upload_status = VALUES(upload_status),
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
                    'id': photo_data.get('id') or photo_data.get('photo_id'),
                    'filename': photo_data.get('filename'),
                    'description': photo_data.get('description'),
                    'file_url': photo_data.get('file_url'),
                    'file_size': photo_data.get('file_size'),
                    'content_type': photo_data.get('content_type'),
                    'upload_timestamp': photo_data.get('upload_timestamp'),
                    'upload_status': photo_data.get('upload_status', 'completed'),
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
                    "photo_id": photo_data.get('id') or photo_data.get('photo_id'),
                    "affected_rows": cursor.rowcount
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def update_photo_urls(self, photo_id: str, file_url: str, thumbnail_urls: Dict[str, str]) -> Dict[str, Any]:
        """
        사진 URL 정보 업데이트

        Args:
            photo_id: 사진 ID
            file_url: 원본 파일 URL
            thumbnail_urls: 썸네일 URL 딕셔너리

        Returns:
            업데이트 결과
        """
        print(f"🔄 update_photo_urls 호출됨:")
        print(f"   photo_id: {photo_id}")
        print(f"   file_url: {file_url}")
        print(f"   thumbnail_urls: {thumbnail_urls}")

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                # filename 생성 (URL에서 추출)
                filename = file_url.split('/')[-1] if file_url else None
                print(f"   추출된 filename: {filename}")

                # thumbnail_urls JSON 직렬화
                thumbnail_urls_json = json.dumps(thumbnail_urls) if thumbnail_urls else None
                print(f"   thumbnail_urls_json: {thumbnail_urls_json}")

                sql = """
                UPDATE photos
                SET filename = %s, file_url = %s, thumbnail_urls_json = %s
                WHERE id = %s
                """
                print(f"   SQL 쿼리 실행: {sql}")
                print(f"   파라미터: ({filename}, {file_url}, {thumbnail_urls_json}, {photo_id})")

                cursor.execute(sql, (filename, file_url, thumbnail_urls_json, photo_id))
                conn.commit()

                affected_rows = cursor.rowcount
                print(f"   ✅ 업데이트 성공, affected_rows: {affected_rows}")

                return {
                    "success": True,
                    "photo_id": photo_id,
                    "affected_rows": affected_rows
                }

        except Exception as e:
            print(f"   ❌ update_photo_urls 오류: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def update_upload_status(self, photo_id: str, status: str) -> Dict[str, Any]:
        """
        사진 업로드 상태 업데이트

        Args:
            photo_id: 사진 ID
            status: 업로드 상태 ('uploading', 'completed', 'failed')

        Returns:
            업데이트 결과
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()

                sql = "UPDATE photos SET upload_status = %s WHERE id = %s"
                cursor.execute(sql, (status, photo_id))
                conn.commit()

                return {
                    "success": True,
                    "photo_id": photo_id,
                    "status": status,
                    "affected_rows": cursor.rowcount
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def cleanup_failed_uploads(self, hours_old: int = 1) -> Dict[str, Any]:
        """
        오래된 미완료 업로드 정리

        Args:
            hours_old: 정리할 업로드 경과 시간 (시간 단위)

        Returns:
            정리 결과
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 오래된 'uploading' 상태 사진 조회
                sql = """
                SELECT id, filename FROM photos
                WHERE upload_status = 'uploading'
                AND upload_timestamp < DATE_SUB(NOW(), INTERVAL %s HOUR)
                """
                cursor.execute(sql, (hours_old,))
                failed_uploads = cursor.fetchall()

                if failed_uploads:
                    # 실패 상태로 변경
                    photo_ids = [photo['id'] for photo in failed_uploads]
                    placeholders = ','.join(['%s'] * len(photo_ids))
                    update_sql = f"UPDATE photos SET upload_status = 'failed' WHERE id IN ({placeholders})"
                    cursor.execute(update_sql, photo_ids)
                    conn.commit()

                return {
                    "success": True,
                    "cleaned_count": len(failed_uploads),
                    "failed_uploads": [{"id": p['id'], "filename": p['filename']} for p in failed_uploads]
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "cleaned_count": 0
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

                    # Decimal 타입을 float로 변환 (JSON 직렬화 오류 방지)
                    from decimal import Decimal
                    for key, value in result.items():
                        if isinstance(value, Decimal):
                            result[key] = float(value)

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

                # 유효한 정렬 컬럼 검증 및 특별 처리
                if order_by.startswith('COALESCE('):
                    # COALESCE 문자열에서 방향(ASC/DESC) 추출
                    if 'ASC' in order_by.upper():
                        order = 'ASC'
                    elif 'DESC' in order_by.upper():
                        order = 'DESC'
                    # EXIF 촬영시간 우선 정렬: JSON에서 timestamp 추출, 없으면 upload_timestamp
                    order_by = 'COALESCE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, "$.timestamp")), upload_timestamp)'
                else:
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

                    # datetime 필드 문자열 변환 (JSON 직렬화를 위해)
                    datetime_fields = ['upload_timestamp', 'taken_timestamp']
                    for field in datetime_fields:
                        if photo_data.get(field) and hasattr(photo_data[field], 'isoformat'):
                            photo_data[field] = photo_data[field].isoformat()

                    # date 필드 문자열 변환
                    if photo_data.get('travel_date') and hasattr(photo_data['travel_date'], 'isoformat'):
                        photo_data['travel_date'] = photo_data['travel_date'].isoformat()

                    # JSON 필드 파싱
                    if photo_data.get('thumbnail_urls_json'):
                        photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls_json'])

                    if photo_data.get('location_json'):
                        photo_data['location'] = json.loads(photo_data['location_json'])

                    if photo_data.get('exif_data_json'):
                        photo_data['exif_data'] = json.loads(photo_data['exif_data_json'])

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
                    },
                    "has_more": next_page is not None  # 프론트엔드 호환성을 위한 필드 추가
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "photos": [],
                "page_info": None
            }

    def get_stats(self) -> Dict[str, Any]:
        """
        전체 사진 통계 조회

        Returns:
            통계 정보
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 기본 통계 조회
                stats_sql = """
                SELECT
                    COUNT(*) as total_photos,
                    COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as photos_with_location,
                    COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as photos_with_description,
                    COALESCE(SUM(file_size), 0) as total_size,
                    MIN(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as first_photo_date,
                    MAX(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as latest_photo_date
                FROM photos
                """
                cursor.execute(stats_sql)
                basic_stats = cursor.fetchone()

                # 이번 달 사진 수 조회
                this_month_sql = """
                SELECT COUNT(*) as this_month_photos
                FROM photos
                WHERE YEAR(upload_timestamp) = YEAR(CURDATE())
                AND MONTH(upload_timestamp) = MONTH(CURDATE())
                """
                cursor.execute(this_month_sql)
                this_month_stats = cursor.fetchone()

                # 월별 통계 (최근 12개월)
                monthly_sql = """
                SELECT
                    YEAR(upload_timestamp) as year,
                    MONTH(upload_timestamp) as month,
                    COUNT(*) as count
                FROM photos
                WHERE upload_timestamp >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                GROUP BY YEAR(upload_timestamp), MONTH(upload_timestamp)
                ORDER BY year DESC, month DESC
                """
                cursor.execute(monthly_sql)
                monthly_stats = cursor.fetchall()

                # 결과 정리 (Decimal 타입을 int로 변환하여 JSON 직렬화 오류 방지)
                total_photos = int(basic_stats['total_photos'])
                photos_with_location = int(basic_stats['photos_with_location'])
                photos_with_description = int(basic_stats['photos_with_description'])
                this_month_photos = int(this_month_stats['this_month_photos'])

                # Decimal 타입을 int로 변환
                total_size = int(basic_stats['total_size']) if basic_stats['total_size'] is not None else 0

                # datetime 객체를 문자열로 변환
                first_photo_date = basic_stats['first_photo_date']
                latest_photo_date = basic_stats['latest_photo_date']

                if first_photo_date and hasattr(first_photo_date, 'isoformat'):
                    first_photo_date = first_photo_date.isoformat()
                if latest_photo_date and hasattr(latest_photo_date, 'isoformat'):
                    latest_photo_date = latest_photo_date.isoformat()

                return {
                    "success": True,
                    "stats": {
                        "total_photos": total_photos,
                        "photos_with_location": photos_with_location,
                        "photos_with_description": photos_with_description,
                        "this_month_photos": this_month_photos,
                        "total_size": total_size,
                        "first_photo_date": first_photo_date,
                        "latest_photo_date": latest_photo_date,
                        "location_percentage": round((photos_with_location / total_photos) * 100) if total_photos > 0 else 0,
                        "description_percentage": round((photos_with_description / total_photos) * 100) if total_photos > 0 else 0,
                        "monthly_stats": [
                            {
                                "year": int(stat["year"]),
                                "month": int(stat["month"]),
                                "count": int(stat["count"])
                            } for stat in monthly_stats
                        ]
                    }
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "stats": None
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

    def get_photos_by_location(self) -> Dict[str, Any]:
        """
        지역별 사진 분포 조회

        Returns:
            지역별 사진 개수 및 분포 정보
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 지역별 사진 개수 조회 (도시와 국가 정보 기준)
                sql = """
                SELECT
                    CASE
                        WHEN location_city IS NOT NULL AND location_city != '' THEN
                            CONCAT(location_city, CASE WHEN location_country IS NOT NULL AND location_country != '' THEN CONCAT(', ', location_country) ELSE '' END)
                        WHEN location_country IS NOT NULL AND location_country != '' THEN location_country
                        ELSE '위치 정보 없음'
                    END as location_name,
                    COUNT(*) as photo_count,
                    AVG(latitude) as avg_latitude,
                    AVG(longitude) as avg_longitude,
                    MIN(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as first_photo_date,
                    MAX(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as latest_photo_date
                FROM photos
                WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY location_name
                ORDER BY photo_count DESC, location_name
                """

                cursor.execute(sql)
                results = cursor.fetchall()

                distribution = []
                for result in results:
                    # datetime 객체를 문자열로 변환
                    first_photo_date = result['first_photo_date']
                    latest_photo_date = result['latest_photo_date']

                    if first_photo_date and hasattr(first_photo_date, 'isoformat'):
                        first_photo_date = first_photo_date.isoformat()
                    if latest_photo_date and hasattr(latest_photo_date, 'isoformat'):
                        latest_photo_date = latest_photo_date.isoformat()

                    distribution.append({
                        "location_name": result['location_name'],
                        "photo_count": int(result['photo_count']),
                        "avg_latitude": float(result['avg_latitude']) if result['avg_latitude'] else None,
                        "avg_longitude": float(result['avg_longitude']) if result['avg_longitude'] else None,
                        "first_photo_date": first_photo_date,
                        "latest_photo_date": latest_photo_date
                    })

                return {
                    "success": True,
                    "distribution": distribution
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "distribution": []
            }

    def get_photos_by_date(self) -> Dict[str, Any]:
        """
        년도별/월별 사진 통계 조회

        Returns:
            년도별, 월별 사진 통계 정보
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor(pymysql.cursors.DictCursor)

                # 년도별 통계 조회 (EXIF 촬영일 우선, JSON 필드에서 타임스탬프 추출)
                yearly_sql = """
                SELECT
                    YEAR(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as year,
                    COUNT(*) as photo_count
                FROM photos
                WHERE COALESCE(
                    STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                    taken_timestamp,
                    upload_timestamp
                ) IS NOT NULL
                GROUP BY YEAR(COALESCE(
                    STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                    taken_timestamp,
                    upload_timestamp
                ))
                ORDER BY year DESC
                """

                cursor.execute(yearly_sql)
                yearly_results = cursor.fetchall()
                yearly_stats = [{"year": int(row['year']), "photo_count": int(row['photo_count'])} for row in yearly_results]

                # 월별 통계 조회 (EXIF 촬영일 우선, JSON 필드에서 타임스탬프 추출)
                monthly_sql = """
                SELECT
                    MONTH(COALESCE(
                        STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                        taken_timestamp,
                        upload_timestamp
                    )) as month,
                    COUNT(*) as photo_count
                FROM photos
                WHERE COALESCE(
                    STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                    taken_timestamp,
                    upload_timestamp
                ) IS NOT NULL
                GROUP BY MONTH(COALESCE(
                    STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(exif_data_json, '$.timestamp')), '%Y-%m-%dT%H:%i:%s.%fZ'),
                    taken_timestamp,
                    upload_timestamp
                ))
                ORDER BY month
                """

                cursor.execute(monthly_sql)
                monthly_results = cursor.fetchall()
                monthly_stats = [{"month": int(row['month']), "photo_count": int(row['photo_count'])} for row in monthly_results]

                return {
                    "success": True,
                    "yearly_stats": yearly_stats,
                    "monthly_stats": monthly_stats
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "yearly_stats": [],
                "monthly_stats": []
            }