"""
OCI 서비스 클라이언트 래퍼
Object Storage 및 NoSQL Database 연동
"""
import oci
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from .config import Config
from .utils import get_current_timestamp

class OCIObjectStorageClient:
    """OCI Object Storage 클라이언트"""

    def __init__(self):
        """OCI 설정을 사용하여 클라이언트 초기화"""
        try:
            # 로컬 개발 환경에서는 config 파일 사용
            self.config = oci.config.from_file()
            self.object_storage = oci.object_storage.ObjectStorageClient(self.config)
        except Exception as e:
            try:
                # Resource Principal을 사용한 인증 (OCI Functions 환경)
                signer = oci.auth.signers.get_resource_principals_signer()
                self.config = {}
                self.object_storage = oci.object_storage.ObjectStorageClient(
                    config={},
                    signer=signer
                )
            except Exception as signer_error:
                raise Exception(f"OCI 인증 실패: config 파일 오류({e}), signer 오류({signer_error})")
        self.namespace = Config.OCI_NAMESPACE
        self.bucket_name = Config.OCI_BUCKET_NAME

    def upload_file(
        self,
        file_content: bytes,
        object_name: str,
        content_type: str = "image/jpeg",
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """파일을 Object Storage에 업로드"""
        try:
            # 메타데이터 설정 (ASCII 안전하게)
            upload_metadata = {}
            if metadata:
                for key, value in metadata.items():
                    # ASCII 안전한 문자열로 변환
                    safe_key = str(key).encode('ascii', errors='ignore').decode('ascii')
                    safe_value = str(value).encode('ascii', errors='ignore').decode('ascii')
                    if safe_key and safe_value:
                        upload_metadata[safe_key] = safe_value
            upload_metadata['upload_timestamp'] = get_current_timestamp()

            # 파일 업로드 (메타데이터 없이)
            from io import BytesIO
            response = self.object_storage.put_object(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=object_name,
                put_object_body=BytesIO(file_content),
                content_type=content_type
            )

            # 업로드된 파일의 공개 URL 생성
            file_url = self._generate_public_url(object_name)

            return {
                "success": True,
                "object_name": object_name,
                "url": file_url,
                "etag": response.headers.get('etag'),
                "size": len(file_content)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _generate_public_url(self, object_name: str) -> str:
        """공개 URL 생성 (Pre-authenticated Request 또는 공개 버킷)"""
        # 실제 환경에서는 Pre-authenticated Request 또는 공개 버킷 설정 필요
        base_url = f"https://objectstorage.{Config.OCI_REGION}.oraclecloud.com"
        return f"{base_url}/n/{self.namespace}/b/{self.bucket_name}/o/{object_name}"

    def delete_file(self, object_name: str) -> bool:
        """파일 삭제"""
        try:
            self.object_storage.delete_object(
                namespace_name=self.namespace,
                bucket_name=self.bucket_name,
                object_name=object_name
            )
            return True
        except Exception as e:
            print(f"Delete error: {str(e)}")
            return False

class OCINoSQLClient:
    """OCI NoSQL Database 클라이언트"""

    def __init__(self):
        """NoSQL 클라이언트 초기화"""
        try:
            self.config = oci.config.from_file()
        except:
            signer = oci.auth.signers.get_resource_principals_signer()
            self.config = {}
            self.signer = signer

        self.nosql_client = oci.nosql.NosqlClient(
            self.config,
            signer=getattr(self, 'signer', None)
        )
        self.compartment_id = Config.NOSQL_COMPARTMENT_ID
        self.table_name = Config.NOSQL_TABLE_NAME

    def insert_photo_metadata(self, photo_data: Dict[str, Any]) -> Dict[str, Any]:
        """사진 메타데이터 삽입"""
        try:
            # NoSQL 테이블에 삽입할 데이터 준비
            row_data = {
                "id": photo_data["id"],
                "filename": photo_data["filename"],
                "description": photo_data.get("description", ""),
                "file_url": photo_data["file_url"],
                "thumbnail_url": photo_data.get("thumbnail_url", ""),
                "file_size": photo_data["file_size"],
                "content_type": photo_data["content_type"],
                "upload_timestamp": photo_data["upload_timestamp"],
                "exif_data": json.dumps(photo_data.get("exif_data", {})),
                "location": photo_data.get("location", {}),
                "tags": photo_data.get("tags", [])
            }

            # NoSQL 쿼리 실행
            query_request = oci.nosql.models.QueryRequest(
                compartment_id=self.compartment_id,
                statement=f"INSERT INTO {self.table_name} VALUE {json.dumps(row_data)}"
            )

            response = self.nosql_client.query(query_request)

            return {
                "success": True,
                "photo_id": photo_data["id"],
                "query_result": response.data
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_photo_list(
        self,
        limit: int = 50,
        offset: int = 0,
        order_by: str = "upload_timestamp DESC"
    ) -> Dict[str, Any]:
        """사진 목록 조회"""
        try:
            query = f"""
                SELECT * FROM {self.table_name}
                ORDER BY {order_by}
                LIMIT {limit} OFFSET {offset}
            """

            query_request = oci.nosql.models.QueryRequest(
                compartment_id=self.compartment_id,
                statement=query
            )

            response = self.nosql_client.query(query_request)

            photos = []
            for row in response.data.items:
                photo = dict(row.value)
                # JSON 문자열을 다시 객체로 변환
                if 'exif_data' in photo:
                    photo['exif_data'] = json.loads(photo['exif_data'])
                photos.append(photo)

            return {
                "success": True,
                "photos": photos,
                "count": len(photos)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def get_photo_by_id(self, photo_id: str) -> Dict[str, Any]:
        """특정 사진 조회"""
        try:
            query = f"SELECT * FROM {self.table_name} WHERE id = '{photo_id}'"

            query_request = oci.nosql.models.QueryRequest(
                compartment_id=self.compartment_id,
                statement=query
            )

            response = self.nosql_client.query(query_request)

            if response.data.items:
                photo = dict(response.data.items[0].value)
                if 'exif_data' in photo:
                    photo['exif_data'] = json.loads(photo['exif_data'])

                return {
                    "success": True,
                    "photo": photo
                }
            else:
                return {
                    "success": False,
                    "error": "Photo not found"
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }