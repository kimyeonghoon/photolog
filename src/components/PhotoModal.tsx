import React, { useEffect } from 'react';
import { LocationDisplay } from './LocationDisplay';
import './PhotoModal.css';

interface StoredPhotoData {
  file: File;
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  uploadedAt: Date;
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
}

interface PhotoModalProps {
  photo: StoredPhotoData | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  currentIndex,
  totalCount
}) => {
  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      }
      if (event.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 배경 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, onPrevious, onNext]);

  if (!isOpen || !photo) {
    return null;
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDateTime = (date: Date) => {
    return {
      date: date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };
  };

  // EXIF 촬영시간이 있으면 우선 사용, 없으면 업로드 시간 사용
  const actualCaptureTime = photo.exifData?.timestamp 
    ? new Date(photo.exifData.timestamp) 
    : photo.uploadedAt;
  
  const dateTime = formatDateTime(actualCaptureTime);
  const isExifTime = !!photo.exifData?.timestamp;
  

  return (
    <div className="photo-modal-overlay" onClick={onClose}>
      <div className="photo-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="photo-modal-header">
          <div className="modal-title">
            {currentIndex !== undefined && totalCount !== undefined && (
              <span className="photo-counter">{currentIndex + 1} / {totalCount}</span>
            )}
          </div>
          <button 
            className="modal-close-button"
            onClick={onClose}
            aria-label="모달 닫기"
          >
            ✕
          </button>
        </div>

        {/* 이미지 */}
        <div className="photo-modal-content">
          <div className="photo-modal-image-container">
            {onPrevious && (
              <button 
                className="modal-nav-button modal-prev"
                onClick={onPrevious}
                aria-label="이전 사진"
              >
                ‹
              </button>
            )}
            
            <img 
              src={URL.createObjectURL(photo.file)}
              alt={photo.description || '사진'}
              className="photo-modal-image"
            />
            
            {onNext && (
              <button 
                className="modal-nav-button modal-next"
                onClick={onNext}
                aria-label="다음 사진"
              >
                ›
              </button>
            )}
          </div>

          {/* 사진 정보 */}
          <div className="photo-modal-info">
            <div className="photo-info-section">
              <h3>사진 정보</h3>
              
              {photo.description && (
                <div className="info-item">
                  <span className="info-label">📝 설명:</span>
                  <span className="info-value">{photo.description}</span>
                </div>
              )}
              
              <div className="info-item">
                <span className="info-label">📅 {isExifTime ? '촬영 날짜' : '업로드 날짜'}:</span>
                <span className="info-value">{dateTime.date} {isExifTime && '(EXIF)'}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">⏰ {isExifTime ? '촬영 시간' : '업로드 시간'}:</span>
                <span className="info-value">{dateTime.time} {isExifTime && '(EXIF)'}</span>
              </div>
              
              <div className="info-item">
                <span className="info-label">📁 파일 크기:</span>
                <span className="info-value">{formatFileSize(photo.file.size)}</span>
              </div>
              
              {photo.location && (
                <div className="info-item">
                  <span className="info-label">📍 위치:</span>
                  <span className="info-value">
                    <LocationDisplay 
                      latitude={photo.location.latitude}
                      longitude={photo.location.longitude}
                      showIcon={false}
                    />
                  </span>
                </div>
              )}
              
              {photo.thumbnail && (
                <div className="info-item">
                  <span className="info-label">🖼️ 썸네일:</span>
                  <span className="info-value">
                    {photo.thumbnail.width}×{photo.thumbnail.height} ({formatFileSize(photo.thumbnail.size)})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 네비게이션 힌트 */}
        <div className="photo-modal-footer">
          <div className="navigation-hint">
            <span>💡 키보드: ← → 이동, ESC 닫기</span>
          </div>
        </div>
      </div>
    </div>
  );
};