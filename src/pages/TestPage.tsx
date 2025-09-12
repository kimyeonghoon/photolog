import React, { useState } from 'react';
import { createThumbnail, type ThumbnailOptions } from '../utils/thumbnailGenerator';
import { MapView } from '../components/MapView';
import { TestSummary } from '../components/TestSummary';
import { SampleImageLoader } from '../components/SampleImageLoader';
import { SampleImageTester } from '../components/SampleImageTester';
import { GPSChecker } from '../components/GPSChecker';
import { samplePhotos, createFileFromSample } from '../data/sampleData';

interface TestResult {
  filename: string;
  original: {
    size: number;
    width: number;
    height: number;
  };
  thumbnails: Array<{
    name: string;
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  }>;
  error?: string;
}

export const TestPage: React.FC = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mapPhotos, setMapPhotos] = useState<any[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [showSampleImages, setShowSampleImages] = useState(false);
  const [showGPSTest, setShowGPSTest] = useState(false);
  const [showGPSChecker, setShowGPSChecker] = useState(false);

  const loadSampleImages = async () => {
    setIsProcessing(true);
    setResults([]);

    const sampleImages = [
      'jeju-olle-3-1.jpg',
      'zoo-1.jpg', 
      'jeju-olle-19-1.jpg'
    ];

    const newResults: TestResult[] = [];

    for (const filename of sampleImages) {
      try {
        // 샘플 이미지 로드
        const response = await fetch(`/sample-images/${filename}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });
        
        // 원본 이미지 정보
        const img = new Image();
        const originalInfo = await new Promise<{width: number; height: number}>((resolve, reject) => {
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
        
        const result: TestResult = {
          filename,
          original: {
            size: file.size,
            width: originalInfo.width,
            height: originalInfo.height
          },
          thumbnails: []
        };

        // 썸네일 생성 테스트
        const sizes = [
          { name: 'small', size: 150 },
          { name: 'medium', size: 300 },
          { name: 'large', size: 600 }
        ];

        for (const { name, size } of sizes) {
          const options: ThumbnailOptions = {
            size,
            quality: 0.8,
            format: 'jpeg',
            mode: 'crop'
          };

          const thumbnailResult = await createThumbnail(file, options);
          
          if (thumbnailResult.success) {
            result.thumbnails.push({
              name,
              dataUrl: thumbnailResult.dataUrl,
              width: thumbnailResult.width,
              height: thumbnailResult.height,
              size: thumbnailResult.size
            });
          }
        }

        newResults.push(result);
        
      } catch (error) {
        newResults.push({
          filename,
          original: { size: 0, width: 0, height: 0 },
          thumbnails: [],
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    setResults(newResults);
    setIsProcessing(false);
  };

  const loadMapTest = async () => {
    setIsProcessing(true);
    setMapPhotos([]);
    setShowMap(false);

    try {
      const mapTestData = [];
      
      for (const sampleData of samplePhotos.slice(0, 6)) {
        try {
          const file = await createFileFromSample(sampleData);
          const mapPhoto = {
            file,
            description: sampleData.description,
            location: sampleData.location,
            exifData: sampleData.exifData,
            uploadedAt: sampleData.uploadedAt
          };
          mapTestData.push(mapPhoto);
        } catch (error) {
          console.warn(`Failed to load ${sampleData.filename}:`, error);
        }
      }

      setMapPhotos(mapTestData);
      setShowMap(true);
    } catch (error) {
      console.error('Map test failed:', error);
    }

    setIsProcessing(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 샘플 이미지 기능 테스트</h1>
      
      <TestSummary />
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={loadSampleImages}
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginRight: '12px'
          }}
        >
          {isProcessing ? '처리 중...' : '🖼️ 썸네일 테스트'}
        </button>
        
        <button 
          onClick={loadMapTest}
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginRight: '12px'
          }}
        >
          {isProcessing ? '처리 중...' : '🗺️ 지도 테스트'}
        </button>
        
        <button 
          onClick={() => setShowSampleImages(!showSampleImages)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            marginRight: '12px'
          }}
        >
          {showSampleImages ? '숨기기' : '📁 모든 샘플 이미지 보기'}
        </button>
        
        <button 
          onClick={() => setShowGPSTest(!showGPSTest)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            marginRight: '12px'
          }}
        >
          {showGPSTest ? '숨기기' : '🧭 GPS 마커 테스트'}
        </button>
        
        <button 
          onClick={() => setShowGPSChecker(!showGPSChecker)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {showGPSChecker ? '숨기기' : '🔍 전체 GPS 체크'}
        </button>
      </div>

      {results.length > 0 && (
        <div>
          <h2>📊 테스트 결과</h2>
          
          {results.map((result, index) => (
            <div key={index} style={{ 
              marginBottom: '30px', 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}>
              <h3>📸 {result.filename}</h3>
              
              {result.error ? (
                <div style={{ color: 'red' }}>❌ 오류: {result.error}</div>
              ) : (
                <>
                  <div style={{ marginBottom: '15px' }}>
                    <strong>원본:</strong> {result.original.width}x{result.original.height}, {formatBytes(result.original.size)}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                    {result.thumbnails.map((thumb, thumbIndex) => (
                      <div key={thumbIndex} style={{ 
                        border: '1px solid #ccc', 
                        borderRadius: '8px', 
                        padding: '10px',
                        backgroundColor: 'white'
                      }}>
                        <div style={{ marginBottom: '8px' }}>
                          <strong>{thumb.name}</strong> ({thumb.width}x{thumb.height})
                        </div>
                        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                          크기: {formatBytes(thumb.size)}
                        </div>
                        <img 
                          src={thumb.dataUrl} 
                          alt={`${result.filename} ${thumb.name}`}
                          style={{ 
                            width: '100%', 
                            height: 'auto', 
                            border: '1px solid #eee',
                            borderRadius: '4px'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showMap && (
        <div style={{ marginTop: '30px' }}>
          <h2>🗺️ 지도 연동 테스트</h2>
          <div style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            overflow: 'hidden',
            backgroundColor: '#f9f9f9'
          }}>
            <div style={{ padding: '15px', backgroundColor: '#e5f3ff', borderBottom: '1px solid #ddd' }}>
              <strong>📊 로드된 사진 정보:</strong>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                <li>총 {mapPhotos.length}개 사진</li>
                <li>GPS 위치 있음: {mapPhotos.filter(p => p.location).length}개</li>
                <li>GPS 위치 없음: {mapPhotos.filter(p => !p.location).length}개</li>
              </ul>
            </div>
            <div style={{ height: '400px' }}>
              <MapView photos={mapPhotos} />
            </div>
          </div>
          
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f9ff', borderRadius: '8px' }}>
            <h3>📍 예상 결과:</h3>
            <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
              <li><strong>제주 올레 3코스 사진 3개</strong>: 제주도 남부 해안가에 마커 표시</li>
              <li><strong>서울대공원, 제주 올레 19코스 사진들</strong>: GPS 정보 없어 마커 표시 안됨</li>
              <li><strong>여행 경로</strong>: 제주 올레 3코스 사진들이 시간순으로 연결된 점선</li>
            </ul>
          </div>
        </div>
      )}

      {showSampleImages && (
        <div style={{ marginTop: '30px' }}>
          <h2>📁 모든 샘플 이미지</h2>
          <div style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            padding: '20px',
            backgroundColor: '#f9f9f9'
          }}>
            <SampleImageLoader />
          </div>
        </div>
      )}

      {showGPSTest && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ 
            border: '1px solid #ddd', 
            borderRadius: '8px', 
            padding: '20px',
            backgroundColor: '#f9f9f9'
          }}>
            <SampleImageTester />
          </div>
        </div>
      )}

      {showGPSChecker && (
        <div style={{ marginTop: '30px' }}>
          <div style={{ 
            border: '2px solid #dc2626', 
            borderRadius: '10px', 
            padding: '20px',
            backgroundColor: '#fef2f2'
          }}>
            <GPSChecker />
          </div>
        </div>
      )}
    </div>
  );
};