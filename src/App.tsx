import { useState } from 'react'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { MapView } from './components/MapView'
import './App.css'
import './components/PhotoUpload.css'

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
}

// 저장된 사진 데이터
interface StoredPhotoData extends PhotoUploadData {
  uploadedAt: Date;
}

function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<StoredPhotoData[]>([])
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'map'>('home')

  const handleUpload = (data: PhotoUploadData) => {
    console.log('업로드된 사진 데이터:', data)
    
    // 업로드 시간 추가
    const photoWithTimestamp: StoredPhotoData = {
      ...data,
      uploadedAt: new Date()
    };
    
    setUploadedPhotos(prev => [photoWithTimestamp, ...prev]) // 최신 사진이 맨 앞에 오도록
    
    // 업로드 완료 후 홈으로 이동
    setCurrentPage('home')
    
    alert(`사진이 업로드되었습니다!\n설명: ${data.description}\n위치: ${data.location ? '위치 정보 포함' : '위치 정보 없음'}`)
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
        />
      ) : (
        <div className="map-page">
          <header className="map-header">
            <button onClick={handleBackClick} className="back-button">
              ← 돌아가기
            </button>
            <h1>📍 지도</h1>
          </header>
          <MapView photos={uploadedPhotos} />
        </div>
      )}
    </div>
  )
}

export default App
