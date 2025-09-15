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

            # NoSQL PUT 요청 생성 - 실제로는 put_row 메서드와 간단한 딕셔너리 사용
            response = self.nosql_client.put_row(
                compartment_id=self.compartment_id,
                table_name=self.table_name,
                put_row_details=photo_data
            )

            return {
                "success": True,
                "photo_id": photo_data['photo_id'],
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
            # NoSQL GET 요청
            response = self.nosql_client.get_row(
                compartment_id=self.compartment_id,
                table_name=self.table_name,
                key={'photo_id': photo_id}
            )

            if response.data.value:
                photo_data = response.data.value

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
            # NoSQL Query 작성
            sql = f"""
            SELECT photo_id, filename, description, file_url, thumbnail_urls,
                   file_size, upload_timestamp, location, tags
            FROM {self.table_name}
            ORDER BY {order_by} {order}
            LIMIT {limit}
            """

            query_details = oci.nosql.models.QueryDetails(
                compartment_id=self.compartment_id,
                statement=sql,
                limit=limit
            )

            response = self.nosql_client.query(query_details)

            photos = []
            for item in response.data.items:
                photo_data = item

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
            # 간단한 위치 기반 필터링 (정확한 지리적 거리 계산은 추후 개선)
            sql = f"""
            SELECT photo_id, filename, description, file_url, thumbnail_urls,
                   file_size, upload_timestamp, location, tags
            FROM {self.table_name}
            WHERE location IS NOT NULL
            ORDER BY upload_timestamp DESC
            LIMIT {limit}
            """

            query_details = oci.nosql.models.QueryDetails(
                compartment_id=self.compartment_id,
                statement=sql,
                limit=limit
            )

            response = self.nosql_client.query(query_details)

            # 클라이언트 측에서 거리 필터링 (임시 구현)
            filtered_photos = []
            for item in response.data.items:
                photo_data = item

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
            response = self.nosql_client.delete_row(
                compartment_id=self.compartment_id,
                table_name=self.table_name,
                key={'photo_id': photo_id}
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