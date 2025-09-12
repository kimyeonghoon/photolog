import React, { useState, useEffect, useCallback } from 'react';
import { ImageFilter } from './ImageFilter';
import { SearchHighlight } from './SearchHighlight';
import './SampleImageLoader.css';

interface SampleImageLoaderProps {
  onLoadComplete?: (images: string[]) => void;
}

interface FilterStats {
  total: number;
  filtered: number;
  byYear: Record<string, number>;
  withGPS: number;
  withoutGPS: number;
}

export const SampleImageLoader: React.FC<SampleImageLoaderProps> = ({ onLoadComplete }) => {
  const [images, setImages] = useState<string[]>([]);
  const [filteredImages, setFilteredImages] = useState<string[]>([]);
  const [filterStats, setFilterStats] = useState<FilterStats | null>(null);
  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    loadSampleImages();
  }, []);

  const loadSampleImages = async () => {
    try {
      setLoading(true);
      setError(null);

      // 이미지 목록 파일을 먼저 가져오기
      const response = await fetch('/sample-images-list.txt');
      if (!response.ok) {
        throw new Error('이미지 목록을 불러올 수 없습니다');
      }
      
      const imageListText = await response.text();
      const imageNames = imageListText.trim().split('\n').filter(name => name.trim() !== '');
      
      console.log(`총 ${imageNames.length}개의 이미지 파일을 발견했습니다`);

      // 이미지 경로 생성
      const imagePaths = imageNames.map(name => `/sample-images/${name.trim()}`);
      
      setImages(imagePaths);
      setFilteredImages(imagePaths); // 초기에는 모든 이미지 표시
      setLoadedCount(imagePaths.length);
      onLoadComplete?.(imagePaths);
      
    } catch (err) {
      console.error('샘플 이미지 로드 실패:', err);
      setError('이미지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필터 결과 처리 콜백
  const handleFilterResults = useCallback((filtered: string[], stats: FilterStats, searchQuery: string) => {
    setFilteredImages(filtered);
    setFilterStats(stats);
    setCurrentSearchQuery(searchQuery);
  }, []);

  if (loading) {
    return (
      <div className="sample-loader">
        <div className="loader-spinner"></div>
        <p>샘플 이미지를 불러오는 중... ({loadedCount}개 발견)</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sample-loader error">
        <p>{error}</p>
        <button onClick={loadSampleImages}>다시 시도</button>
      </div>
    );
  }

  return (
    <div className="sample-images-container">
      <h2>샘플 이미지</h2>
      
      {/* 필터 컴포넌트 */}
      <ImageFilter 
        images={images}
        onFilteredResults={handleFilterResults}
      />

      {/* 필터된 결과 표시 */}
      {filterStats && (
        <div className="filter-summary">
          {filterStats.filtered !== filterStats.total && (
            <div className="filter-applied">
              <span className="filter-icon">🔍</span>
              <span>필터 적용됨: </span>
              <strong>{filterStats.filtered}개</strong>
              <span> / {filterStats.total}개</span>
            </div>
          )}
        </div>
      )}

      {/* 이미지 그리드 */}
      <div className="sample-images-grid">
        {filteredImages.length === 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>검색 결과가 없습니다</h3>
            <p>다른 검색어나 필터를 시도해보세요.</p>
          </div>
        ) : (
          filteredImages.map((imageSrc, index) => {
            const filename = imageSrc.split('/').pop() || '';
            const isGPS = filename.includes('20220304') || 
                         filename.includes('20220305') || 
                         filename.includes('20220307') ||
                         filename.includes('20220308') ||
                         filename.includes('20220309') ||
                         filename.includes('20220314') ||
                         filename.includes('20220315') ||
                         filename.includes('20220316');
            
            return (
              <div key={`${imageSrc}-${index}`} className="sample-image-card">
                <div className="image-container">
                  <img 
                    src={imageSrc} 
                    alt={`Sample ${index + 1}`}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  {isGPS && (
                    <div className="gps-badge" title="GPS 위치 정보 있음">
                      📍
                    </div>
                  )}
                </div>
                <div className="sample-image-info">
                  <SearchHighlight 
                    text={filename}
                    searchQuery={currentSearchQuery}
                    className="filename"
                  />
                  {isGPS && (
                    <span className="gps-indicator">GPS</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 로딩 더 많은 이미지가 있을 때 스크롤 힌트 */}
      {filteredImages.length > 50 && (
        <div className="scroll-hint">
          <p>💡 총 {filteredImages.length}개의 이미지가 있습니다. 스크롤해서 더 많은 이미지를 확인하세요!</p>
        </div>
      )}
    </div>
  );
};