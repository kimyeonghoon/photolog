import React from 'react';
import { MultiPhotoUpload } from '../components/MultiPhotoUpload';
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
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
}

interface UploadPageProps {
  onUpload: (data: PhotoUploadData[]) => void; // 다중 파일 지원으로 배열로 변경
  onError: (error: string) => void;
  onBackClick: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ 
  onUpload, 
  onError, 
  onBackClick 
}) => {
  // FileUploadData를 PhotoUploadData 형식으로 변환하는 함수
  const handleMultiUpload = (files: FileUploadData[]) => {
    const convertedFiles: PhotoUploadData[] = files.map(file => ({
      file: file.file,
      description: file.description,
      location: file.location,
      thumbnail: file.thumbnail
    }));
    onUpload(convertedFiles);
  };

  return (
    <div className="upload-page">
      <header className="upload-page-header">
        <button 
          onClick={onBackClick}
          className="back-button"
        >
          ← 뒤로가기
        </button>
        <h1>📸 사진 업로드</h1>
        <p>여행의 순간을 기록해보세요</p>
      </header>

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