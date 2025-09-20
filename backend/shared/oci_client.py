"""
OCI Object Storage 클라이언트 래퍼
Object Storage 연동 전용
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

