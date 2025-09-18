/**
 * PhotoModal 컴포넌트
 * 사진을 모달 형태로 크게 보여주는 컴포넌트
 *
 * 주요 기능:
 * - 원본 이미지 표시 (로딩 중에는 썸네일 미리보기)
 * - 사진 메타데이터 편집 (설명, 날짜)
 * - 사진 삭제 기능 (확인 다이얼로그 포함)
 * - 키보드 네비게이션 (← → 이동, ESC 닫기)
 * - EXIF 데이터 표시 및 편집 제한 처리
 */
import React, { useEffect, useState } from 'react';
import { LocationDisplay } from './LocationDisplay';
import type { UnifiedPhotoData } from '../types';
import './PhotoModal.css';

/**
 * PhotoModal 컴포넌트 Props
 */
interface PhotoModalProps {
  photo: UnifiedPhotoData | null;           // 표시할 사진 데이터
  isOpen: boolean;                          // 모달 열림/닫힘 상태
  onClose: () => void;                      // 모달 닫기 콜백
  onPrevious?: () => void;                  // 이전 사진으로 이동 콜백
  onNext?: () => void;                      // 다음 사진으로 이동 콜백
  currentIndex?: number;                    // 현재 사진 인덱스 (x/y 표시용)
  totalCount?: number;                      // 전체 사진 개수 (x/y 표시용)
  onDelete?: (photoId: string) => void;     // 사진 삭제 콜백
  onUpdatePhoto?: (photoId: string, updates: { description?: string; travel_date?: string }) => Promise<void>; // 사진 정보 업데이트 콜백
}

