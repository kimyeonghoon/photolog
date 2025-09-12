import { useState } from 'react'
import { PhotoUpload } from './components/PhotoUpload'
import './App.css'
import './components/PhotoUpload.css'

// 타입 정의
interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoUploadData[]>([])

  const handleUpload = (data: PhotoUploadData) => {
    console.log('업로드된 사진 데이터:', data)
    setUploadedPhotos(prev => [...prev, data])
    alert(`사진이 업로드되었습니다!\n설명: ${data.description}\n위치: ${data.location ? `${data.location.latitude}, ${data.location.longitude}` : '없음'}`)
  }

  const handleError = (error: string) => {
    console.error('업로드 에러:', error)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📸 여행 포토로그</h1>
        <p>사진을 업로드하고 여행 기록을 남겨보세요</p>
      </header>

      <main className="app-main">
        <PhotoUpload 
          onUpload={handleUpload}
          onError={handleError}
        />

        {uploadedPhotos.length > 0 && (
          <div className="uploaded-photos">
            <h2>업로드된 사진 ({uploadedPhotos.length}장)</h2>
            <div className="photos-grid">
              {uploadedPhotos.map((photo, index) => (
                <div key={index} className="photo-item">
                  <img 
                    src={URL.createObjectURL(photo.file)} 
                    alt={photo.description || '업로드된 사진'} 
                    className="photo-thumbnail"
                  />
                  <p className="photo-description">{photo.description}</p>
                  {photo.location && (
                    <p className="photo-location">
                      📍 {photo.location.latitude.toFixed(4)}, {photo.location.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
