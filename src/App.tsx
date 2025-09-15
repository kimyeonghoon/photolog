import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { MapPage } from './pages/MapPage'
import { ThemeProvider } from './contexts/ThemeContext'
import { uploadMultiplePhotos } from './services/photoAPI'
import type { UnifiedPhotoData } from './types'
import './App.css'
import './components/MultiPhotoUpload.css'
import './styles/theme.css'
import './styles/design-system.css'

// 타입 정의 - 로컬 업로드 데이터 (기존 호환성 유지)
interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: {
    dataUrl: string;
    width: number;
    height: number;
    size: number;
  };
  standardThumbnails?: { [key: string]: { dataUrl: string; width: number; height: number; size: number } };
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
}


function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<UnifiedPhotoData[]>([])
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'map'>('home')
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async (dataArray: PhotoUploadData[]) => {
    setIsUploading(true);

    try {
      console.log(`API로 업로드할 사진 ${dataArray.length}개:`, dataArray);

      // API를 통한 업로드 (처리된 데이터와 함께)
      const uploadFilesWithData = dataArray.map(data => ({
        file: data.file,
        description: data.description,
        thumbnails: data.standardThumbnails,
        exifData: data.exifData,
        location: data.location
      }));

      const results = await uploadMultiplePhotos(
        uploadFilesWithData,
        (completed, total, currentFile) => {
          console.log(`업로드 진행: ${completed}/${total} ${currentFile || ''}`);
        }
      );

      // 성공한 업로드만 처리
      const successfulUploads: UnifiedPhotoData[] = [];
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.success && result.data) {
          const serverData: UnifiedPhotoData = {
            id: result.data.photo_id,
            filename: result.data.filename,
            description: dataArray[index].description,
            file_url: result.data.file_url,
            thumbnail_urls: result.data.thumbnail_urls, // 썸네일 URL들 추가
            file_size: result.data.file_size,
            location: result.data.location,
            exifData: result.data.exif_data,
            uploadedAt: new Date()
          };
          successfulUploads.push(serverData);
        } else {
          failedCount++;
          console.error(`파일 ${dataArray[index].file.name} 업로드 실패:`, result.message);
        }
      });

      // 성공한 업로드를 상태에 추가
      if (successfulUploads.length > 0) {
        setUploadedPhotos(prev => [...successfulUploads, ...prev]);
      }

      // 업로드 완료 후 홈으로 이동
      setCurrentPage('home');

      // 결과 메시지
      const successCount = successfulUploads.length;
      const locationCount = successfulUploads.filter(p => p.location).length;

      if (failedCount === 0) {
        alert(`${successCount}장의 사진이 성공적으로 업로드되었습니다!\n위치 정보: ${locationCount}장 포함`);
      } else {
        alert(`${successCount}장 성공, ${failedCount}장 실패\n위치 정보: ${locationCount}장 포함`);
      }

    } catch (error) {
      console.error('업로드 중 오류:', error);
      alert(`업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsUploading(false);
    }
  }

  const handleError = (error: string) => {
    console.error('업로드 에러:', error)
  }

  const handleUploadClick = () => {
    setCurrentPage('upload')
  }

  const handleBackClick = () => {
    setCurrentPage('home')
  }

  const handleMapClick = () => {
    setCurrentPage('map')
  }


  return (
    <ThemeProvider>
      <div className="app">
        {currentPage === 'home' ? (
          <HomePage 
            photos={uploadedPhotos}
            onUploadClick={handleUploadClick}
            onMapClick={handleMapClick}
          />
        ) : currentPage === 'upload' ? (
          <UploadPage
            onUpload={handleUpload}
            onError={handleError}
            onBackClick={handleBackClick}
            onMapClick={() => setCurrentPage('map')}
            isUploading={isUploading}
          />
        ) : (
          <MapPage 
            photos={uploadedPhotos}
            onBackClick={handleBackClick}
            onUploadClick={() => setCurrentPage('upload')}
          />
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
