import React, { useState } from 'react';
import * as exifr from 'exifr';
import { MapView } from './MapView';

interface ImageWithGPS {
  filename: string;
  location: {
    latitude: number;
    longitude: number;
  } | null;
  exifData: any;
  file: File;
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
}

export const SampleImageTester: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState<ImageWithGPS[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const processSampleImages = async () => {
    setIsProcessing(true);
    setProcessedImages([]);
    setProgress(0);

    try {
      // 이미지 목록 가져오기
      const response = await fetch('/sample-images-list.txt');
      const imageListText = await response.text();
      const imageNames = imageListText.trim().split('\n').filter(name => name.trim() !== '');
      
      setTotal(imageNames.length);
      
      const imagesWithGPS: ImageWithGPS[] = [];
      
      // 모든 이미지 처리
      const samplesToProcess = imageNames;
      setTotal(samplesToProcess.length);
      
      for (let i = 0; i < samplesToProcess.length; i++) {
        const filename = samplesToProcess[i].trim();
        setProgress(i + 1);
        
        try {
          // 이미지 로드
          const imageResponse = await fetch(`/sample-images/${filename}`);
          if (!imageResponse.ok) continue;
          
          const blob = await imageResponse.blob();
          const file = new File([blob], filename, { type: blob.type });
          
          // EXIF 데이터 추출
          const exifData = await exifr.parse(blob, { 
            gps: true,
            pick: ['GPS', 'DateTimeOriginal', 'Make', 'Model', 'ImageWidth', 'ImageHeight']
          });
          
          let location = null;
          if (exifData && exifData.latitude && exifData.longitude) {
            location = {
              latitude: exifData.latitude,
              longitude: exifData.longitude
            };
          }
          
          // 썸네일 생성
          const createThumbnail = (file: File): Promise<string> => {
            return new Promise((resolve) => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              
              img.onload = () => {
                const size = 200;
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
                resolve(canvas.toDataURL('image/jpeg', 0.8));
              };
              
              img.src = URL.createObjectURL(file);
            });
          };
          
          const thumbnailDataUrl = await createThumbnail(file);
          
          const imageData: ImageWithGPS = {
            filename,
            location,
            exifData,
            file,
            thumbnail: {
              dataUrl: thumbnailDataUrl,
              width: 200,
              height: 200,
              size: thumbnailDataUrl.length
            }
          };
          
          imagesWithGPS.push(imageData);
          
          // GPS 데이터가 있는 이미지를 찾으면 중간 결과 업데이트
          if (location) {
            setProcessedImages([...imagesWithGPS]);
          }
          
        } catch (error) {
          console.warn(`Failed to process ${filename}:`, error);
        }
      }
      
      setProcessedImages(imagesWithGPS);
      
    } catch (error) {
      console.error('Sample image processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const imagesWithGPS = processedImages.filter(img => img.location);
  const imagesWithoutGPS = processedImages.filter(img => !img.location);

  return (
    <div style={{ padding: '20px' }}>
      <h2>📍 샘플 이미지 GPS 테스트</h2>
      
      <button 
        onClick={processSampleImages}
        disabled={isProcessing}
        style={{
          padding: '12px 24px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '16px',
          marginBottom: '20px'
        }}
      >
        {isProcessing ? `처리 중... (${progress}/${total})` : '🔍 샘플 이미지 GPS 분석'}
      </button>
      
      {isProcessing && (
        <div style={{ 
          width: '100%', 
          height: '8px', 
          backgroundColor: '#f3f4f6', 
          borderRadius: '4px', 
          overflow: 'hidden',
          marginBottom: '20px'
        }}>
          <div 
            style={{
              width: `${(progress / total) * 100}%`,
              height: '100%',
              backgroundColor: '#3b82f6',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      )}
      
      {processedImages.length > 0 && (
        <div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#dcfce7', 
              borderRadius: '8px',
              border: '1px solid #16a34a'
            }}>
              <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>
                📍 GPS 데이터 있음
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#15803d' }}>
                {imagesWithGPS.length}개
              </div>
            </div>
            
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px',
              border: '1px solid #d97706'
            }}>
              <h3 style={{ color: '#92400e', margin: '0 0 10px 0' }}>
                📷 GPS 데이터 없음
              </h3>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>
                {imagesWithoutGPS.length}개
              </div>
            </div>
          </div>
          
          {imagesWithGPS.length > 0 && (
            <div style={{ marginBottom: '30px' }}>
              <h3>🗺️ GPS 데이터가 있는 이미지들의 지도</h3>
              <div style={{ 
                height: '500px', 
                border: '1px solid #ddd', 
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <MapView 
                  photos={imagesWithGPS.map(img => ({
                    file: img.file,
                    description: img.filename,
                    location: img.location || undefined,
                    uploadedAt: new Date(),
                    thumbnail: img.thumbnail
                  }))} 
                />
              </div>
            </div>
          )}
          
          {imagesWithGPS.length > 0 && (
            <div>
              <h3>📍 GPS 데이터가 있는 이미지 목록</h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                gap: '15px' 
              }}>
                {imagesWithGPS.map((img, index) => (
                  <div key={index} style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '8px', 
                    padding: '15px',
                    backgroundColor: '#f9fafb'
                  }}>
                    {img.thumbnail && (
                      <img 
                        src={img.thumbnail.dataUrl} 
                        alt={img.filename}
                        style={{ 
                          width: '100%', 
                          height: '150px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          marginBottom: '10px'
                        }}
                      />
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                      {img.filename}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      📍 {img.location?.latitude.toFixed(6)}, {img.location?.longitude.toFixed(6)}
                    </div>
                    {img.exifData?.DateTimeOriginal && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        📅 {new Date(img.exifData.DateTimeOriginal).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                    {img.exifData?.Make && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        📷 {img.exifData.Make} {img.exifData.Model || ''}
                      </div>
                    )}
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