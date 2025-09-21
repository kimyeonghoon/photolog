import React, { useState, useEffect } from 'react';
import type { UnifiedPhotoData } from '../types';
import { photoAPI } from '../services/photoAPI';
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

interface ServerYearlyStats {
  year: number;
  photo_count: number;
}

interface ServerMonthlyStats {
  month: number;
  photo_count: number;
}

export const StatsChart: React.FC<StatsChartProps> = ({ photos }) => {
  const [serverStats, setServerStats] = useState<{
    yearly: ServerYearlyStats[];
    monthly: ServerMonthlyStats[];
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [useServerStats, setUseServerStats] = useState(true);

  // 서버에서 통계 데이터 로드
  useEffect(() => {
    const loadServerStats = async () => {
      if (!useServerStats) return;

      setIsLoadingStats(true);
      try {
        const result = await photoAPI.getPhotosByDate();
        if (result.success && result.data) {
          setServerStats({
            yearly: result.data.yearly_stats,
            monthly: result.data.monthly_stats
          });
          console.log('📊 서버 통계 로드 성공:', result.data);
        } else {
          console.warn('📊 서버 통계 로드 실패, 로컬 계산으로 fallback:', result.message);
          setUseServerStats(false);
        }
      } catch (error) {
        console.error('📊 서버 통계 로드 오류, 로컬 계산으로 fallback:', error);
        setUseServerStats(false);
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadServerStats();
  }, [useServerStats]);

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

  // 서버 통계를 사용할지 로컬 계산을 사용할지 결정하는 함수들
  const getYearlyStatsData = (): YearlyStats[] => {
    if (useServerStats && serverStats) {
      // 서버 통계 사용
      return serverStats.yearly.map(item => ({
        year: item.year,
        count: item.photo_count,
        months: {} // 월별 세부 정보는 서버에서 따로 제공하지 않음
      }));
    }

    // 로컬 계산 fallback
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

  const getMonthlyTrendData = (): { month: string; count: number }[] => {
    const monthNames = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월'
    ];

    if (useServerStats && serverStats) {
      // 서버 통계 사용
      const monthlyData: { [key: number]: number } = {};
      serverStats.monthly.forEach(item => {
        monthlyData[item.month - 1] = item.photo_count; // 서버는 1-12, 프론트는 0-11
      });

      return monthNames.map((name, index) => ({
        month: name,
        count: monthlyData[index] || 0
      }));
    }

    // 로컬 계산 fallback
    const monthlyData: { [key: number]: number } = {};

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
  const yearlyStats = getYearlyStatsData();
  const monthlyTrend = getMonthlyTrendData();
  const maxMonthly = Math.max(...monthlyTrend.map(m => m.count));

  if (photos.length === 0 && !isLoadingStats) {
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
      {/* 로딩 상태 표시 */}
      {isLoadingStats && (
        <div className="chart-loading">
          <p>📊 통계 데이터 로딩 중...</p>
        </div>
      )}

      {/* 데이터 소스 표시 */}
      {!isLoadingStats && (
        <div className="chart-data-source">
          <small style={{ opacity: 0.7, fontSize: '0.8em' }}>
            {useServerStats && serverStats
              ? `📡 서버 데이터 (전체 ${serverStats.yearly.reduce((sum, y) => sum + y.photo_count, 0)}장)`
              : `💻 로컬 데이터 (${photos.length}장)`}
          </small>
        </div>
      )}

      {/* 지역별 분포는 LocationDistribution 컴포넌트에서 처리됩니다 */}

      {/* 년도별 촬영 통계 */}
      {yearlyStats.length > 0 && (
        <div className="chart-section">
          <h3>📅 년도별 촬영 현황</h3>
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

      {/* 월별 촬영 트렌드 */}
      <div className="chart-section">
        <h3>📈 월별 촬영 트렌드</h3>
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
              <div className="summary-label">월 평균 촬영</div>
              <div className="summary-value">
                {(() => {
                  if (useServerStats && serverStats) {
                    // 서버 통계 사용: 전체 사진 수를 활동 기간으로 나누기
                    const totalPhotos = serverStats.yearly.reduce((sum, y) => sum + y.photo_count, 0);
                    if (totalPhotos === 0) return 0;

                    // 활동 기간 계산 (첫 해부터 마지막 해까지)
                    const years = serverStats.yearly.map(y => y.year).sort();
                    if (years.length === 0) return 0;

                    const activityMonths = Math.max(
                      (years[years.length - 1] - years[0]) * 12 + 12, // 최소 1년
                      1
                    );

                    return Math.round(totalPhotos / activityMonths);
                  }

                  // 로컬 계산 fallback
                  if (photos.length === 0) return 0;

                  const dates = photos.map(p => new Date(p.uploadedAt || Date.now()));
                  const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
                  const lastDate = new Date(Math.max(...dates.map(d => d.getTime())));

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