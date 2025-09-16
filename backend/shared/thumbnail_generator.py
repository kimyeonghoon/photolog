"""
썸네일 생성 유틸리티
다양한 크기의 썸네일을 자동 생성하는 모듈
"""
import io
from PIL import Image, ImageOps
from typing import Dict, List, Tuple, Optional
from config import Config

class ThumbnailGenerator:
    """썸네일 생성 클래스"""

    def __init__(self):
        """썸네일 생성기 초기화"""
        self.thumbnail_sizes = Config.THUMBNAIL_SIZES

    def create_thumbnails(
        self,
        image_data: bytes,
        quality: int = 85,
        optimize: bool = True
    ) -> Dict[str, Dict]:
        """
        원본 이미지에서 여러 크기의 썸네일 생성

        Args:
            image_data: 원본 이미지 바이너리 데이터
            quality: JPEG 품질 (1-100)
            optimize: 파일 크기 최적화 여부

        Returns:
            Dict: 각 크기별 썸네일 정보
            {
                'small': {
                    'data': bytes,
                    'width': int,
                    'height': int,
                    'size': int,
                    'format': str
                },
                ...
            }
        """
        try:
            # 원본 이미지 로드
            original_image = Image.open(io.BytesIO(image_data))

            # EXIF orientation 정보에 따라 회전 처리
            original_image = ImageOps.exif_transpose(original_image)

            # RGB 모드로 변환 (RGBA나 P 모드 처리)
            if original_image.mode in ('RGBA', 'P'):
                # 투명도가 있는 이미지는 흰색 배경으로 합성
                background = Image.new('RGB', original_image.size, (255, 255, 255))
                if original_image.mode == 'P':
                    original_image = original_image.convert('RGBA')
                background.paste(original_image, mask=original_image.split()[-1])
                original_image = background
            elif original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')

            thumbnails = {}

            # 각 크기별 썸네일 생성
            for size_config in self.thumbnail_sizes:
                name = size_config['name']
                target_width = size_config['width']
                target_height = size_config['height']

                thumbnail_data = self._create_single_thumbnail(
                    original_image,
                    target_width,
                    target_height,
                    quality,
                    optimize
                )

                thumbnails[name] = thumbnail_data

            return thumbnails

        except Exception as e:
            raise ValueError(f"썸네일 생성 실패: {str(e)}")

    def _create_single_thumbnail(
        self,
        image: Image.Image,
        target_width: int,
        target_height: int,
        quality: int,
        optimize: bool
    ) -> Dict:
        """
        단일 크기 썸네일 생성

        Args:
            image: PIL Image 객체
            target_width: 목표 너비
            target_height: 목표 높이
            quality: JPEG 품질
            optimize: 최적화 여부

        Returns:
            Dict: 썸네일 정보
        """
        # 원본 이미지 크기
        original_width, original_height = image.size

        # 비율 유지하면서 크기 조정
        ratio = min(target_width / original_width, target_height / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)

        # 이미지 리사이즈 (고품질 리샘플링)
        resized_image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # 중앙 정렬을 위한 캔버스 생성
        thumbnail = Image.new('RGB', (target_width, target_height), (255, 255, 255))

        # 중앙에 배치
        paste_x = (target_width - new_width) // 2
        paste_y = (target_height - new_height) // 2
        thumbnail.paste(resized_image, (paste_x, paste_y))

        # 바이너리로 변환
        output_buffer = io.BytesIO()
        thumbnail.save(
            output_buffer,
            format='JPEG',
            quality=quality,
            optimize=optimize
        )
        thumbnail_data = output_buffer.getvalue()

        return {
            'data': thumbnail_data,
            'width': target_width,
            'height': target_height,
            'size': len(thumbnail_data),
            'format': 'JPEG'
        }

    def create_smart_crop_thumbnail(
        self,
        image_data: bytes,
        target_width: int,
        target_height: int,
        quality: int = 85
    ) -> Dict:
        """
        스마트 크롭 썸네일 생성 (중요한 부분 중심으로 크롭)

        Args:
            image_data: 원본 이미지 데이터
            target_width: 목표 너비
            target_height: 목표 높이
            quality: JPEG 품질

        Returns:
            Dict: 썸네일 정보
        """
        try:
            image = Image.open(io.BytesIO(image_data))
            image = ImageOps.exif_transpose(image)

            if image.mode != 'RGB':
                image = image.convert('RGB')

            original_width, original_height = image.size
            target_ratio = target_width / target_height
            original_ratio = original_width / original_height

            if original_ratio > target_ratio:
                # 원본이 더 넓음 - 좌우 크롭
                new_width = int(original_height * target_ratio)
                left = (original_width - new_width) // 2
                cropped = image.crop((left, 0, left + new_width, original_height))
            else:
                # 원본이 더 높음 - 상하 크롭 (상단 1/3 지점 중심)
                new_height = int(original_width / target_ratio)
                top = max(0, (original_height - new_height) // 3)  # 상단 1/3 지점
                cropped = image.crop((0, top, original_width, top + new_height))

            # 목표 크기로 리사이즈
            thumbnail = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)

            # 바이너리로 변환
            output_buffer = io.BytesIO()
            thumbnail.save(output_buffer, format='JPEG', quality=quality, optimize=True)
            thumbnail_data = output_buffer.getvalue()

            return {
                'data': thumbnail_data,
                'width': target_width,
                'height': target_height,
                'size': len(thumbnail_data),
                'format': 'JPEG'
            }

        except Exception as e:
            raise ValueError(f"스마트 크롭 썸네일 생성 실패: {str(e)}")

    @staticmethod
    def validate_image_format(image_data: bytes) -> Tuple[bool, str]:
        """
        이미지 형식 검증

        Args:
            image_data: 이미지 바이너리 데이터

        Returns:
            Tuple: (유효 여부, 포맷 정보)
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                return True, img.format.lower()
        except Exception as e:
            return False, str(e)

    @staticmethod
    def get_image_info(image_data: bytes) -> Dict:
        """
        이미지 정보 조회

        Args:
            image_data: 이미지 바이너리 데이터

        Returns:
            Dict: 이미지 정보
        """
        try:
            with Image.open(io.BytesIO(image_data)) as img:
                return {
                    'format': img.format,
                    'mode': img.mode,
                    'size': img.size,
                    'width': img.size[0],
                    'height': img.size[1],
                    'has_transparency': img.mode in ('RGBA', 'LA') or 'transparency' in img.info
                }
        except Exception as e:
            raise ValueError(f"이미지 정보 조회 실패: {str(e)}")

# 편의 함수들
def create_thumbnails_from_bytes(
    image_data: bytes,
    quality: int = 85
) -> Dict[str, Dict]:
    """이미지 바이트에서 썸네일 생성"""
    generator = ThumbnailGenerator()
    return generator.create_thumbnails(image_data, quality)

def create_single_thumbnail(
    image_data: bytes,
    width: int,
    height: int,
    quality: int = 85,
    smart_crop: bool = False
) -> Dict:
    """단일 썸네일 생성"""
    generator = ThumbnailGenerator()

    if smart_crop:
        return generator.create_smart_crop_thumbnail(image_data, width, height, quality)
    else:
        # 임시로 단일 크기 설정
        original_sizes = generator.thumbnail_sizes
        generator.thumbnail_sizes = [{'name': 'custom', 'width': width, 'height': height}]

        result = generator.create_thumbnails(image_data, quality)
        generator.thumbnail_sizes = original_sizes

        return result['custom']