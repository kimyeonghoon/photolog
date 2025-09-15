"""
통합 스토리지 서비스 추상화 레이어
로컬 파일 시스템과 OCI Object Storage를 환경변수로 전환 가능
"""
import os
import json
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from .config import Config
from .utils import get_current_timestamp


class StorageInterface(ABC):
    """스토리지 인터페이스 추상 클래스"""

    @abstractmethod
    def upload_file(
        self,
        file_content: bytes,
        object_name: str,
        content_type: str = "image/jpeg",
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """파일 업로드"""
        pass

    @abstractmethod
    def delete_file(self, object_name: str) -> bool:
        """파일 삭제"""
        pass

    @abstractmethod
    def get_file_url(self, object_name: str) -> str:
        """파일 접근 URL 생성"""
        pass

    @abstractmethod
    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """파일 목록 조회"""
        pass


class LocalStorageService(StorageInterface):
    """로컬 파일 시스템 스토리지 서비스"""

    def __init__(self, base_path: str = "/tmp/photolog-storage", base_url: str = "http://localhost:8001/storage"):
        """
        로컬 스토리지 초기화

        Args:
            base_path: 로컬 저장 경로
            base_url: 파일 접근 기본 URL
        """
        self.base_path = base_path
        self.base_url = base_url
        self._ensure_directories()

    def _ensure_directories(self):
        """필요한 디렉토리 생성"""
        directories = [
            self.base_path,
            os.path.join(self.base_path, "photos"),
            os.path.join(self.base_path, "thumbnails"),
            os.path.join(self.base_path, "thumbnails", "small"),
            os.path.join(self.base_path, "thumbnails", "medium"),
            os.path.join(self.base_path, "thumbnails", "large")
        ]

        for directory in directories:
            os.makedirs(directory, exist_ok=True)

    def upload_file(
        self,
        file_content: bytes,
        object_name: str,
        content_type: str = "image/jpeg",
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """로컬 파일 시스템에 파일 저장"""
        try:
            # 파일 경로 생성
            file_path = os.path.join(self.base_path, object_name)

            # 디렉토리 생성
            os.makedirs(os.path.dirname(file_path), exist_ok=True)

            # 파일 저장
            with open(file_path, 'wb') as f:
                f.write(file_content)

            # 메타데이터 저장 (JSON 파일로)
            if metadata:
                metadata_path = file_path + ".meta"
                metadata_info = {
                    **metadata,
                    'content_type': content_type,
                    'file_size': len(file_content),
                    'upload_timestamp': get_current_timestamp()
                }
                with open(metadata_path, 'w') as f:
                    json.dump(metadata_info, f, ensure_ascii=False, indent=2)

            # 파일 URL 생성
            file_url = self.get_file_url(object_name)

            return {
                "success": True,
                "object_name": object_name,
                "url": file_url,
                "file_path": file_path,
                "size": len(file_content)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def delete_file(self, object_name: str) -> bool:
        """로컬 파일 삭제"""
        try:
            file_path = os.path.join(self.base_path, object_name)
            metadata_path = file_path + ".meta"

            # 원본 파일 삭제
            if os.path.exists(file_path):
                os.remove(file_path)

            # 메타데이터 파일 삭제
            if os.path.exists(metadata_path):
                os.remove(metadata_path)

            return True

        except Exception as e:
            print(f"Local file delete error: {str(e)}")
            return False

    def get_file_url(self, object_name: str) -> str:
        """로컬 파일 접근 URL 생성"""
        return f"{self.base_url}/{object_name}"

    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """로컬 파일 목록 조회"""
        try:
            files = []
            search_path = os.path.join(self.base_path, prefix) if prefix else self.base_path

            for root, dirs, filenames in os.walk(search_path):
                for filename in filenames:
                    if filename.endswith('.meta'):
                        continue  # 메타데이터 파일 제외

                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, self.base_path)

                    # 파일 정보 수집
                    stat_info = os.stat(file_path)
                    file_info = {
                        'object_name': relative_path.replace(os.sep, '/'),  # Unix 스타일 경로
                        'size': stat_info.st_size,
                        'last_modified': datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        'url': self.get_file_url(relative_path.replace(os.sep, '/'))
                    }

                    # 메타데이터 로드
                    metadata_path = file_path + ".meta"
                    if os.path.exists(metadata_path):
                        try:
                            with open(metadata_path, 'r') as f:
                                metadata = json.load(f)
                                file_info['metadata'] = metadata
                        except:
                            pass

                    files.append(file_info)

            return sorted(files, key=lambda x: x['last_modified'], reverse=True)

        except Exception as e:
            print(f"Local file list error: {str(e)}")
            return []


class OCIStorageService(StorageInterface):
    """OCI Object Storage 서비스"""

    def __init__(self):
        """OCI 스토리지 초기화"""
        try:
            from .oci_client import OCIObjectStorageClient
            self.client = OCIObjectStorageClient()
        except Exception as e:
            raise RuntimeError(f"OCI 클라이언트 초기화 실패: {str(e)}")

    def upload_file(
        self,
        file_content: bytes,
        object_name: str,
        content_type: str = "image/jpeg",
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """OCI Object Storage에 파일 업로드"""
        return self.client.upload_file(file_content, object_name, content_type, metadata)

    def delete_file(self, object_name: str) -> bool:
        """OCI Object Storage에서 파일 삭제"""
        return self.client.delete_file(object_name)

    def get_file_url(self, object_name: str) -> str:
        """OCI Object Storage 파일 URL 생성"""
        return self.client._generate_public_url(object_name)

    def list_files(self, prefix: str = "") -> List[Dict[str, Any]]:
        """OCI Object Storage 파일 목록 조회"""
        try:
            # OCI SDK를 사용한 파일 목록 조회
            list_objects_response = self.client.object_storage.list_objects(
                namespace_name=self.client.namespace,
                bucket_name=self.client.bucket_name,
                prefix=prefix
            )

            files = []
            for obj in list_objects_response.data.objects:
                file_info = {
                    'object_name': obj.name,
                    'size': obj.size,
                    'last_modified': obj.time_modified.isoformat() if obj.time_modified else None,
                    'etag': obj.etag,
                    'url': self.get_file_url(obj.name)
                }
                files.append(file_info)

            return files

        except Exception as e:
            print(f"OCI file list error: {str(e)}")
            return []


class StorageServiceFactory:
    """스토리지 서비스 팩토리"""

    @staticmethod
    def create_storage_service(storage_type: str = None) -> StorageInterface:
        """
        스토리지 서비스 생성

        Args:
            storage_type: 'LOCAL' 또는 'OCI' (None이면 환경변수에서 읽음)

        Returns:
            StorageInterface: 스토리지 서비스 인스턴스
        """
        if storage_type is None:
            storage_type = os.getenv('STORAGE_TYPE', 'LOCAL').upper()

        if storage_type == 'OCI':
            try:
                return OCIStorageService()
            except Exception as e:
                print(f"OCI 스토리지 초기화 실패, 로컬 스토리지로 fallback: {str(e)}")
                return LocalStorageService()
        else:
            return LocalStorageService()


class UnifiedStorageService:
    """통합 스토리지 서비스 (메인 인터페이스)"""

    def __init__(self, storage_type: str = None):
        """
        통합 스토리지 서비스 초기화

        Args:
            storage_type: 'LOCAL' 또는 'OCI'
        """
        self.storage = StorageServiceFactory.create_storage_service(storage_type)
        self.storage_type = type(self.storage).__name__

    def upload_photo(
        self,
        file_content: bytes,
        photo_id: str,
        file_extension: str,
        thumbnails: Optional[Dict[str, Dict]] = None,
        metadata: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        사진 및 썸네일 업로드 (통합 인터페이스)

        Args:
            file_content: 원본 파일 내용
            photo_id: 사진 ID
            file_extension: 파일 확장자 (.jpg, .png 등)
            thumbnails: 썸네일 데이터 {size: {data: bytes, width: int, height: int}}
            metadata: 추가 메타데이터

        Returns:
            Dict: 업로드 결과
        """
        try:
            results = {}

            # 원본 사진 업로드
            original_object_name = f"photos/{photo_id}{file_extension}"
            original_result = self.storage.upload_file(
                file_content=file_content,
                object_name=original_object_name,
                content_type=f"image/{file_extension[1:]}",
                metadata=metadata
            )

            if not original_result["success"]:
                return {
                    "success": False,
                    "error": f"원본 파일 업로드 실패: {original_result['error']}"
                }

            results["original"] = original_result

            # 썸네일 업로드
            thumbnail_urls = {}
            if thumbnails:
                for size, thumbnail_data in thumbnails.items():
                    thumbnail_object_name = f"thumbnails/{size}/{photo_id}_{size}.jpg"

                    thumbnail_result = self.storage.upload_file(
                        file_content=thumbnail_data["data"],
                        object_name=thumbnail_object_name,
                        content_type="image/jpeg",
                        metadata={
                            **(metadata or {}),
                            "thumbnail_size": size,
                            "original_photo_id": photo_id,
                            "width": str(thumbnail_data["width"]),
                            "height": str(thumbnail_data["height"])
                        }
                    )

                    if thumbnail_result["success"]:
                        thumbnail_urls[size] = thumbnail_result["url"]
                        results[f"thumbnail_{size}"] = thumbnail_result
                    else:
                        print(f"썸네일 {size} 업로드 실패: {thumbnail_result['error']}")

            return {
                "success": True,
                "photo_id": photo_id,
                "filename": f"{photo_id}{file_extension}",
                "file_url": original_result["url"],
                "thumbnail_urls": thumbnail_urls,
                "file_size": len(file_content),
                "storage_type": self.storage_type,
                "upload_details": results
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"사진 업로드 중 오류: {str(e)}"
            }

    def delete_photo(self, photo_id: str, file_extension: str = None) -> bool:
        """사진 및 관련 썸네일 삭제"""
        try:
            # 원본 파일 삭제
            if file_extension:
                original_deleted = self.storage.delete_file(f"photos/{photo_id}{file_extension}")
            else:
                # 확장자를 모르면 일반적인 확장자들 시도
                original_deleted = False
                for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                    if self.storage.delete_file(f"photos/{photo_id}{ext}"):
                        original_deleted = True
                        break

            # 썸네일 삭제
            thumbnail_deleted = True
            for size in ['small', 'medium', 'large']:
                if not self.storage.delete_file(f"thumbnails/{size}/{photo_id}_{size}.jpg"):
                    thumbnail_deleted = False

            return original_deleted and thumbnail_deleted

        except Exception as e:
            print(f"사진 삭제 중 오류: {str(e)}")
            return False

    def list_photos(self) -> List[Dict[str, Any]]:
        """사진 목록 조회"""
        return self.storage.list_files("photos/")

    def get_storage_info(self) -> Dict[str, Any]:
        """현재 스토리지 정보"""
        return {
            "storage_type": self.storage_type,
            "is_local": isinstance(self.storage, LocalStorageService),
            "is_oci": isinstance(self.storage, OCIStorageService)
        }


# 편의 함수들
def get_default_storage() -> UnifiedStorageService:
    """기본 스토리지 서비스 인스턴스 반환"""
    return UnifiedStorageService()

def upload_photo_with_thumbnails(
    file_content: bytes,
    photo_id: str,
    file_extension: str,
    thumbnails: Dict[str, Dict],
    metadata: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """사진과 썸네일 업로드 편의 함수"""
    storage = get_default_storage()
    return storage.upload_photo(file_content, photo_id, file_extension, thumbnails, metadata)