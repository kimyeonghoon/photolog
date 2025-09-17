import React, { useEffect, useState } from 'react';
import { LocationDisplay } from './LocationDisplay';
import type { UnifiedPhotoData } from '../types';
import './PhotoModal.css';

interface PhotoModalProps {
  photo: UnifiedPhotoData | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
  onDelete?: (photoId: string) => void;
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
  onDelete
}) => {
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [, setImageLoadError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 모달이 열릴 때 원본 이미지 URL 로드
  useEffect(() => {
    if (isOpen && photo) {
      setIsImageLoading(true);
      setImageLoadError(false);

      // 원본 이미지 URL 결정
      const originalUrl = photo.file_url ||
                         (photo.file ? URL.createObjectURL(photo.file) : '');

      if (originalUrl) {
        // 이미지 미리 로딩
        const img = new Image();
        img.onload = () => {
          setOriginalImageUrl(originalUrl);
          setIsImageLoading(false);
        };
        img.onerror = () => {
          setImageLoadError(true);
          setIsImageLoading(false);
          // 에러 시 썸네일 URL을 fallback으로 사용
          setOriginalImageUrl(
            photo.thumbnail_urls?.large ||
            photo.thumbnail_urls?.medium ||
            photo.thumbnail?.dataUrl ||
            ''
          );
        };
        img.src = originalUrl;
      } else {
        setIsImageLoading(false);
        setImageLoadError(true);
      }
    } else {
      // 모달이 닫힐 때 상태 초기화
      setOriginalImageUrl(null);
      setIsImageLoading(false);
      setImageLoadError(false);
    }
  }, [isOpen, photo]);

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

  const dateTime = actualCaptureTime ? formatDateTime(actualCaptureTime) : '날짜 정보 없음';
  const isExifTime = !!photo.exifData?.timestamp;

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!photo || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(photo.id);
      onClose(); // 삭제 성공 시 모달 닫기
    } catch (error) {
      console.error('삭제 실패:', error);
      // 여기서 에러 알림을 표시할 수 있습니다
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };
  

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
          <div className="modal-actions">
            {onDelete && (
              <button
                className="modal-delete-button"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                aria-label="사진 삭제"
                title="사진 삭제"
              >
                {isDeleting ? '⏳' : '🗑️'}
              </button>
            )}
            <button
              className="modal-close-button"
              onClick={onClose}
              aria-label="모달 닫기"
            >
              ✕
            </button>
          </div>
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
            
            {isImageLoading ? (
              <div className="image-loading-placeholder">
                <div className="loading-spinner"></div>
                <div className="loading-text">원본 이미지 로딩 중...</div>
                {/* 로딩 중에는 썸네일을 미리보기로 표시 */}
                <img
                  src={
                    photo.thumbnail_urls?.large ||
                    photo.thumbnail_urls?.medium ||
                    photo.thumbnail?.dataUrl ||
                    ''
                  }
                  alt={photo.description || '사진 썸네일'}
                  className="photo-modal-image loading-preview"
                  style={{ opacity: 0.7, filter: 'blur(1px)' }}
                />
              </div>
            ) : (
              <img
                src={originalImageUrl ||
                     photo.thumbnail_urls?.large ||
                     photo.thumbnail_urls?.medium ||
                     photo.thumbnail?.dataUrl ||
                     ''}
                alt={photo.description || '사진'}
                className="photo-modal-image"
              />
            )}
            
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
                <span className="info-value">
                  {typeof dateTime === 'string' ? dateTime : `${dateTime.date} ${isExifTime ? '(EXIF)' : ''}`}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">⏰ {isExifTime ? '촬영 시간' : '업로드 시간'}:</span>
                <span className="info-value">
                  {typeof dateTime === 'string' ? '' : `${dateTime.time} ${isExifTime ? '(EXIF)' : ''}`}
                </span>
              </div>
              
              <div className="info-item">
                <span className="info-label">📁 파일 크기:</span>
                <span className="info-value">{formatFileSize(photo.file?.size || photo.file_size || 0)}</span>
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

        {/* 삭제 확인 다이얼로그 */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay" onClick={handleDeleteCancel}>
            <div className="delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="delete-confirm-header">
                <h3>사진 삭제 확인</h3>
              </div>
              <div className="delete-confirm-content">
                <div className="delete-photo-preview">
                  <img
                    src={
                      photo.thumbnail_urls?.small ||
                      photo.thumbnail?.dataUrl ||
                      photo.file_url
                    }
                    alt="삭제할 사진"
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      margin: '0 auto 16px'
                    }}
                  />
                </div>
                <p><strong>이 사진을 정말 삭제하시겠습니까?</strong></p>
                {photo.description && (
                  <p style={{ fontStyle: 'italic', opacity: 0.8 }}>
                    "{photo.description}"
                  </p>
                )}
                <p className="delete-warning">
                  ⚠️ <strong>삭제된 사진은 복구할 수 없습니다.</strong>
                </p>
              </div>
              <div className="delete-confirm-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  style={{ marginRight: '8px' }}
                >
                  ❌ 취소
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  style={{ fontWeight: 'bold' }}
                >
                  {isDeleting ? '🗑️ 삭제 중...' : '🗑️ 삭제하기'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};