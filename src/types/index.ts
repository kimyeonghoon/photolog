// EXIF 데이터 타입
export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  lens?: string;
  [key: string]: string | number | boolean | undefined;
}

// 업로드 관련 타입
export interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// 사진 관련 타입 정의
export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  exifData?: {
    camera?: string;
    lens?: string;
    timestamp?: string;
    [key: string]: string | number | boolean | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

// 통합된 사진 데이터 타입 (로컬 + 서버 지원)
export interface UnifiedPhotoData {
  // 서버 데이터 필드
  id?: string;
  filename?: string;
  file_url?: string;
  thumbnail_urls?: {
    small?: string;
    medium?: string;
    large?: string;
  };
  file_size?: number;

  // 로컬 데이터 필드
  file?: File;
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  standardThumbnails?: { [key: string]: { dataUrl: string; width: number; height: number; size: number } };

  // 공통 필드
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  exifData?: ExifData | null;
  uploadedAt: Date;
}