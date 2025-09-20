import React, { useState, useEffect } from 'react';
import './LocationDistribution.css';

interface LocationData {
  location_name: string;
  photo_count: number;
  avg_latitude?: number;
  avg_longitude?: number;
  first_photo_date?: string;
  latest_photo_date?: string;
}

interface LocationDistributionProps {
  authToken: string | null;
}

const LocationDistribution: React.FC<LocationDistributionProps> = ({ authToken }) => {
  const [locationData, setLocationData] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocationDistribution = async () => {
    if (!authToken) {
      setError('로그인이 필요합니다');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/photos/by-location', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setLocationData(result.data.distribution || []);
      } else {
        throw new Error(result.message || '지역별 분포 조회 실패');
      }
    } catch (error) {
      console.error('지역별 분포 조회 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationDistribution();
  }, [authToken]);

  if (loading) {
    return (
      <div className="location-distribution">
        <div className="location-distribution-header">
          <h3>🌍 지역별 사진 분포</h3>
        </div>
        <div className="loading-message">
          📊 지역별 분포 데이터를 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="location-distribution">
        <div className="location-distribution-header">
          <h3>🌍 지역별 사진 분포</h3>
        </div>
        <div className="error-message">
          ❌ {error}
          <button onClick={fetchLocationDistribution} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (locationData.length === 0) {
    return (
      <div className="location-distribution">
        <div className="location-distribution-header">
          <h3>🌍 지역별 사진 분포</h3>
        </div>
        <div className="empty-message">
          📍 위치 정보가 있는 사진이 없습니다
        </div>
      </div>
    );
  }

  const totalPhotosWithLocation = locationData.reduce((sum, item) => sum + item.photo_count, 0);

  return (
    <div className="location-distribution">
      <div className="location-distribution-header">
        <h3>🌍 지역별 사진 분포</h3>
        <p className="distribution-summary">
          총 {locationData.length}개 지역, {totalPhotosWithLocation}장의 사진
        </p>
      </div>

      <div className="location-list">
        {locationData.map((location, index) => {
          const percentage = ((location.photo_count / totalPhotosWithLocation) * 100).toFixed(1);

          return (
            <div key={index} className="location-item">
              <div className="location-header">
                <span className="location-name">{location.location_name}</span>
                <span className="photo-count">
                  {location.photo_count}장 ({percentage}%)
                </span>
              </div>

              <div className="location-bar">
                <div
                  className="location-bar-fill"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {location.first_photo_date && location.latest_photo_date && (
                <div className="location-dates">
                  <span className="date-info">
                    📅 {new Date(location.first_photo_date).toLocaleDateString('ko-KR')}
                    {location.first_photo_date !== location.latest_photo_date && (
                      <> ~ {new Date(location.latest_photo_date).toLocaleDateString('ko-KR')}</>
                    )}
                  </span>
                </div>
              )}

              {location.avg_latitude && location.avg_longitude && (
                <div className="location-coordinates">
                  📍 {location.avg_latitude.toFixed(4)}, {location.avg_longitude.toFixed(4)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LocationDistribution;