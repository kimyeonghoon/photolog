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
from .database_client import get_database_client


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
            storage_type = os.getenv('STORAGE_TYPE', 'OCI').upper()

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

        # 데이터베이스 클라이언트 초기화
        self.db_client = None
        try:
            self.db_client = get_database_client()
        except Exception as e:
            print(f"데이터베이스 클라이언트 초기화 실패: {e}")

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

            # 썸네일 처리 및 업로드
            thumbnail_urls = {}

            # 썸네일이 비어있거나 없으면 자동 생성 (프론트엔드 썸네일 우선)
            if not thumbnails or len(thumbnails) == 0:
                print("🔧 프론트엔드 썸네일이 없어서 백엔드에서 자동 생성합니다")
            else:
                print(f"✅ 프론트엔드 썸네일 사용: {list(thumbnails.keys())}")

            if not thumbnails or len(thumbnails) == 0:
                try:
                    from .thumbnail_generator import ThumbnailGenerator
                    thumbnail_generator = ThumbnailGenerator()
                    generated_thumbnails = thumbnail_generator.create_thumbnails(file_content)

                    # 생성된 썸네일을 적절한 형식으로 변환
                    thumbnails = {}
                    for size, thumb_info in generated_thumbnails.items():
                        thumbnails[size] = {
                            'data': thumb_info['data'],
                            'width': thumb_info['width'],
                            'height': thumb_info['height']
                        }
                    print(f"✅ 자동 썸네일 생성 완료: {list(thumbnails.keys())}")

                except Exception as e:
                    print(f"⚠️ 썸네일 자동 생성 실패: {str(e)}")
                    thumbnails = {}

            # 썸네일 업로드 (경로 수정)
            if thumbnails:
                for size, thumbnail_data in thumbnails.items():
                    thumbnail_object_name = f"thumbnails/{photo_id}_{size}.jpg"

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

            # 업로드 결과
            upload_result = {
                "success": True,
                "photo_id": photo_id,
                "filename": f"{photo_id}{file_extension}",
                "file_url": original_result["url"],
                "thumbnail_urls": thumbnail_urls,
                "file_size": len(file_content),
                "storage_type": self.storage_type,
                "upload_details": results
            }

            # 데이터베이스에 메타데이터 저장
            if self.db_client:
                try:
                    # MySQL 스키마에 맞게 데이터 변환
                    location_data = metadata.get("location") if metadata else None
                    exif_data = metadata.get("exif_data") if metadata else {}

                    db_data = {
                        "id": photo_id,
                        "filename": f"{photo_id}{file_extension}",
                        "description": metadata.get("description", "") if metadata else "",
                        "file_url": original_result["url"],
                        "file_size": len(file_content),
                        "content_type": f"image/{file_extension[1:]}",
                        "upload_timestamp": get_current_timestamp(),

                        # 개별 썸네일 URL 컬럼들
                        "thumbnail_small": thumbnail_urls.get("small"),
                        "thumbnail_medium": thumbnail_urls.get("medium"),
                        "thumbnail_large": thumbnail_urls.get("large"),

                        # 위치 정보 (개별 컬럼)
                        "latitude": location_data.get("latitude") if location_data else None,
                        "longitude": location_data.get("longitude") if location_data else None,
                        "location_address": location_data.get("address") if location_data else None,
                        "location_city": location_data.get("city") if location_data else None,
                        "location_country": location_data.get("country") if location_data else None,

                        # EXIF 정보 (개별 컬럼)
                        "camera_make": exif_data.get("make"),
                        "camera_model": exif_data.get("model"),
                        "taken_timestamp": exif_data.get("datetime"),
                        "iso_speed": exif_data.get("iso"),
                        "aperture": exif_data.get("aperture"),
                        "shutter_speed": exif_data.get("shutter_speed"),
                        "focal_length": exif_data.get("focal_length"),

                        # JSON 컬럼들 (호환성을 위해)
                        "thumbnail_urls": thumbnail_urls,
                        "location": location_data,
                        "exif_data": exif_data,
                        "tags": metadata.get("tags", []) if metadata else []
                    }

                    db_result = self.db_client.save_photo_metadata(db_data)
                    upload_result["db_saved"] = db_result["success"]

                    if not db_result["success"]:
                        print(f"데이터베이스 저장 실패: {db_result.get('error')}")

                except Exception as e:
                    print(f"데이터베이스 저장 중 오류: {e}")
                    upload_result["db_saved"] = False

            return upload_result

        except Exception as e:
            return {
                "success": False,
                "error": f"사진 업로드 중 오류: {str(e)}"
            }

    def list_photos(
        self,
        limit: int = 20,
        page: Optional[str] = None,
        order_by: str = 'upload_timestamp',
        order: str = 'DESC'
    ) -> Dict[str, Any]:
        """
        사진 목록 조회 (Object Storage 기반으로 임시 구현)

        Args:
            limit: 조회할 개수
            page: 페이지 토큰
            order_by: 정렬 기준
            order: 정렬 순서 (ASC/DESC)

        Returns:
            사진 목록과 페이지 정보
        """
        try:
            # Object Storage에서 직접 파일 목록 가져오기
            files = self.storage.list_files("photos/")

            # 썸네일 파일 목록도 가져오기 (존재 여부 확인용)
            thumbnail_files = self.storage.list_files("thumbnails/")
            existing_thumbnails = {}  # photo_id -> {size: url} 매핑

            for thumb_file in thumbnail_files:
                # thumbnails/photo_id_size.jpg -> photo_id 추출
                object_name = thumb_file.get('object_name', '')
                if object_name.startswith('thumbnails/'):
                    filename = object_name.split('/')[-1]  # photo_id_size.jpg
                    name_parts = filename.split('_')  # [photo_id, size.jpg]
                    if len(name_parts) >= 2:
                        photo_id = name_parts[0]
                        size_with_ext = '_'.join(name_parts[1:])  # size.jpg
                        size = size_with_ext.split('.')[0]  # size

                        if photo_id not in existing_thumbnails:
                            existing_thumbnails[photo_id] = {}

                        # URL 생성
                        base_url = thumb_file.get('url', '').replace(f'/o/{object_name}', '/o')
                        existing_thumbnails[photo_id][size] = f"{base_url}/{object_name}"

            # 파일 정보를 사진 목록 형태로 변환
            photos = []
            for file_info in files[:limit]:  # limit 적용
                # 파일명에서 photo_id 추출
                object_name = file_info.get('object_name', '')
                if object_name.startswith('photos/'):
                    filename = object_name.split('/')[-1]
                    photo_id = filename.split('.')[0]

                    # 썸네일 URL 구성 (실제 존재하는 경우만)
                    thumbnail_urls = existing_thumbnails.get(photo_id, {})

                    photo_data = {
                        "photo_id": photo_id,
                        "filename": filename,
                        "description": "",  # Object Storage에서는 설명이 없음
                        "file_url": file_info.get('url', ''),
                        "thumbnail_urls": thumbnail_urls,
                        "file_size": file_info.get('size', 0),
                        "upload_timestamp": file_info.get('last_modified', ''),
                        "location": None,
                        "exif_data": {},
                        "tags": []
                    }
                    photos.append(photo_data)

            return {
                "success": True,
                "photos": photos,
                "page_info": {
                    "current_page": page,
                    "next_page": None,
                    "count": len(photos),
                    "limit": limit
                }
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"사진 목록 조회 중 오류: {str(e)}",
                "photos": [],
                "page_info": None
            }

    def get_photo_metadata(self, photo_id: str) -> Optional[Dict[str, Any]]:
        """
        특정 사진의 메타데이터 조회

        Args:
            photo_id: 사진 ID

        Returns:
            사진 메타데이터 또는 None
        """
        if not self.db_client:
            return None

        try:
            return self.db_client.get_photo_metadata(photo_id)
        except Exception as e:
            print(f"사진 메타데이터 조회 오류: {e}")
            return None

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
        if not self.db_client:
            return {
                "success": False,
                "error": "데이터베이스 클라이언트가 초기화되지 않았습니다",
                "photos": [],
                "search_params": None
            }

        try:
            return self.db_client.search_photos_by_location(latitude, longitude, radius_km, limit)
        except Exception as e:
            return {
                "success": False,
                "error": f"위치 기반 검색 중 오류: {str(e)}",
                "photos": [],
                "search_params": None
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