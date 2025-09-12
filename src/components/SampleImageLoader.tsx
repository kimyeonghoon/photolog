import React, { useState, useEffect } from 'react';
import './SampleImageLoader.css';

interface SampleImageLoaderProps {
  onLoadComplete?: (images: string[]) => void;
}

export const SampleImageLoader: React.FC<SampleImageLoaderProps> = ({ onLoadComplete }) => {
  const [images, setImages] = useState<string[]>([]);
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
      setLoadedCount(imagePaths.length);
      onLoadComplete?.(imagePaths);
      
    } catch (err) {
      console.error('샘플 이미지 로드 실패:', err);
      setError('이미지를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
      <h2>샘플 이미지 ({images.length}개)</h2>
      <div className="sample-images-grid">
        {images.map((imageSrc, index) => (
          <div key={index} className="sample-image-card">
            <img 
              src={imageSrc} 
              alt={`Sample ${index + 1}`}
              loading="lazy"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <div className="sample-image-info">
              <span>{imageSrc.split('/').pop()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};