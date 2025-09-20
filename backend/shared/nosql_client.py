"""
OCI NoSQL Database 클라이언트
사진 메타데이터 저장 및 조회 기능
"""
import oci
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from .config import Config


class OCINoSQLClient:
    """OCI NoSQL Database 클라이언트"""

    def __init__(self):
        """NoSQL 클라이언트 초기화"""
        try:
            # 로컬 개발 환경에서는 config 파일 사용
            self.config = oci.config.from_file()
            self.nosql_client = oci.nosql.NosqlClient(self.config)
        except Exception as e:
            try:
                # Resource Principal을 사용한 인증 (OCI Functions 환경)
                signer = oci.auth.signers.get_resource_principals_signer()
                self.config = {}
                self.nosql_client = oci.nosql.NosqlClient(
                    config={},
                    signer=signer
                )
            except Exception as signer_error:
                raise Exception(f"NoSQL 인증 실패: config 파일 오류({e}), signer 오류({signer_error})")

        self.compartment_id = Config.NOSQL_COMPARTMENT_ID or self.config.get('tenancy')
        self.table_name = Config.NOSQL_TABLE_NAME

    def save_photo_metadata(self, photo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        사진 메타데이터를 NoSQL DB에 저장

        Args:
            photo_data: 사진 메타데이터

        Returns:
            저장 결과
        """
        try:
            # 타임스탬프 정규화
            if 'upload_timestamp' not in photo_data:
                photo_data['upload_timestamp'] = datetime.now(timezone.utc).isoformat()

            # JSON 필드를 문자열로 변환
            if 'thumbnail_urls' in photo_data and isinstance(photo_data['thumbnail_urls'], dict):
                photo_data['thumbnail_urls'] = json.dumps(photo_data['thumbnail_urls'])

            if 'location' in photo_data and isinstance(photo_data['location'], dict):
                photo_data['location'] = json.dumps(photo_data['location'])

            if 'exif_data' in photo_data and isinstance(photo_data['exif_data'], dict):
                photo_data['exif_data'] = json.dumps(photo_data['exif_data'])

            if 'tags' not in photo_data:
                photo_data['tags'] = []

            # NoSQL UPDATE 요청 생성 - update_row 메서드 사용
            update_row_details = oci.nosql.models.UpdateRowDetails(
                value=photo_data,
                compartment_id=self.compartment_id
            )

            response = self.nosql_client.update_row(
                table_name_or_id=self.table_name,
                update_row_details=update_row_details
            )

            return {
                "success": True,
                "photo_id": photo_data['id'],  # id 필드를 photo_id로 반환
                "version": response.data.version if hasattr(response.data, 'version') else None
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
            # NoSQL GET 요청 - key를 올바른 형식으로 전달 (id 필드 사용)
            key_value = [f"id:{photo_id}"]  # PRIMARY KEY인 id를 column-name:value 형식으로 사용

            response = self.nosql_client.get_row(
                table_name_or_id=self.table_name,
                key=key_value,
                compartment_id=self.compartment_id
            )

            if response.data.value:
                photo_data = response.data.value

                # id 필드를 photo_id로 매핑
                if 'id' in photo_data:
                    photo_data['photo_id'] = photo_data['id']

                # JSON 필드 파싱
                if 'thumbnail_urls' in photo_data and isinstance(photo_data['thumbnail_urls'], str):
                    photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls'])

                if 'location' in photo_data and isinstance(photo_data['location'], str):
                    photo_data['location'] = json.loads(photo_data['location'])

                if 'exif_data' in photo_data and isinstance(photo_data['exif_data'], str):
                    photo_data['exif_data'] = json.loads(photo_data['exif_data'])

                return photo_data

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
            page: 페이지 토큰
            order_by: 정렬 기준
            order: 정렬 순서 (ASC/DESC)

        Returns:
            사진 목록과 페이지 정보
        """
        try:
            # NoSQL Query 작성 - 간단한 형태
            sql = f"SELECT * FROM {self.table_name}"

            query_details = oci.nosql.models.QueryDetails(
                compartment_id=self.compartment_id,
                statement=sql
            )

            response = self.nosql_client.query(query_details)

            photos = []
            for item in response.data.items:
                photo_data = item

                # id 필드를 photo_id로 매핑
                if 'id' in photo_data:
                    photo_data['photo_id'] = photo_data['id']

                # JSON 필드 파싱
                if 'thumbnail_urls' in photo_data and isinstance(photo_data['thumbnail_urls'], str):
                    photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls'])

                if 'location' in photo_data and isinstance(photo_data['location'], str):
                    photo_data['location'] = json.loads(photo_data['location'])

                photos.append(photo_data)

            return {
                "success": True,
                "photos": photos,
                "page_info": {
                    "current_page": page,
                    "next_page": response.data.opc_next_page if hasattr(response.data, 'opc_next_page') else None,
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
            # 간단한 쿼리 - 위치가 있는 사진들만 가져와서 클라이언트에서 필터링
            sql = f"SELECT * FROM {self.table_name}"

            query_details = oci.nosql.models.QueryDetails(
                compartment_id=self.compartment_id,
                statement=sql
            )

            response = self.nosql_client.query(query_details)

            # 클라이언트 측에서 거리 필터링 (임시 구현)
            filtered_photos = []
            for item in response.data.items:
                photo_data = item

                # id 필드를 photo_id로 매핑
                if 'id' in photo_data:
                    photo_data['photo_id'] = photo_data['id']

                if 'location' in photo_data and photo_data['location']:
                    try:
                        if isinstance(photo_data['location'], str):
                            location = json.loads(photo_data['location'])
                        else:
                            location = photo_data['location']

                        if location and 'latitude' in location and 'longitude' in location:
                            # 간단한 거리 계산 (실제로는 하버사인 공식 등 사용)
                            lat_diff = abs(location['latitude'] - latitude)
                            lng_diff = abs(location['longitude'] - longitude)

                            # 대략적인 거리 필터링 (1도 ≈ 111km)
                            if lat_diff < (radius_km / 111.0) and lng_diff < (radius_km / 111.0):
                                # JSON 필드 파싱
                                if 'thumbnail_urls' in photo_data and isinstance(photo_data['thumbnail_urls'], str):
                                    photo_data['thumbnail_urls'] = json.loads(photo_data['thumbnail_urls'])

                                filtered_photos.append(photo_data)
                    except:
                        continue

            return {
                "success": True,
                "photos": filtered_photos,
                "search_params": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "radius_km": radius_km,
                    "count": len(filtered_photos)
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
            # key를 올바른 형식으로 전달 (id 필드 사용)
            key_value = [f"id:{photo_id}"]  # PRIMARY KEY인 id를 column-name:value 형식으로 사용

            response = self.nosql_client.delete_row(
                table_name_or_id=self.table_name,
                key=key_value,
                compartment_id=self.compartment_id
            )

            return {
                "success": True,
                "photo_id": photo_id,
                "deleted": True
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_photos_by_location(self) -> Dict[str, Any]:
        """
        지역별 사진 분포 조회 (NoSQL용 기본 구현)

        Returns:
            지역별 사진 개수 및 분포 정보
        """
        try:
            # NoSQL은 GROUP BY가 제한적이므로 모든 사진을 가져와서 메모리에서 처리
            photos_result = self.list_photos(limit=1000)  # 충분히 큰 limit

            if not photos_result.get('success', False):
                return {
                    "success": False,
                    "error": "사진 목록 조회 실패",
                    "distribution": []
                }

            photos = photos_result.get('photos', [])
            location_map = {}

            for photo in photos:
                # 위치 정보가 있는 사진만 처리
                if not photo.get('location'):
                    continue

                location = photo['location']
                if not isinstance(location, dict):
                    continue

                # 지역명 생성 (city, country 순으로)
                location_name = None
                if location.get('city') and location.get('city').strip():
                    city = location['city'].strip()
                    country = location.get('country', '').strip()
                    if country:
                        location_name = f"{city}, {country}"
                    else:
                        location_name = city
                elif location.get('country') and location.get('country').strip():
                    location_name = location['country'].strip()
                else:
                    continue  # 유효한 지역 정보가 없으면 건너뛰기

                # 지역별 집계
                if location_name not in location_map:
                    location_map[location_name] = {
                        'photo_count': 0,
                        'latitudes': [],
                        'longitudes': [],
                        'dates': []
                    }

                location_map[location_name]['photo_count'] += 1

                # 좌표 정보
                if location.get('latitude') is not None:
                    location_map[location_name]['latitudes'].append(float(location['latitude']))
                if location.get('longitude') is not None:
                    location_map[location_name]['longitudes'].append(float(location['longitude']))

                # 날짜 정보 (taken_timestamp 우선, 없으면 upload_timestamp)
                photo_date = photo.get('taken_timestamp') or photo.get('upload_timestamp')
                if photo_date:
                    location_map[location_name]['dates'].append(photo_date)

            # 결과 생성
            distribution = []
            for location_name, data in location_map.items():
                avg_lat = sum(data['latitudes']) / len(data['latitudes']) if data['latitudes'] else None
                avg_lng = sum(data['longitudes']) / len(data['longitudes']) if data['longitudes'] else None

                first_date = min(data['dates']) if data['dates'] else None
                latest_date = max(data['dates']) if data['dates'] else None

                distribution.append({
                    'location_name': location_name,
                    'photo_count': data['photo_count'],
                    'avg_latitude': avg_lat,
                    'avg_longitude': avg_lng,
                    'first_photo_date': first_date,
                    'latest_photo_date': latest_date
                })

            # 사진 개수 순으로 정렬
            distribution.sort(key=lambda x: x['photo_count'], reverse=True)

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