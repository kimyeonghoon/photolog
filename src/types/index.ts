// EXIF 데이터 타입
export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  lens?: string;
  [key: string]: any;
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
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}