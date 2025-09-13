import React, { useState } from 'react';
import * as exifr from 'exifr';
import { MapView } from './MapView';

interface GPSResult {
  filename: string;
  hasGPS: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  dateTimeOriginal?: string;
  thumbnail?: string;
  file?: File;
  error?: string;
}

export const GPSChecker: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<GPSResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    withGPS: number;
    withoutGPS: number;
    errors: number;
  } | null>(null);

  const checkAllGPS = async () => {
    setIsChecking(true);
    setResults([]);
    setProgress(0);
    setSummary(null);

    try {
      // 이미지 목록 가져오기
      const response = await fetch('/sample-images-list.txt');
      const imageListText = await response.text();
      const imageNames = imageListText.trim().split('\n').filter(name => name.trim() !== '');
      
      setTotal(imageNames.length);
      
      const gpsResults: GPSResult[] = [];
      let withGPS = 0;
      let withoutGPS = 0;
      let errors = 0;
      
      // 병렬 처리를 위한 배치 크기
      const batchSize = 10;
      
      for (let i = 0; i < imageNames.length; i += batchSize) {
        const batch = imageNames.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (filename) => {
          
          try {
            const imageResponse = await fetch(`/sample-images/${filename.trim()}`);
            if (!imageResponse.ok) {
              throw new Error(`HTTP ${imageResponse.status}`);
            }
            
            const blob = await imageResponse.blob();
            const file = new File([blob], filename.trim(), { type: blob.type });
            
            // GPS 및 기본 EXIF 데이터 체크
            const gpsData = await exifr.gps(blob);
            
            let result: GPSResult = {
              filename: filename.trim(),
              hasGPS: !!(gpsData && gpsData.latitude && gpsData.longitude),
              location: (gpsData && gpsData.latitude && gpsData.longitude) ? {
                latitude: gpsData.latitude,
                longitude: gpsData.longitude
              } : undefined
            };
            
            // GPS 데이터가 있는 경우에만 추가 정보 수집
            if (result.hasGPS) {
              try {
                // 촬영 시간 정보 가져오기
                const exifData = await exifr.parse(blob, { 
                  pick: ['DateTimeOriginal', 'DateTime', 'CreateDate'] 
                });
                
                // 우선순위: DateTimeOriginal > DateTime > CreateDate
                if (exifData?.DateTimeOriginal) {
                  result.dateTimeOriginal = exifData.DateTimeOriginal;
                } else if (exifData?.DateTime) {
                  result.dateTimeOriginal = exifData.DateTime;
                } else if (exifData?.CreateDate) {
                  result.dateTimeOriginal = exifData.CreateDate;
                }
                
                // 썸네일 생성
                const createThumbnail = (file: File): Promise<string> => {
                  return new Promise((resolve) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    
                    img.onload = () => {
                      const size = 150;
                      canvas.width = size;
                      canvas.height = size;
                      
                      const aspectRatio = img.width / img.height;
                      let drawWidth = size;
                      let drawHeight = size;
                      let offsetX = 0;
                      let offsetY = 0;
                      
                      if (aspectRatio > 1) {
                        drawHeight = size / aspectRatio;
                        offsetY = (size - drawHeight) / 2;
                      } else {
                        drawWidth = size * aspectRatio;
                        offsetX = (size - drawWidth) / 2;
                      }
                      
                      ctx?.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                      resolve(canvas.toDataURL('image/jpeg', 0.7));
                    };
                    
                    img.onerror = () => resolve('');
                    img.src = URL.createObjectURL(file);
                  });
                };
                
                result.thumbnail = await createThumbnail(file);
                result.file = file;
                
              } catch (thumbError) {
                console.warn(`Failed to create thumbnail for ${filename}:`, thumbError);
              }
            }
            
            if (result.hasGPS) {
              withGPS++;
            } else {
              withoutGPS++;
            }
            
            return result;
            
          } catch (error) {
            errors++;
            return {
              filename: filename.trim(),
              hasGPS: false,
              error: error instanceof Error ? error.message : '알 수 없는 오류'
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        gpsResults.push(...batchResults);
        
        setProgress(Math.min(i + batchSize, imageNames.length));
        setResults([...gpsResults]);
        setSummary({ withGPS, withoutGPS, errors });
      }
      
    } catch (error) {
      console.error('GPS checking failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const gpsImages = results.filter(r => r.hasGPS);
  const errorImages = results.filter(r => r.error);

  return (
    <div style={{ padding: '20px' }}>
      <h2>🧭 전체 샘플 이미지 GPS 데이터 체크</h2>
      
      <button 
        onClick={checkAllGPS}
        disabled={isChecking}
        style={{
          padding: '15px 30px',
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isChecking ? 'not-allowed' : 'pointer',
          fontSize: '18px',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}
      >
        {isChecking ? `체크 중... (${progress}/${total})` : '🔍 전체 1402개 이미지 GPS 체크'}
      </button>
      
      {isChecking && (
        <div>
          <div style={{ 
            width: '100%', 
            height: '12px', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '6px', 
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div 
              style={{
                width: `${(progress / total) * 100}%`,
                height: '100%',
                backgroundColor: '#dc2626',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <div style={{ textAlign: 'center', color: '#666', marginBottom: '20px' }}>
            {progress > 0 && summary && (
              <span>
                진행률: {((progress / total) * 100).toFixed(1)}% | 
                GPS 있음: <strong style={{ color: '#16a34a' }}>{summary.withGPS}</strong> | 
                GPS 없음: <strong style={{ color: '#d97706' }}>{summary.withoutGPS}</strong> | 
                오류: <strong style={{ color: '#dc2626' }}>{summary.errors}</strong>
              </span>
            )}
          </div>
        </div>
      )}
      
      {summary && !isChecking && (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '15px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#dcfce7', 
              borderRadius: '10px',
              border: '2px solid #16a34a',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>
                📍 GPS 데이터 있음
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#15803d' }}>
                {summary.withGPS}개
              </div>
              <div style={{ fontSize: '14px', color: '#15803d', marginTop: '5px' }}>
                ({((summary.withGPS / total) * 100).toFixed(1)}%)
              </div>
            </div>
            
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '10px',
              border: '2px solid #d97706',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#92400e', margin: '0 0 10px 0' }}>
                📷 GPS 데이터 없음
              </h3>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#92400e' }}>
                {summary.withoutGPS}개
              </div>
              <div style={{ fontSize: '14px', color: '#92400e', marginTop: '5px' }}>
                ({((summary.withoutGPS / total) * 100).toFixed(1)}%)
              </div>
            </div>
            
            {summary.errors > 0 && (
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#fee2e2', 
                borderRadius: '10px',
                border: '2px solid #dc2626',
                textAlign: 'center'
              }}>
                <h3 style={{ color: '#dc2626', margin: '0 0 10px 0' }}>
                  ❌ 처리 오류
                </h3>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc2626' }}>
                  {summary.errors}개
                </div>
                <div style={{ fontSize: '14px', color: '#dc2626', marginTop: '5px' }}>
                  ({((summary.errors / total) * 100).toFixed(1)}%)
                </div>
              </div>
            )}
          </div>
          
          {gpsImages.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ color: '#15803d', marginBottom: '15px' }}>🗺️ GPS 데이터가 있는 이미지들의 지도 ({gpsImages.length}개)</h3>
              
              <div style={{ 
                height: '600px', 
                border: '2px solid #16a34a',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '20px'
              }}>
                <MapView 
                  photos={gpsImages
                    .filter(img => img.file && img.location)
                    .map(img => {
                      // 촬영 시간 결정 우선순위
                      let captureDate: Date;
                      
                      if (img.dateTimeOriginal) {
                        // EXIF에서 추출한 실제 촬영 시간 사용
                        captureDate = new Date(img.dateTimeOriginal);
                      } else {
                        // 파일명에서 날짜 추출 시도 (예: 20220101_124342.jpg)
                        const dateMatch = img.filename.match(/^(\d{8})_(\d{6})/);
                        if (dateMatch) {
                          const [, dateStr, timeStr] = dateMatch;
                          const year = parseInt(dateStr.substring(0, 4));
                          const month = parseInt(dateStr.substring(4, 6)) - 1; // 월은 0부터 시작
                          const day = parseInt(dateStr.substring(6, 8));
                          const hour = parseInt(timeStr.substring(0, 2));
                          const minute = parseInt(timeStr.substring(2, 4));
                          const second = parseInt(timeStr.substring(4, 6));
                          captureDate = new Date(year, month, day, hour, minute, second);
                        } else {
                          // 파일명에서도 추출할 수 없으면 현재 시간 사용
                          captureDate = new Date();
                        }
                      }
                      
                      return {
                        file: img.file!,
                        description: `${img.filename}${img.dateTimeOriginal ? ' (EXIF 촬영시간)' : ' (파일명 추정시간)'}`,
                        location: img.location!,
                        uploadedAt: captureDate,
                        thumbnail: img.thumbnail ? {
                          dataUrl: img.thumbnail,
                          width: 150,
                          height: 150,
                          size: img.thumbnail.length
                        } : undefined,
                        exifData: {
                          timestamp: img.dateTimeOriginal || captureDate.toISOString()
                        }
                      };
                    })
                    // 촬영 시간순으로 정렬
                    .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
                  } 
                />
              </div>
              
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '20px'
              }}>
                <h4 style={{ color: '#0c4a6e', margin: '0 0 10px 0' }}>💡 지도 사용법</h4>
                <ul style={{ margin: '0', paddingLeft: '20px', color: '#0369a1' }}>
                  <li>📍 <strong>마커 클릭</strong>: 사진 썸네일과 정보 보기</li>
                  <li>🔗 <strong>여행 경로</strong>: <strong>실제 촬영 시간순</strong>으로 연결된 점선으로 표시</li>
                  <li>🖱️ <strong>지도 조작</strong>: 드래그로 이동, 스크롤로 확대/축소</li>
                  <li>📷 <strong>썸네일 마커</strong>: 실제 사진이 마커에 표시됨</li>
                  <li>⏰ <strong>시간 정보</strong>: EXIF 실제 촬영시간 &gt; 파일명 추정시간 순으로 우선 적용</li>
                </ul>
              </div>
              
              <h3 style={{ color: '#15803d' }}>📍 GPS 데이터가 있는 이미지 목록</h3>
              <div style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '15px'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                  gap: '15px' 
                }}>
                  {gpsImages.map((img, index) => (
                    <div key={index} style={{ 
                      padding: '12px', 
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px',
                      display: 'flex',
                      gap: '10px'
                    }}>
                      {img.thumbnail && (
                        <img 
                          src={img.thumbnail} 
                          alt={img.filename}
                          style={{
                            width: '60px',
                            height: '60px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                          }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>
                          📷 {img.filename}
                        </div>
                        <div style={{ color: '#059669', fontSize: '11px', marginBottom: '2px' }}>
                          📍 {img.location?.latitude.toFixed(6)}, {img.location?.longitude.toFixed(6)}
                        </div>
                        {img.dateTimeOriginal ? (
                          <div style={{ color: '#059669', fontSize: '11px', fontWeight: 'bold' }}>
                            📅 {new Date(img.dateTimeOriginal).toLocaleString('ko-KR')} (EXIF 실제 촬영시간)
                          </div>
                        ) : (
                          <div style={{ color: '#6b7280', fontSize: '11px' }}>
                            {(() => {
                              const dateMatch = img.filename.match(/^(\d{8})_(\d{6})/);
                              if (dateMatch) {
                                const [, dateStr, timeStr] = dateMatch;
                                const year = parseInt(dateStr.substring(0, 4));
                                const month = parseInt(dateStr.substring(4, 6)) - 1;
                                const day = parseInt(dateStr.substring(6, 8));
                                const hour = parseInt(timeStr.substring(0, 2));
                                const minute = parseInt(timeStr.substring(2, 4));
                                const second = parseInt(timeStr.substring(4, 6));
                                const estimatedDate = new Date(year, month, day, hour, minute, second);
                                return `📅 ${estimatedDate.toLocaleString('ko-KR')} (파일명 추정시간)`;
                              }
                              return '📅 시간 정보 없음';
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {errorImages.length > 0 && (
            <div>
              <h3 style={{ color: '#dc2626' }}>❌ 처리 오류가 발생한 이미지 ({errorImages.length}개)</h3>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '15px'
              }}>
                {errorImages.map((img, index) => (
                  <div key={index} style={{ 
                    padding: '8px', 
                    marginBottom: '5px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <strong>{img.filename}</strong>: {img.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};