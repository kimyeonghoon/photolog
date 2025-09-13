import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { TestPage } from './pages/TestPage'
import { MapView } from './components/MapView'
import { ThemeProvider } from './contexts/ThemeContext'
import './App.css'
import './components/MultiPhotoUpload.css'
import './styles/theme.css'
import './styles/design-system.css'

// 타입 정의 - 업로드 시 받는 데이터
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
  exifData?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  } | null;
}

// 저장된 사진 데이터
interface StoredPhotoData extends PhotoUploadData {
  uploadedAt: Date;
}

function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<StoredPhotoData[]>([])
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'map' | 'test'>('home')

  const handleUpload = (dataArray: PhotoUploadData[]) => {
    // 다중 파일 업로드만 지원
    const dataList = dataArray;
    
    console.log(`업로드된 사진 데이터 ${dataList.length}개:`, dataList);
    
    // 업로드 시간 추가
    const photosWithTimestamp: StoredPhotoData[] = dataList.map(data => ({
      ...data,
      uploadedAt: new Date()
    }));
    
    setUploadedPhotos(prev => [...photosWithTimestamp, ...prev]) // 최신 사진들이 맨 앞에 오도록
    
    // 업로드 완료 후 홈으로 이동
    setCurrentPage('home')
    
    // 성공 메시지
    const locationCount = dataList.filter(d => d.location).length;
    alert(`${dataList.length}장의 사진이 업로드되었습니다!\n위치 정보: ${locationCount}장 포함`)
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

  const handleTestClick = () => {
    setCurrentPage('test')
  }

  return (
    <ThemeProvider>
      <div className="app">
        {currentPage === 'home' ? (
          <HomePage 
            photos={uploadedPhotos}
            onUploadClick={handleUploadClick}
            onMapClick={handleMapClick}
            onTestClick={handleTestClick}
          />
        ) : currentPage === 'upload' ? (
          <UploadPage 
            onUpload={handleUpload}
            onError={handleError}
            onBackClick={handleBackClick}
          />
        ) : currentPage === 'test' ? (
          <TestPage onBackClick={handleBackClick} />
        ) : (
          <div className="page-layout">
            <header className="page-header">
              <button onClick={handleBackClick} className="btn-back">
                ← 돌아가기
              </button>
              <h1>📍 지도</h1>
            </header>
            <div className="page-content" style={{ padding: 0, maxWidth: 'none' }}>
              <MapView photos={uploadedPhotos} />
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