export const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  currentIndex,
  totalCount,
  onDelete,
  onUpdatePhoto
}) => {
  // 이미지 로딩 관련 상태
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);  // 원본 이미지 URL
  const [isImageLoading, setIsImageLoading] = useState(false);                   // 이미지 로딩 중 여부
  const [, setImageLoadError] = useState(false);                                 // 이미지 로딩 에러 여부

  // 삭제 관련 상태
  const [isDeleting, setIsDeleting] = useState(false);                          // 삭제 진행 중 여부
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);            // 삭제 확인 다이얼로그 표시 여부

  // 편집 관련 상태
  const [isEditing, setIsEditing] = useState(false);                            // 편집 모드 여부
  const [editedDescription, setEditedDescription] = useState('');               // 편집 중인 설명
  const [editedDate, setEditedDate] = useState('');                             // 편집 중인 날짜 (YYYY-MM-DD 형식)
  const [isSaving, setIsSaving] = useState(false);                              // 저장 진행 중 여부

  /**
   * 모달 열림/닫힘 시 상태 관리
   * - 모달이 열릴 때: 원본 이미지 URL 로드, 편집 데이터 초기화
   * - 모달이 닫힐 때: 모든 상태 초기화
   */
  useEffect(() => {
    if (isOpen && photo) {
      setIsImageLoading(true);
      setImageLoadError(false);

      // 편집 데이터 초기화 - 현재 사진의 정보로 설정
      setEditedDescription(photo.description || '');
      if (photo.exifData?.timestamp) {
        // EXIF 촬영시간이 있으면 해당 날짜로 설정 (편집 불가)
        const date = new Date(photo.exifData.timestamp);
        setEditedDate(date.toISOString().split('T')[0]);
      } else {
        // EXIF 촬영시간이 없으면 빈 값으로 설정 (편집 가능)
        setEditedDate('');
      }
      setIsEditing(false);

      // 원본 이미지 URL 결정
      // 1순위: 서버의 원본 파일 URL
      // 2순위: 클라이언트 File 객체 (업로드 직후)
      const originalUrl = photo.file_url ||
                         (photo.file ? URL.createObjectURL(photo.file) : '');

      if (originalUrl) {
        // 이미지 미리 로딩으로 UX 개선
        // Image 객체를 생성하여 백그라운드에서 로딩
        const img = new Image();
        img.onload = () => {
          setOriginalImageUrl(originalUrl);
          setIsImageLoading(false);
        };
        img.onerror = () => {
          setImageLoadError(true);
          setIsImageLoading(false);
          // 원본 이미지 로딩 실패 시 썸네일을 fallback으로 사용
          // 큰 썸네일 → 중간 썸네일 → 클라이언트 썸네일 순으로 시도
          setOriginalImageUrl(
            photo.thumbnail_urls?.large ||
            photo.thumbnail_urls?.medium ||
            photo.thumbnail?.dataUrl ||
            ''
          );
        };
        img.src = originalUrl;
      } else {
        // 원본 URL이 없는 경우 (예외 상황)
        setIsImageLoading(false);
        setImageLoadError(true);
      }
    } else {
      // 모달이 닫힐 때 모든 상태 초기화
      // 메모리 누수 방지 및 다음 열림 시 깔끔한 상태 보장
      setOriginalImageUrl(null);
      setIsImageLoading(false);
      setImageLoadError(false);
      setIsEditing(false);
      setEditedDescription('');
      setEditedDate('');
    }
  }, [isOpen, photo]);

  /**
   * 키보드 이벤트 처리
   * - ESC: 모달 닫기
   * - ← →: 이전/다음 사진 네비게이션
   * - 배경 스크롤 방지
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      // 이전/다음 네비게이션은 해당 콜백이 제공된 경우에만 동작
      if (event.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      }
      if (event.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 모달이 열린 동안 배경 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    // 클린업: 이벤트 리스너 제거 및 스크롤 복원
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose, onPrevious, onNext]);

  if (!isOpen || !photo) {
    return null;
  }

  /**
   * 파일 크기를 사람이 읽기 쉬운 형태로 포맷
   * @param bytes 바이트 단위 파일 크기
   * @returns 포맷된 크기 문자열 (예: "2.5 MB")
   */
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * 날짜를 한국어 형식으로 포맷
   * @param date Date 객체
   * @returns 날짜와 시간을 분리한 객체 (예: {date: "2024년 9월 18일", time: "14:30"})
   */
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

  // 날짜 표시 우선순위: EXIF 촬영시간 > 업로드 시간
  // EXIF 데이터가 있으면 실제 촬영시간을 우선 표시
  const actualCaptureTime = photo.exifData?.timestamp
    ? new Date(photo.exifData.timestamp)
    : photo.uploadedAt;

  const dateTime = actualCaptureTime ? formatDateTime(actualCaptureTime) : '날짜 정보 없음';
  const isExifTime = !!photo.exifData?.timestamp;  // EXIF 시간 여부 (편집 가능성 판단용)

  /**
   * 삭제 버튼 클릭 핸들러
   * 즉시 삭제하지 않고 확인 다이얼로그를 표시
   */
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  /**
   * 삭제 확인 핸들러
   * 실제 삭제 API 호출 및 상태 관리
   */
  const handleDeleteConfirm = async () => {
    if (!photo || !onDelete || !photo.id) return;

    setIsDeleting(true);
    try {
      await onDelete(photo.id);
      onClose(); // 삭제 성공 시 모달 닫기
    } catch (error) {
      console.error('삭제 실패:', error);
      // TODO: 사용자에게 에러 알림 표시 개선 필요
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  /**
   * 삭제 취소 핸들러
   */
  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  /**
   * 편집 모드 토글 핸들러
   * 편집 취소 시 원래 값으로 복원
   */
  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 취소 시 원래 값으로 복원 (사용자의 변경사항 무시)
      setEditedDescription(photo?.description || '');
      if (photo?.exifData?.timestamp) {
        // EXIF 촬영시간이 있는 경우 해당 날짜로 복원
        const date = new Date(photo.exifData.timestamp);
        setEditedDate(date.toISOString().split('T')[0]);
      } else {
        // EXIF 촬영시간이 없는 경우 빈 값으로 복원
        setEditedDate('');
      }
    }
    setIsEditing(!isEditing);
  };

  /**
   * 변경사항 저장 핸들러
   * 설명과 날짜(EXIF 없는 경우만) 업데이트
   */
  const handleSaveChanges = async () => {
    if (!photo || !onUpdatePhoto || !photo.id) return;

    setIsSaving(true);
    try {
      const updates: { description?: string; travel_date?: string } = {};

      // 설명 변경사항 체크
      if (editedDescription !== photo.description) {
        updates.description = editedDescription;
      }

      // 날짜 변경사항 체크 (EXIF 촬영시간이 없는 경우에만 편집 가능)
      if (!photo.exifData?.timestamp && editedDate) {
        // 날짜만 입력된 경우 정오(12:00)로 설정
        const dateTime = new Date(editedDate + 'T12:00:00');
        updates.travel_date = dateTime.toISOString();
      } else if (!photo.exifData?.timestamp && !editedDate) {
        // 날짜를 비운 경우
        updates.travel_date = '';
      }

      // 변경사항이 있는 경우에만 API 호출
      if (Object.keys(updates).length > 0) {
        await onUpdatePhoto(photo.id, updates);
      }

      setIsEditing(false);
    } catch (error) {
      console.error('사진 정보 업데이트 실패:', error);
      // 에러 시 사용자에게 알림 (추후 토스트나 더 나은 UI로 개선 필요)
      alert('사진 정보 업데이트에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
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
            {onUpdatePhoto && !isEditing && (
              <button
                className="modal-edit-button"
                onClick={handleEditToggle}
                aria-label="사진 정보 수정"
                title="사진 정보 수정"
              >
                ✏️
              </button>
            )}
            {isEditing && (
              <>
                <button
                  className="modal-save-button"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  aria-label="변경사항 저장"
                  title="변경사항 저장"
                >
                  {isSaving ? '⏳' : '💾'}
                </button>
                <button
                  className="modal-cancel-button"
                  onClick={handleEditToggle}
                  disabled={isSaving}
                  aria-label="편집 취소"
                  title="편집 취소"
                >
                  ❌
                </button>
              </>
            )}
            {onDelete && !isEditing && (
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
              disabled={isEditing && isSaving}
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
              
              <div className="info-item">
                <span className="info-label">📝 설명:</span>
                {isEditing ? (
                  <textarea
                    className="info-edit-textarea"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder="사진 설명을 입력하세요..."
                    rows={3}
                    disabled={isSaving}
                  />
                ) : (
                  <span className="info-value">{photo.description || '설명 없음'}</span>
                )}
              </div>
              
              <div className="info-item">
                <span className="info-label">📅 {isExifTime ? '촬영 날짜' : '날짜'}:</span>
                {isEditing && !isExifTime ? (
                  <div className="info-edit-container">
                    <input
                      type="date"
                      className="info-edit-input"
                      value={editedDate}
                      onChange={(e) => setEditedDate(e.target.value)}
                      disabled={isSaving}
                    />
                    <small className="edit-hint">EXIF 촬영시간이 없어서 수정 가능합니다</small>
                  </div>
                ) : (
                  <span className="info-value">
                    {typeof dateTime === 'string' ? dateTime : `${dateTime.date} ${isExifTime ? '(EXIF)' : ''}`}
                    {isExifTime && <small className="exif-hint"> - EXIF 데이터로 수정 불가</small>}
                  </span>
                )}
              </div>

              <div className="info-item">
                <span className="info-label">⏰ {isExifTime ? '촬영 시간' : '시간'}:</span>
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