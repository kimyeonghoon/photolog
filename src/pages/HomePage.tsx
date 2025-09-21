import React, { useState, useEffect, useRef } from 'react';
import { PhotoModal } from '../components/PhotoModal';
import { StatsChart } from '../components/StatsChart';
import { LocationDisplay } from '../components/LocationDisplay';
import LocationDistribution from '../components/LocationDistribution';
import { PageHeader } from '../components/PageHeader';
import { deleteSinglePhoto, deleteMultiplePhotos, updatePhoto } from '../services/photoAPI';
import type { UnifiedPhotoData } from '../types';
import './HomePage.css';

interface HomePageProps {
  photos: UnifiedPhotoData[];
  onUploadClick: () => void;
  onMapClick: () => void;
  onPhotoDeleted?: (photoId: string) => void;
  onPhotoUpdated?: (photoId: string, updates: { description?: string; timestamp?: string }) => void;
  pagination?: {
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
  };
  authState?: {
    isAuthenticated: boolean;
    onLoginClick: () => void;
  };
  statsData?: {
    total_photos: number;
    photos_with_location: number;
    photos_with_description: number;
    location_percentage: number;
    description_percentage: number;
    total_size: number;
    first_photo_date?: string;
    latest_photo_date?: string;
    this_month_photos?: number;
  } | null;
  sortOrder?: 'newest' | 'oldest';
  onSortOrderChange?: (order: 'newest' | 'oldest') => void;
  authToken?: string | null;
}

