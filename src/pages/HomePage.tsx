import React, { useState } from 'react';
import { PhotoModal } from '../components/PhotoModal';
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

  // 사진 정렬
  const sortedPhotos = [...photos].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    } else {
      return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
    }
  });

  // 통계 계산
  const getPhotoStats = () => {
    if (photos.length === 0) return null;

    const totalPhotos = photos.length;
    const photosWithLocation = photos.filter(p => p.location).length;
    const photosWithDescription = photos.filter(p => p.description && p.description.trim()).length;

    // 최근 업로드 날짜
    const latestUpload = photos.reduce((latest, photo) => 
      new Date(photo.uploadedAt) > new Date(latest.uploadedAt) ? photo : latest
    );

    // 첫 업로드 날짜
    const firstUpload = photos.reduce((earliest, photo) => 
      new Date(photo.uploadedAt) < new Date(earliest.uploadedAt) ? photo : earliest
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
      latestUpload,
      firstUpload,
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
        <div className="header-buttons">
          <button 
            onClick={onMapClick}
            className="map-button-header"
          >
            📍 지도 보기
          </button>
          {onTestClick && (
            <button 
              onClick={onTestClick}
              className="test-button-header"
              style={{ backgroundColor: '#10b981' }}
            >
              🧪 테스트
            </button>
          )}
          <button 
            onClick={onUploadClick}
            className="upload-button-header"
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
                  <span className="detail-label">📅 첫 업로드:</span>
                  <span className="detail-value">{stats.firstUpload.uploadedAt.toLocaleDateString('ko-KR')}</span>
                </div>
                
                <div className="detail-item">
                  <span className="detail-label">🕒 최근 업로드:</span>
                  <span className="detail-value">{stats.latestUpload.uploadedAt.toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
            </div>
          </div>
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
                className="upload-button-empty"
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
                    className={`sort-button ${sortOrder === 'newest' ? 'active' : ''}`}
                    onClick={() => handleSortChange('newest')}
                  >
                    🕒 최신순
                  </button>
                  <button 
                    className={`sort-button ${sortOrder === 'oldest' ? 'active' : ''}`}
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
                    {photo.description && (
                      <p className="photo-description">{photo.description}</p>
                    )}
                    
                    {photo.location && (
                      <p className="photo-location">
                        📍 위치 정보 있음
                      </p>
                    )}
                    
                    <p className="photo-date">
                      📅 {photo.uploadedAt.toLocaleDateString('ko-KR')}
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