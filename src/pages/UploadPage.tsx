import React from 'react';
import { MultiPhotoUpload } from '../components/MultiPhotoUpload';
import { PageHeader } from '../components/PageHeader';
import './UploadPage.css';

interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
}

// 다중 파일 업로드 데이터 타입 (배열)
interface FileUploadData {
  id: string;
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
}

interface UploadPageProps {
  onUpload: (data: PhotoUploadData[]) => void; // 다중 파일 지원으로 배열로 변경
  onError: (error: string) => void;
  onBackClick: () => void;
  onMapClick: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ 
  onUpload, 
  onError, 
  onBackClick,
  onMapClick
}) => {
  // FileUploadData를 PhotoUploadData 형식으로 변환하는 함수
  const handleMultiUpload = (files: FileUploadData[]) => {
    const convertedFiles: PhotoUploadData[] = files.map(file => ({
      file: file.file,
      description: file.description,
      location: file.location,
      thumbnail: file.thumbnail,
      exifData: file.exifData // EXIF 데이터 포함
    }));
    onUpload(convertedFiles);
  };

  const headerButtons = [
    {
      icon: '🏠',
      text: '홈으로',
      onClick: onBackClick,
      variant: 'secondary' as const
    },
    {
      icon: '📍',
      text: '지도 보기',
      onClick: onMapClick,
      variant: 'success' as const
    },
    {
      icon: '📤',
      text: '사진 업로드',
      onClick: () => {},
      variant: 'primary' as const,
      active: true
    }
  ];

  return (
    <div className="upload-page">
      <PageHeader 
        currentPage="upload"
        buttons={headerButtons}
      />
      <main className="upload-page-main">
        <div className="upload-container">
          <MultiPhotoUpload 
            onUpload={handleMultiUpload}
            onError={onError}
          />
        </div>
      </main>
    </div>
  );
};