export const HomePage: React.FC<HomePageProps> = ({ photos, onUploadClick, onMapClick, onPhotoDeleted, onPhotoUpdated, pagination, authState, statsData, sortOrder = 'newest', onSortOrderChange, authToken }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // 무한스크롤을 위한 ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 무한스크롤 IntersectionObserver 설정
  useEffect(() => {
    if (!pagination?.hasMore || pagination.isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && pagination.onLoadMore) {
          pagination.onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [pagination?.hasMore, pagination?.isLoadingMore, pagination?.onLoadMore]);

  const handlePhotoClick = (index: number) => {
    if (isSelectionMode) {
      // 선택 모드에서는 사진 선택/해제
      const photo = sortedPhotos[index];
      if (!photo.id) return;

      const newSelected = new Set(selectedPhotos);
      if (newSelected.has(photo.id)) {
        newSelected.delete(photo.id);
      } else {
        newSelected.add(photo.id);
      }
      setSelectedPhotos(newSelected);
    } else {
      // 일반 모드에서는 모달 열기
      setSelectedPhotoIndex(index);
    }
  };

  /**
   * 모달 닫기 핸들러
   */
  const handleModalClose = () => {
    setSelectedPhotoIndex(null);
  };

  /**
   * 이전 사진으로 이동 핸들러
   */
  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  /**
   * 다음 사진으로 이동 핸들러
   */
  const handleNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < sortedPhotos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  /**
   * 사진 정렬 순서 변경 핸들러
   * @param order 정렬 순서 ('newest' | 'oldest')
   */
  const handleSortChange = (order: 'newest' | 'oldest') => {
    if (onSortOrderChange) {
      onSortOrderChange(order);
    }
  };

  /**
   * 단일 사진 삭제 핸들러 (PhotoModal에서 호출)
   * 인증 체크 후 사진 삭제 수행
   * @param photoId 삭제할 사진 ID
   */
  const handlePhotoDelete = async (photoId: string) => {
    // 인증 체크 - 로그인되지 않은 경우 로그인 페이지로 이동
    if (!authState?.isAuthenticated) {
      authState?.onLoginClick();
      return;
    }

    try {
      await deleteSinglePhoto(photoId);
      if (onPhotoDeleted) {
        onPhotoDeleted(photoId);  // 상위 컴포넌트에 삭제 완료 알림
      }
    } catch (error) {
      console.error('사진 삭제 실패:', error);
      throw error; // PhotoModal에서 에러 처리를 위해 재던짐
    }
  };

  /**
   * 사진 메타데이터 업데이트 핸들러 (PhotoModal에서 호출)
   * @param photoId 업데이트할 사진 ID
   * @param updates 변경할 데이터 (설명, 여행날짜)
   */
  const handlePhotoUpdate = async (photoId: string, updates: { description?: string; travel_date?: string }) => {
    try {
      await updatePhoto(photoId, updates);
      if (onPhotoUpdated) {
        onPhotoUpdated(photoId, updates);  // 상위 컴포넌트에 업데이트 완료 알림
      }
    } catch (error) {
      console.error('사진 업데이트 실패:', error);
      throw error; // PhotoModal에서 에러 처리를 위해 재던짐
    }
  };

  /**
   * 다중 선택 모드 토글 핸들러
   */
  const handleSelectionModeToggle = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedPhotos(new Set()); // 선택 모드 전환 시 선택 초기화
  };

  /**
   * 전체 선택/해제 핸들러
   * 모든 사진이 선택된 경우 해제, 아니면 전체 선택
   */
  const handleSelectAll = () => {
    if (selectedPhotos.size === sortedPhotos.length) {
      // 모든 사진이 선택되어 있으면 전체 선택 해제
      setSelectedPhotos(new Set());
    } else {
      // 전체 선택 - ID가 있는 사진만 선택
      const allPhotoIds = new Set(sortedPhotos.map(photo => photo.id).filter((id): id is string => id !== undefined));
      setSelectedPhotos(allPhotoIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotos.size === 0) return;

    // 인증 체크
    if (!authState?.isAuthenticated) {
      authState?.onLoginClick();
      return;
    }

    const confirmed = window.confirm(
      `선택한 ${selectedPhotos.size}장의 사진을 삭제하시겠습니까?\n⚠️ 삭제된 사진은 복구할 수 없습니다.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const photoIds = Array.from(selectedPhotos);
      const results = await deleteMultiplePhotos(photoIds);

      // 성공적으로 삭제된 사진들을 알림
      const successfulDeletes = results.filter(result => result.success);

      if (onPhotoDeleted && successfulDeletes.length > 0) {
        successfulDeletes.forEach(result => {
          onPhotoDeleted(result.photo_id);
        });
      }

      // 삭제 완료 후 선택 모드 해제
      setIsSelectionMode(false);
      setSelectedPhotos(new Set());

      // 결과 알림
      if (successfulDeletes.length === photoIds.length) {
        alert(`${successfulDeletes.length}장의 사진이 성공적으로 삭제되었습니다.`);
      } else {
        const failedCount = photoIds.length - successfulDeletes.length;
        alert(`${successfulDeletes.length}장 삭제 성공, ${failedCount}장 삭제 실패`);
      }

    } catch (error) {
      console.error('다중 사진 삭제 실패:', error);
      alert('사진 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 실제 촬영시간 또는 업로드 시간을 가져오는 함수
  const getPhotoTime = (photo: UnifiedPhotoData): Date => {
    // EXIF 촬영시간이 있으면 우선 사용
    if (photo.exifData?.timestamp) {
      try {
        return new Date(photo.exifData.timestamp);
      } catch (error) {
        console.warn('EXIF timestamp 파싱 실패:', photo.exifData.timestamp, error);
      }
    }
    // EXIF 촬영시간이 없으면 업로드 시간 사용
    return new Date(photo.uploadedAt || Date.now());
  };

  // 서버에서 이미 정렬된 순서를 그대로 사용
  const sortedPhotos = photos;

  // 통계 계산 - API 데이터 우선, fallback으로 로컬 계산
  const getPhotoStats = () => {
    // API에서 가져온 통계 데이터가 있으면 사용
    if (statsData) {
      return {
        totalPhotos: statsData.total_photos,
        photosWithLocation: statsData.photos_with_location,
        photosWithDescription: statsData.photos_with_description,
        locationPercentage: statsData.location_percentage,
        descriptionPercentage: statsData.description_percentage,
        totalSize: statsData.total_size,
        thisMonthPhotos: statsData.this_month_photos || 0,
        // 날짜 데이터는 별도로 처리
        firstPhotoDate: statsData.first_photo_date,
        latestPhotoDate: statsData.latest_photo_date
      };
    }

    // Fallback: 로컬 데이터 기반 통계 계산
    if (photos.length === 0) return null;

    const totalPhotos = photos.length;
    const photosWithLocation = photos.filter(p => p.location).length;
    const photosWithDescription = photos.filter(p => p.description && p.description.trim()).length;

    // 최근 촬영/업로드 날짜
    const latestPhoto = photos.reduce((latest, photo) =>
      getPhotoTime(photo) > getPhotoTime(latest) ? photo : latest
    );

    // 첫 촬영/업로드 날짜
    const firstPhoto = photos.reduce((earliest, photo) =>
      getPhotoTime(photo) < getPhotoTime(earliest) ? photo : earliest
    );

    // 총 파일 크기 (서버 데이터는 file_size 사용, 로컬 데이터는 file.size 사용)
    const totalSize = photos.reduce((sum, photo) => {
      const fileSize = photo.file_size || photo.serverData?.fileSize || photo.file?.size || 0;
      return sum + fileSize;
    }, 0);

    // 이번 달 업로드 수
    const thisMonth = new Date();
    const thisMonthPhotos = photos.filter(photo => {
      const photoDate = new Date(photo.uploadedAt || Date.now());
      return photoDate.getMonth() === thisMonth.getMonth() &&
             photoDate.getFullYear() === thisMonth.getFullYear();
    }).length;

    return {
      totalPhotos,
      photosWithLocation,
      photosWithDescription,
      totalSize,
      thisMonthPhotos,
      locationPercentage: Math.round((photosWithLocation / totalPhotos) * 100),
      descriptionPercentage: Math.round((photosWithDescription / totalPhotos) * 100),
      // Fallback에서는 날짜 문자열로 반환
      firstPhotoDate: getPhotoTime(firstPhoto).toISOString(),
      latestPhotoDate: getPhotoTime(latestPhoto).toISOString()
    };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const stats = getPhotoStats();

  const headerButtons = [
    {
      icon: '🏠',
      text: '홈',
      onClick: () => {},
      variant: 'secondary' as const,
      active: true
    },
    {
      icon: '📤',
      text: '업로드',
      onClick: onUploadClick,
      variant: 'primary' as const
    },
    {
      icon: '📍',
      text: '지도',
      onClick: onMapClick,
      variant: 'success' as const
    }
  ];

  return (
    <div className="homepage">
      <PageHeader 
        currentPage="home"
        buttons={headerButtons}
      />

      <main className="homepage-main">
        {/* 통계 섹션 */}
        {stats && (
          <div className="stats-section">
            <div className="stats-container">
              <div className="stats-header">
                <h2>📊 포토로그 통계</h2>
              </div>
              
              <div className="stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon">📸</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.totalPhotos}</div>
                    <div className="stat-label">총 사진</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📅</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.thisMonthPhotos}</div>
                    <div className="stat-label">이번 달</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">📍</div>
                  <div className="stat-content">
                    <div className="stat-number">{stats.locationPercentage}%</div>
                    <div className="stat-label">위치 정보</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">💾</div>
                  <div className="stat-content">
                    <div className="stat-number">{formatFileSize(stats.totalSize)}</div>
                    <div className="stat-label">총 용량</div>
                  </div>
                </div>
              </div>

              <div className="stats-details">
                <div className="detail-item">
                  <span className="detail-label">🎯 설명이 있는 사진:</span>
                  <span className="detail-value">{stats.photosWithDescription}장 ({stats.descriptionPercentage}%)</span>
                </div>
                
                <div className="detail-item">
                  <span className="detail-label">📅 처음 촬영:</span>
                  <span className="detail-value">
                    {stats.firstPhotoDate ? new Date(stats.firstPhotoDate).toLocaleDateString('ko-KR') : 'N/A'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">🕒 최근 촬영:</span>
                  <span className="detail-value">
                    {stats.latestPhotoDate ? new Date(stats.latestPhotoDate).toLocaleDateString('ko-KR') : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상세 통계 차트 */}
        {photos.length > 0 && (
          <StatsChart photos={photos} />
        )}

        {/* 지역별 사진 분포 */}
        <LocationDistribution authToken={authToken || null} />

        {photos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-animation">
              <div className="floating-icons">
                <span className="floating-icon">📷</span>
                <span className="floating-icon">🌍</span>
                <span className="floating-icon">✈️</span>
                <span className="floating-icon">🏔️</span>
                <span className="floating-icon">🌅</span>
              </div>
            </div>
            
            <div className="empty-content">
              <h3>여행의 순간을 기록해보세요</h3>
              <p>아직 업로드된 사진이 없습니다<br/>첫 번째 추억을 만들어보세요! 🎉</p>
              
              <div className="empty-features">
                <div className="feature-item">
                  <span className="feature-icon">📸</span>
                  <span>사진 업로드</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">📍</span>
                  <span>위치 정보</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🖼️</span>
                  <span>썸네일 생성</span>
                </div>
              </div>
              
              <button 
                onClick={onUploadClick}
                className="btn btn-primary btn-xl"
              >
                <span className="button-icon">➕</span>
                첫 번째 사진 업로드하기
              </button>
              
              <div className="empty-hint">
                <p>💡 팁: JPEG, PNG, HEIC 파일을 지원하며, EXIF 데이터에서 위치 정보를 자동으로 추출합니다</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="photos-section">
            <div className="section-header">
              <div className="header-content">
                <div className="header-left">
                  <h2>포토로그 ({stats?.totalPhotos || photos.length}장)</h2>
                </div>

                <div className="header-right">
                  {!isSelectionMode ? (
                    <>
                      {/* 정렬 컨트롤 */}
                      <div className="sort-controls">
                        <button
                          className={`btn btn-sm ${sortOrder === 'newest' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleSortChange('newest')}
                        >
                          🕒 최신순
                        </button>
                        <button
                          className={`btn btn-sm ${sortOrder === 'oldest' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleSortChange('oldest')}
                        >
                          📅 오래된순
                        </button>
                      </div>

                      {/* 구분선 */}
                      <div className="divider"></div>

                      {/* 관리 모드 */}
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={handleSelectionModeToggle}
                        title="사진 선택하여 삭제하기"
                      >
                        ☑️ 선택
                      </button>
                    </>
                  ) : (
                    <div className="selection-controls">
                      <span className="selection-count">
                        {selectedPhotos.size}장 선택됨
                      </span>
                      <div className="selection-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={handleSelectAll}
                        >
                          {selectedPhotos.size === sortedPhotos.length ? '전체 해제' : '전체 선택'}
                        </button>
                        {selectedPhotos.size > 0 && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={handleDeleteSelected}
                            disabled={isDeleting}
                          >
                            {isDeleting ? '삭제 중...' : `${selectedPhotos.size}장 삭제`}
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={handleSelectionModeToggle}
                        >
                          완료
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="photos-grid">
              {sortedPhotos.map((photo, index) => (
                <div
                  key={index}
                  className={`photo-card ${isSelectionMode ? 'selection-mode' : ''} ${
                    photo.id && selectedPhotos.has(photo.id) ? 'selected' : ''
                  }`}
                  onClick={() => handlePhotoClick(index)}
                >
                  <div className="photo-image">
                    <img
                      src={
                        photo.thumbnail_urls?.medium ||
                        photo.thumbnail?.dataUrl ||
                        photo.thumbnail_urls?.small ||
                        (photo.file ? URL.createObjectURL(photo.file) : '') ||
                        photo.file_url
                      }
                      alt={photo.description || '여행 사진'}
                      loading="lazy"
                    />
                    <div className="photo-overlay">
                      {isSelectionMode ? (
                        <div className="selection-checkbox">
                          {photo.id && selectedPhotos.has(photo.id) ? '✅' : '⬜'}
                        </div>
                      ) : (
                        <span className="overlay-icon">🔍</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="photo-info">
                    {photo.description && photo.description.trim() ? (
                      <p className="photo-description">{photo.description}</p>
                    ) : (
                      <p className="photo-description" style={{ opacity: 0.7, fontStyle: 'italic' }}>
                        설명 없음
                      </p>
                    )}
                    
                    {photo.location && (
                      <p className="photo-location">
                        <LocationDisplay 
                          latitude={photo.location.latitude}
                          longitude={photo.location.longitude}
                        />
                      </p>
                    )}
                    
                    <p className="photo-date">
                      📅 {getPhotoTime(photo).toLocaleDateString('ko-KR')}
                      {photo.exifData?.timestamp && (
                        <span className="date-type" style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '4px' }}>
                          (촬영일)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* 무한스크롤 트리거 영역 */}
            {pagination && pagination.hasMore && (
              <div ref={loadMoreRef} className="load-more-trigger">
                {pagination.isLoadingMore && (
                  <div className="loading-indicator">
                    <span className="loading-spinner">⏳</span>
                    추가 사진 불러오는 중...
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 사진 상세 보기 모달 */}
      {!isSelectionMode && (
        <PhotoModal
          photo={selectedPhotoIndex !== null ? sortedPhotos[selectedPhotoIndex] : null}
          isOpen={selectedPhotoIndex !== null}
          onClose={handleModalClose}
          onPrevious={selectedPhotoIndex !== null && selectedPhotoIndex > 0 ? handlePreviousPhoto : undefined}
          onNext={selectedPhotoIndex !== null && selectedPhotoIndex < sortedPhotos.length - 1 ? handleNextPhoto : undefined}
          currentIndex={selectedPhotoIndex ?? undefined}
          totalCount={sortedPhotos.length}
          onDelete={handlePhotoDelete}
          onUpdatePhoto={handlePhotoUpdate}
        />
      )}
    </div>
  );
};