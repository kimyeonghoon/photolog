import React from 'react';
import { PhotoUpload } from '../components/PhotoUpload';
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

interface UploadPageProps {
  onUpload: (data: PhotoUploadData) => void;
  onError: (error: string) => void;
  onBackClick: () => void;
}

export const UploadPage: React.FC<UploadPageProps> = ({ 
  onUpload, 
  onError, 
  onBackClick 
}) => {
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
          <PhotoUpload 
            onUpload={onUpload}
            onError={onError}
          />
        </div>
      </main>
    </div>
  );
};