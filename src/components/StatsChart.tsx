import React from 'react';
import type { UnifiedPhotoData } from '../types';
import './StatsChart.css';

interface StatsChartProps {
  photos: UnifiedPhotoData[];
}

// LocationStats는 LocationDistribution 컴포넌트에서 처리

interface YearlyStats {
  year: number;
  count: number;
  months: { [key: number]: number };
}

export const StatsChart: React.FC<StatsChartProps> = ({ photos }) => {
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
  // 지역별 통계는 LocationDistribution 컴포넌트에서 처리

  // 년도별 통계 계산 (실제 촬영시간 기준)
  const getYearlyStats = (): YearlyStats[] => {
    const yearlyData: { [key: number]: YearlyStats } = {};
    
    photos.forEach(photo => {
      const date = getPhotoTime(photo);
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

  // 월별 촬영 트렌드 계산 (실제 촬영시간 기준)
  const getMonthlyTrend = (): { month: string; count: number }[] => {
    const monthlyData: { [key: number]: number } = {};
    const monthNames = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    
    photos.forEach(photo => {
      const month = getPhotoTime(photo).getMonth();
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    });
    
    return monthNames.map((name, index) => ({
      month: name,
      count: monthlyData[index] || 0
    }));
  };

  // 지역별 통계는 LocationDistribution 컴포넌트에서 처리
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
      {/* 지역별 분포는 LocationDistribution 컴포넌트에서 처리됩니다 */}

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
          <div className="monthly-bars">
            {monthlyTrend.map(month => (
              <div key={month.month} className="month-bar">
                <div 
                  className="month-fill"
                  style={{
                    height: maxMonthly > 0 ? `${(month.count / maxMonthly) * 100}%` : '0%'
                  }}
                  title={`${month.month}: ${month.count}장`}
                />
              </div>
            ))}
          </div>
          <div className="monthly-labels">
            {monthlyTrend.map(month => (
              <div key={month.month} className="month-label">{month.month}</div>
            ))}
          </div>
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
          
          {/* 주요 여행지는 LocationDistribution에서 확인하세요 */}
          
          <div className="summary-item">
            <div className="summary-icon">📸</div>
            <div className="summary-content">
              <div className="summary-label">월 평균 업로드</div>
              <div className="summary-value">
                {(() => {
                  if (photos.length === 0) return 0;
                  
                  // 첫 업로드와 마지막 업로드 날짜 구하기
                  const dates = photos.map(p => new Date(p.uploadedAt || Date.now()));
                  const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
                  const lastDate = new Date(Math.max(...dates.map(d => d.getTime())));
                  
                  // 개월 수 계산 (최소 1개월)
                  const monthsDiff = Math.max(
                    (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                    (lastDate.getMonth() - firstDate.getMonth()) + 1,
                    1
                  );
                  
                  return Math.round(photos.length / monthsDiff);
                })()}장
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};