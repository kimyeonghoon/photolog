import React, { useState } from 'react';
import { PhotoModal } from '../components/PhotoModal';
import { StatsChart } from '../components/StatsChart';
import { LocationDisplay } from '../components/LocationDisplay';
import './HomePage.css';

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
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
  uploadedAt: Date;
}

interface HomePageProps {
  photos: StoredPhotoData[];
  onUploadClick: () => void;
  onMapClick: () => void;
  onTestClick?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ photos, onUploadClick, onMapClick, onTestClick }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const handlePhotoClick = (index: number) => {
    setSelectedPhotoIndex(index);
  };

  const handleModalClose = () => {
    setSelectedPhotoIndex(null);
  };

  const handlePreviousPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const handleNextPhoto = () => {
    if (selectedPhotoIndex !== null && selectedPhotoIndex < sortedPhotos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const handleSortChange = (order: 'newest' | 'oldest') => {
    setSortOrder(order);
  };

  // 실제 촬영시간 또는 업로드 시간을 가져오는 함수
  const getPhotoTime = (photo: StoredPhotoData): Date => {
    // EXIF 촬영시간이 있으면 우선 사용
    if (photo.exifData?.timestamp) {
      try {
        return new Date(photo.exifData.timestamp);
      } catch (error) {
        console.warn('EXIF timestamp 파싱 실패:', photo.exifData.timestamp, error);
      }
    }
    // EXIF 촬영시간이 없으면 업로드 시간 사용
    return new Date(photo.uploadedAt);
  };

  // 사진 정렬 (EXIF 촬영시간 우선, 없으면 업로드 시간)
  const sortedPhotos = [...photos].sort((a, b) => {
    const timeA = getPhotoTime(a);
    const timeB = getPhotoTime(b);
    
    if (sortOrder === 'newest') {
      return timeB.getTime() - timeA.getTime();
    } else {
      return timeA.getTime() - timeB.getTime();
    }
  });

  // 통계 계산
  const getPhotoStats = () => {
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

    // 총 파일 크기
    const totalSize = photos.reduce((sum, photo) => sum + photo.file.size, 0);

    // 이번 달 업로드 수
    const thisMonth = new Date();
    const thisMonthPhotos = photos.filter(photo => {
      const photoDate = new Date(photo.uploadedAt);
      return photoDate.getMonth() === thisMonth.getMonth() && 
             photoDate.getFullYear() === thisMonth.getFullYear();
    }).length;

    return {
      totalPhotos,
      photosWithLocation,
      photosWithDescription,
      latestPhoto,
      firstPhoto,
      totalSize,
      thisMonthPhotos,
      locationPercentage: Math.round((photosWithLocation / totalPhotos) * 100),
      descriptionPercentage: Math.round((photosWithDescription / totalPhotos) * 100)
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

  return (
    <div className="homepage">
      <header className="homepage-header">
        <h1>📸 포토로그</h1>
        <p>나의 여행 기록</p>
        <div className="header-buttons flex flex-wrap gap-3 justify-center">
          <button 
            onClick={onMapClick}
            className="btn btn-success btn-lg"
          >
            📍 지도 보기
          </button>
          {onTestClick && (
            <button 
              onClick={onTestClick}
              className="btn btn-secondary btn-lg"
              style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: 'white' }}
            >
              🧪 테스트
            </button>
          )}
          <button 
            onClick={onUploadClick}
            className="btn btn-primary btn-lg"
          >
            ➕ 사진 업로드
          </button>
        </div>
      </header>

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
                  <span className="detail-label">📅 첫 사진:</span>
                  <span className="detail-value">{getPhotoTime(stats.firstPhoto).toLocaleDateString('ko-KR')}</span>
                </div>
                
                <div className="detail-item">
                  <span className="detail-label">🕒 최근 사진:</span>
                  <span className="detail-value">{getPhotoTime(stats.latestPhoto).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 상세 통계 차트 */}
        {photos.length > 0 && (
          <StatsChart photos={photos} />
        )}

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
                <h2>포토로그 ({photos.length}장)</h2>
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
              </div>
            </div>
            
            <div className="photos-grid">
              {sortedPhotos.map((photo, index) => (
                <div 
                  key={index} 
                  className="photo-card"
                  onClick={() => handlePhotoClick(index)}
                >
                  <div className="photo-image">
                    <img 
                      src={photo.thumbnail?.dataUrl || URL.createObjectURL(photo.file)}
                      alt={photo.description || '여행 사진'} 
                      loading="lazy"
                    />
                    <div className="photo-overlay">
                      <span className="overlay-icon">🔍</span>
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
          </div>
        )}
      </main>

      {/* 사진 상세 보기 모달 */}
      <PhotoModal
        photo={selectedPhotoIndex !== null ? sortedPhotos[selectedPhotoIndex] : null}
        isOpen={selectedPhotoIndex !== null}
        onClose={handleModalClose}
        onPrevious={selectedPhotoIndex !== null && selectedPhotoIndex > 0 ? handlePreviousPhoto : undefined}
        onNext={selectedPhotoIndex !== null && selectedPhotoIndex < sortedPhotos.length - 1 ? handleNextPhoto : undefined}
        currentIndex={selectedPhotoIndex ?? undefined}
        totalCount={sortedPhotos.length}
      />
    </div>
  );
};