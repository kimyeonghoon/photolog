import React from 'react';
import './StatsChart.css';

interface PhotoData {
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

interface StatsChartProps {
  photos: PhotoData[];
}

interface LocationStats {
  region: string;
  count: number;
  percentage: number;
  color: string;
}

interface YearlyStats {
  year: number;
  count: number;
  months: { [key: number]: number };
}

export const StatsChart: React.FC<StatsChartProps> = ({ photos }) => {
  // 지역별 통계 계산 (위도/경도 기반 대략적 지역 분류)
  const getRegionStats = (): LocationStats[] => {
    const photosWithLocation = photos.filter(p => p.location);
    if (photosWithLocation.length === 0) return [];

    const regions: { [key: string]: number } = {};
    
    photosWithLocation.forEach(photo => {
      const lat = photo.location!.latitude;
      const lng = photo.location!.longitude;
      
      let region = '기타';
      
      // 한국 지역 분류 (대략적)
      if (lat >= 33 && lat <= 38.5 && lng >= 124 && lng <= 132) {
        if (lat >= 33 && lat <= 33.8 && lng >= 126 && lng <= 127) {
          region = '제주도';
        } else if (lat >= 35.8 && lat <= 37.7 && lng >= 126.3 && lng <= 127.6) {
          region = '수도권';
        } else if (lat >= 36.8 && lat <= 38.5 && lng >= 127.3 && lng <= 128.9) {
          region = '강원도';
        } else if (lat >= 35.7 && lat <= 37.0 && lng >= 127.6 && lng <= 129.6) {
          region = '경상도';
        } else if (lat >= 34.3 && lat <= 35.8 && lng >= 126.1 && lng <= 127.5) {
          region = '전라도';
        } else if (lat >= 36.0 && lat <= 37.0 && lng >= 126.3 && lng <= 127.6) {
          region = '충청도';
        }
      }
      
      regions[region] = (regions[region] || 0) + 1;
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];
    
    return Object.entries(regions)
      .map(([region, count], index) => ({
        region,
        count,
        percentage: Math.round((count / photosWithLocation.length) * 100),
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.count - a.count);
  };

  // 년도별 통계 계산
  const getYearlyStats = (): YearlyStats[] => {
    const yearlyData: { [key: number]: YearlyStats } = {};
    
    photos.forEach(photo => {
      const date = new Date(photo.uploadedAt);
      const year = date.getFullYear();
      const month = date.getMonth();
      
      if (!yearlyData[year]) {
        yearlyData[year] = {
          year,
          count: 0,
          months: {}
        };
      }
      
      yearlyData[year].count++;
      yearlyData[year].months[month] = (yearlyData[year].months[month] || 0) + 1;
    });
    
    return Object.values(yearlyData).sort((a, b) => b.year - a.year);
  };

  // 월별 업로드 트렌드 계산
  const getMonthlyTrend = (): { month: string; count: number }[] => {
    const monthlyData: { [key: number]: number } = {};
    const monthNames = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    
    photos.forEach(photo => {
      const month = new Date(photo.uploadedAt).getMonth();
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    
    return monthNames.map((name, index) => ({
      month: name,
      count: monthlyData[index] || 0
    }));
  };

  const regionStats = getRegionStats();
  const yearlyStats = getYearlyStats();
  const monthlyTrend = getMonthlyTrend();
  const maxMonthly = Math.max(...monthlyTrend.map(m => m.count));

  if (photos.length === 0) {
    return (
      <div className="stats-chart">
        <div className="chart-empty">
          <p>📊 통계를 보려면 사진을 업로드해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-chart">
      {/* 지역별 분포 차트 */}
      {regionStats.length > 0 && (
        <div className="chart-section">
          <h3>🌍 지역별 사진 분포</h3>
          <div className="region-chart">
            <div className="pie-chart">
              {regionStats.map((region, index) => {
                const angle = (region.percentage / 100) * 360;
                const prevAngles = regionStats.slice(0, index).reduce((sum, r) => sum + (r.percentage / 100) * 360, 0);
                
                return (
                  <div
                    key={region.region}
                    className="pie-slice"
                    style={{
                      background: `conic-gradient(${region.color} 0deg ${angle}deg, transparent ${angle}deg 360deg)`,
                      transform: `rotate(${prevAngles}deg)`
                    }}
                  />
                );
              })}
            </div>
            <div className="region-legend">
              {regionStats.map(region => (
                <div key={region.region} className="legend-item">
                  <div 
                    className="legend-color"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="legend-text">
                    {region.region} ({region.count}장, {region.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 년도별 업로드 통계 */}
      {yearlyStats.length > 0 && (
        <div className="chart-section">
          <h3>📅 년도별 업로드 현황</h3>
          <div className="yearly-chart">
            {yearlyStats.map(year => (
              <div key={year.year} className="year-bar">
                <div className="year-label">{year.year}년</div>
                <div className="year-progress">
                  <div 
                    className="year-fill"
                    style={{
                      width: `${(year.count / Math.max(...yearlyStats.map(y => y.count))) * 100}%`
                    }}
                  />
                </div>
                <div className="year-count">{year.count}장</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 월별 업로드 트렌드 */}
      <div className="chart-section">
        <h3>📈 월별 업로드 트렌드</h3>
        <div className="monthly-chart">
          {monthlyTrend.map(month => (
            <div key={month.month} className="month-bar">
              <div 
                className="month-fill"
                style={{
                  height: maxMonthly > 0 ? `${(month.count / maxMonthly) * 100}%` : '0%'
                }}
                title={`${month.month}: ${month.count}장`}
              />
              <div className="month-label">{month.month}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 주요 통계 요약 */}
      <div className="chart-section">
        <h3>📊 주요 통계</h3>
        <div className="summary-stats">
          <div className="summary-item">
            <div className="summary-icon">🏆</div>
            <div className="summary-content">
              <div className="summary-label">가장 활발한 달</div>
              <div className="summary-value">
                {monthlyTrend.reduce((max, month) => 
                  month.count > max.count ? month : max
                ).month}
              </div>
            </div>
          </div>
          
          {regionStats.length > 0 && (
            <div className="summary-item">
              <div className="summary-icon">🌍</div>
              <div className="summary-content">
                <div className="summary-label">주요 여행지</div>
                <div className="summary-value">{regionStats[0].region}</div>
              </div>
            </div>
          )}
          
          <div className="summary-item">
            <div className="summary-icon">📸</div>
            <div className="summary-content">
              <div className="summary-label">월 평균 업로드</div>
              <div className="summary-value">
                {Math.round(photos.length / Math.max(yearlyStats.length * 12, 1))}장
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};