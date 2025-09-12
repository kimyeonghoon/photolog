import React, { useState, useMemo, useEffect } from 'react';
import './ImageFilter.css';

interface ImageFilterProps {
  images: string[];
  onFilteredResults: (filteredImages: string[], stats: FilterStats, searchQuery: string) => void;
}

interface FilterStats {
  total: number;
  filtered: number;
  byYear: Record<string, number>;
  withGPS: number;
  withoutGPS: number;
}

export const ImageFilter: React.FC<ImageFilterProps> = ({ images, onFilteredResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [showGPSOnly, setShowGPSOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F: 검색창에 포커스
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        searchInput?.focus();
      }
      
      // Escape: 검색어 지우기
      if (event.key === 'Escape' && searchQuery) {
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // 이미지에서 날짜 추출 함수
  const extractDateFromFilename = (filename: string) => {
    const match = filename.match(/(\d{8})_(\d{6})/);
    if (match) {
      const [, dateStr, timeStr] = match;
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = timeStr.substring(0, 2);
      const minute = timeStr.substring(2, 4);
      const second = timeStr.substring(4, 6);
      return {
        year,
        date: new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second))
      };
    }
    return { year: 'unknown', date: new Date() };
  };

  // GPS 데이터 유무를 시뮬레이션 (실제로는 EXIF에서 가져와야 함)
  const hasGPS = (filename: string) => {
    // 제주 올레 관련 이미지들만 GPS가 있다고 가정
    return filename.includes('20220304') || 
           filename.includes('20220305') || 
           filename.includes('20220307') ||
           filename.includes('20220308') ||
           filename.includes('20220309') ||
           filename.includes('20220314') ||
           filename.includes('20220315') ||
           filename.includes('20220316');
  };

  const filteredData = useMemo(() => {
    let filtered = images.map(img => ({
      path: img,
      filename: img.split('/').pop() || '',
      ...extractDateFromFilename(img.split('/').pop() || ''),
      hasGPS: hasGPS(img.split('/').pop() || '')
    }));

    // 검색어 필터링
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img => 
        img.filename.toLowerCase().includes(query) ||
        img.year.includes(query)
      );
    }

    // 연도 필터링
    if (selectedYear !== 'all') {
      filtered = filtered.filter(img => img.year === selectedYear);
    }

    // GPS 필터링
    if (showGPSOnly) {
      filtered = filtered.filter(img => img.hasGPS);
    }

    // 정렬
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.filename.localeCompare(b.filename);
      } else {
        comparison = a.date.getTime() - b.date.getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // 통계 계산
    const stats: FilterStats = {
      total: images.length,
      filtered: filtered.length,
      byYear: {},
      withGPS: filtered.filter(img => img.hasGPS).length,
      withoutGPS: filtered.filter(img => !img.hasGPS).length
    };

    // 년도별 통계
    filtered.forEach(img => {
      if (img.year !== 'unknown') {
        stats.byYear[img.year] = (stats.byYear[img.year] || 0) + 1;
      }
    });

    return { filtered: filtered.map(img => img.path), stats };
  }, [images, searchQuery, selectedYear, showGPSOnly, sortBy, sortOrder]);

  // 필터 결과를 부모 컴포넌트에 전달
  React.useEffect(() => {
    onFilteredResults(filteredData.filtered, filteredData.stats, searchQuery);
  }, [filteredData, onFilteredResults, searchQuery]);

  // 사용 가능한 년도 추출
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    images.forEach(img => {
      const { year } = extractDateFromFilename(img.split('/').pop() || '');
      if (year !== 'unknown') years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [images]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedYear('all');
    setShowGPSOnly(false);
    setSortBy('date');
    setSortOrder('desc');
  };

  return (
    <div className="image-filter">
      <div className="filter-header">
        <h3>🔍 이미지 검색 및 필터</h3>
        <div className="filter-stats">
          <span className="total-count">{filteredData.stats.filtered}개</span>
          <span className="total-label">/ {filteredData.stats.total}개</span>
          {searchQuery && (
            <span className="search-performance">
              ({((filteredData.stats.filtered / filteredData.stats.total) * 100).toFixed(1)}% 매치)
            </span>
          )}
        </div>
      </div>

      <div className="filter-controls">
        {/* 검색창 */}
        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="파일명이나 날짜로 검색... (Ctrl+F로 포커스, ESC로 지우기)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              title="키보드 단축키: Ctrl+F (포커스), ESC (지우기)"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="clear-search"
                title="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 필터 버튼들 */}
        <div className="filter-buttons">
          {/* 연도 필터 */}
          <div className="filter-group">
            <label>연도:</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="year-select"
            >
              <option value="all">전체</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* GPS 필터 */}
          <div className="filter-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showGPSOnly}
                onChange={(e) => setShowGPSOnly(e.target.checked)}
              />
              <span className="checkbox-text">📍 GPS만</span>
            </label>
          </div>

          {/* 정렬 옵션 */}
          <div className="filter-group">
            <label>정렬:</label>
            <select 
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as ['name' | 'date', 'asc' | 'desc'];
                setSortBy(by);
                setSortOrder(order);
              }}
              className="sort-select"
            >
              <option value="date-desc">📅 최신순</option>
              <option value="date-asc">📅 오래된순</option>
              <option value="name-asc">📝 이름 오름차순</option>
              <option value="name-desc">📝 이름 내림차순</option>
            </select>
          </div>

          {/* 필터 초기화 */}
          <button 
            onClick={clearAllFilters}
            className="clear-filters"
            title="모든 필터 초기화"
          >
            🔄 초기화
          </button>
        </div>
      </div>

      {/* 상세 통계 */}
      {(searchQuery || selectedYear !== 'all' || showGPSOnly) && (
        <div className="filter-stats-detail">
          <div className="stats-row">
            <span className="stat-item">
              📍 GPS 있음: <strong>{filteredData.stats.withGPS}</strong>
            </span>
            <span className="stat-item">
              📷 GPS 없음: <strong>{filteredData.stats.withoutGPS}</strong>
            </span>
          </div>
          
          {Object.keys(filteredData.stats.byYear).length > 0 && (
            <div className="year-stats">
              <span className="year-label">년도별:</span>
              {Object.entries(filteredData.stats.byYear)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([year, count]) => (
                <span key={year} className="year-stat">
                  {year}: <strong>{count}개</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};