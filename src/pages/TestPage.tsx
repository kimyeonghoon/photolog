import React, { useState } from 'react';
import { createThumbnail, type ThumbnailOptions } from '../utils/thumbnailGenerator';
import { MapView } from '../components/MapView';
import { TestSummary } from '../components/TestSummary';
import { SampleImageLoader } from '../components/SampleImageLoader';
import { SampleImageTester } from '../components/SampleImageTester';
import { GPSChecker } from '../components/GPSChecker';
import { samplePhotos, createFileFromSample } from '../data/sampleData';
import { PageHeader } from '../components/PageHeader';

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

interface TestPageProps {
  onBackClick?: () => void;
  onUploadClick?: () => void;
  onMapClick?: () => void;
}

export const TestPage: React.FC<TestPageProps> = ({ onBackClick, onUploadClick, onMapClick }) => {
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
            width: size,
            height: size,
            quality: 0.8,
            format: 'jpeg',
            mode: 'crop'
          };

          const thumbnailResult = await createThumbnail(file, options);
          
          if (thumbnailResult) {
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

  const headerButtons = [
    {
      icon: '🏠',
      text: '홈으로',
      onClick: onBackClick || (() => {}),
      variant: 'secondary' as const
    },
    {
      icon: '📤',
      text: '사진 업로드',
      onClick: onUploadClick || (() => {}),
      variant: 'primary' as const
    },
    {
      icon: '📍',
      text: '지도 보기', 
      onClick: onMapClick || (() => {}),
      variant: 'success' as const
    },
    {
      icon: '🧪',
      text: '테스트',
      onClick: () => {},
      variant: 'secondary' as const,
      active: true,
      style: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: 'white' }
    }
  ];

  return (
    <div className="test-page">
      <PageHeader 
        currentPage="test"
        buttons={headerButtons}
      />
      <main className="test-page-main">
        <div className="space-y-8">
          <TestSummary />
          
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={loadSampleImages}
              disabled={isProcessing}
              className="btn btn-primary"
            >
              {isProcessing ? '처리 중...' : '🖼️ 썸네일 테스트'}
            </button>
            
            <button 
              onClick={loadMapTest}
              disabled={isProcessing}
              className="btn btn-success"
            >
              {isProcessing ? '처리 중...' : '🗺️ 지도 테스트'}
            </button>
            
            <button 
              onClick={() => setShowSampleImages(!showSampleImages)}
              className="btn btn-secondary"
              style={{ backgroundColor: '#8b5cf6', borderColor: '#8b5cf6', color: 'white' }}
            >
              {showSampleImages ? '숨기기' : '📁 모든 샘플 이미지 보기'}
            </button>
            
            <button 
              onClick={() => setShowGPSTest(!showGPSTest)}
              className="btn btn-secondary"
              style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: 'white' }}
            >
              {showGPSTest ? '숨기기' : '🧭 GPS 마커 테스트'}
            </button>
            
            <button 
              onClick={() => setShowGPSChecker(!showGPSChecker)}
              className="btn btn-secondary font-bold"
              style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', color: 'white' }}
            >
              {showGPSChecker ? '숨기기' : '🔍 전체 GPS 체크'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">📊 테스트 결과</h2>
              
              {results.map((result, index) => (
                <div key={index} className="card card-elevated space-y-4">
                  <h3 className="text-xl font-medium">📸 {result.filename}</h3>
                  
                  {result.error ? (
                    <div className="text-red-500 font-medium">❌ 오류: {result.error}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm">
                        <strong>원본:</strong> {result.original.width}x{result.original.height}, {formatBytes(result.original.size)}
                      </div>
                      
                      <div className="grid grid-auto gap-4">
                        {result.thumbnails.map((thumb, thumbIndex) => (
                          <div key={thumbIndex} className="card">
                            <div className="space-y-2">
                              <div className="font-medium">
                                {thumb.name} ({thumb.width}x{thumb.height})
                              </div>
                              <div className="text-sm text-secondary">
                                크기: {formatBytes(thumb.size)}
                              </div>
                              <img 
                                src={thumb.dataUrl} 
                                alt={`${result.filename} ${thumb.name}`}
                                className="w-full rounded border"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {showMap && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">🗺️ 지도 연동 테스트</h2>
              <div className="card card-elevated">
                <div className="card-header">
                  <div className="card-subtitle">
                    <strong>📊 로드된 사진 정보:</strong>
                    <ul className="space-y-1 mt-2 ml-5">
                      <li>총 {mapPhotos.length}개 사진</li>
                      <li>GPS 위치 있음: {mapPhotos.filter(p => p.location).length}개</li>
                      <li>GPS 위치 없음: {mapPhotos.filter(p => !p.location).length}개</li>
                    </ul>
                  </div>
                </div>
                <div style={{ height: '400px' }}>
                  <MapView photos={mapPhotos} />
                </div>
              </div>
              
              <div className="card">
                <h3 className="card-title text-lg">📍 예상 결과:</h3>
                <ul className="space-y-1 mt-3 ml-5">
                  <li><strong>제주 올레 3코스 사진 3개</strong>: 제주도 남부 해안가에 마커 표시</li>
                  <li><strong>서울대공원, 제주 올레 19코스 사진들</strong>: GPS 정보 없어 마커 표시 안됨</li>
                  <li><strong>여행 경로</strong>: 제주 올레 3코스 사진들이 시간순으로 연결된 점선</li>
                </ul>
              </div>
            </div>
          )}

          {showSampleImages && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">📁 모든 샘플 이미지</h2>
              <div className="card">
                <SampleImageLoader />
              </div>
            </div>
          )}

          {showGPSTest && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">🧭 GPS 마커 테스트</h2>
              <div className="card">
                <SampleImageTester />
              </div>
            </div>
          )}

          {showGPSChecker && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">🔍 전체 GPS 체크</h2>
              <div className="card card-elevated" style={{ borderColor: '#dc2626', backgroundColor: 'var(--bg-secondary)' }}>
                <GPSChecker />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};