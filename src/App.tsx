import { useState, useEffect } from 'react'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { MapPage } from './pages/MapPage'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginModal } from './components/LoginModal'
import { uploadMultiplePhotos, PhotoAPIClient } from './services/photoAPI'
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


function MainApp() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [uploadedPhotos, setUploadedPhotos] = useState<UnifiedPhotoData[]>([])
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'map'>('home')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // 페이징 관련 상태
  const [pagination, setPagination] = useState({
    currentOffset: 0,
    pageSize: 20,
    hasMore: true,
    isLoadingMore: false
  })

  // 앱 시작 시 서버에서 기존 사진 목록 불러오기
  useEffect(() => {
    const loadExistingPhotos = async () => {
      try {
        const apiClient = new PhotoAPIClient()
        // EXIF 촬영시간을 우선으로 하는 정렬 (EXIF가 없으면 업로드 시간 사용)
        const response = await apiClient.getPhotos(
          pagination.pageSize,
          0,
          'COALESCE(exif_data->>"timestamp", upload_timestamp) DESC'
        )

        if (response.success && response.data) {

          // 서버 데이터를 UnifiedPhotoData 형식으로 변환
          const serverPhotos: UnifiedPhotoData[] = response.data.photos.map(photo => ({
            id: photo.id, // 이제 API가 photo.id를 반환함
            filename: photo.filename,
            file_url: photo.file_url,
            thumbnail_urls: photo.thumbnail_urls,
            file_size: photo.file_size, // 파일 크기 정보 추가
            file: null, // 서버에서 불러온 데이터는 File 객체가 없음
            description: photo.description || '',
            location: photo.location || undefined,
            thumbnail: undefined, // 서버 데이터는 thumbnail (로컬 dataUrl) 사용하지 않음
            standardThumbnails: undefined, // 서버 데이터는 standardThumbnails (로컬 dataUrl) 사용하지 않음
            exifData: photo.exif_data ? (typeof photo.exif_data === 'string' ? (() => {
              try { return JSON.parse(photo.exif_data); } catch (e) { console.warn('EXIF data parsing failed:', e); return null; }
            })() : photo.exif_data) : null,
            uploadedAt: new Date(photo.upload_timestamp || Date.now()),
            serverData: {
              fileUrl: photo.file_url,
              thumbnailUrls: photo.thumbnail_urls || {},
              uploadTimestamp: photo.upload_timestamp,
              fileSize: photo.file_size
            }
          }))

          setUploadedPhotos(serverPhotos)

          // 페이징 상태 업데이트
          setPagination(prev => ({
            ...prev,
            currentOffset: serverPhotos.length,
            hasMore: response.data?.has_more || false
          }))
        } else {
        }
      } catch (error) {
        console.error('❌ 사진 목록 불러오기 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingPhotos()
  }, [])

  // 더 많은 사진 로드 함수
  const loadMorePhotos = async () => {
    if (!pagination.hasMore || pagination.isLoadingMore) return

    setPagination(prev => ({ ...prev, isLoadingMore: true }))

    try {
      const apiClient = new PhotoAPIClient()
      const response = await apiClient.getPhotos(
        pagination.pageSize,
        pagination.currentOffset,
        'COALESCE(exif_data->>"timestamp", upload_timestamp) DESC'
      )

      if (response.success && response.data) {

        const additionalPhotos: UnifiedPhotoData[] = response.data.photos.map(photo => ({
          id: photo.id,
          filename: photo.filename,
          file_url: photo.file_url,
          thumbnail_urls: photo.thumbnail_urls,
          file_size: photo.file_size,
          file: null,
          description: photo.description || '',
          location: photo.location || undefined,
          thumbnail: undefined,
          standardThumbnails: undefined,
          exifData: photo.exif_data ? (typeof photo.exif_data === 'string' ? (() => {
            try { return JSON.parse(photo.exif_data); } catch (e) { console.warn('EXIF data parsing failed:', e); return null; }
          })() : photo.exif_data) : null,
          uploadedAt: new Date(photo.upload_timestamp || Date.now()),
          serverData: {
            fileUrl: photo.file_url,
            thumbnailUrls: photo.thumbnail_urls || {},
            uploadTimestamp: photo.upload_timestamp,
            fileSize: photo.file_size
          }
        }))

        setUploadedPhotos(prev => [...prev, ...additionalPhotos])

        setPagination(prev => ({
          ...prev,
          currentOffset: prev.currentOffset + additionalPhotos.length,
          hasMore: response.data?.has_more || false
        }))
      }
    } catch (error) {
      console.error('❌ 추가 사진 로드 실패:', error)
    } finally {
      setPagination(prev => ({ ...prev, isLoadingMore: false }))
    }
  }

  const handleUpload = async (dataArray: PhotoUploadData[]) => {
    setIsUploading(true);

    try {

      // API를 통한 업로드 (처리된 데이터와 함께)
      const uploadFilesWithData = dataArray.map(data => {
        // standardThumbnails를 PhotoAPI가 기대하는 형태로 변환
        let thumbnails: { [key: string]: { dataUrl: string } } | undefined;
        if (data.standardThumbnails) {
          thumbnails = {};
          Object.entries(data.standardThumbnails).forEach(([size, thumbnailResult]) => {
            if (thumbnailResult?.dataUrl) {
              thumbnails![size] = { dataUrl: thumbnailResult.dataUrl };
            }
          });
        }

        const result = {
          file: data.file,
          description: data.description,
          thumbnails,
          exifData: data.exifData,
          location: data.location
        };

        return result;
      });

      const results = await uploadMultiplePhotos(uploadFilesWithData);

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
    console.log('Upload button clicked, authenticated:', isAuthenticated) // 디버깅용
    if (!isAuthenticated) {
      console.log('Not authenticated, showing login modal') // 디버깅용
      setShowLoginModal(true)
      return
    }
    console.log('Authenticated, going to upload page') // 디버깅용
    setCurrentPage('upload')
  }

  const handleBackClick = () => {
    setCurrentPage('home')
  }

  const handleMapClick = () => {
    setCurrentPage('map')
  }

  const handlePhotoDeleted = (photoId: string) => {
    // 삭제된 사진을 상태에서 제거
    setUploadedPhotos(prev => prev.filter(photo => photo.id !== photoId))
  }

  const handlePhotoUpdated = (photoId: string, updates: { description?: string; timestamp?: string }) => {
    // 업데이트된 사진 정보를 상태에 반영
    setUploadedPhotos(prev => prev.map(photo => {
      if (photo.id === photoId) {
        const updatedPhoto = { ...photo };

        // 설명 업데이트
        if (updates.description !== undefined) {
          updatedPhoto.description = updates.description;
        }

        // 시간 업데이트 (EXIF 데이터가 없는 경우에만)
        if (updates.timestamp !== undefined && !photo.exifData?.timestamp) {
          if (updatedPhoto.exifData) {
            updatedPhoto.exifData.timestamp = updates.timestamp;
          } else {
            updatedPhoto.exifData = { timestamp: updates.timestamp };
          }
        }

        return updatedPhoto;
      }
      return photo;
    }));
  }


  // 인증 로딩 중일 때
  if (authLoading) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '18px', marginBottom: '10px' }}>🔐 인증 상태 확인 중...</div>
        <div style={{ fontSize: '14px', color: '#666' }}>로그인 정보를 확인하고 있습니다</div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* 인증 상태 표시 */}
      {isAuthenticated && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔐 로그인됨</span>
          <button
            onClick={logout}
            style={{
              background: 'transparent',
              border: '1px solid white',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>🔄 사진을 불러오는 중...</div>
          <div style={{ fontSize: '14px', color: '#666' }}>서버에서 기존 사진 목록을 가져오고 있습니다</div>
        </div>
      ) : currentPage === 'home' ? (
        <HomePage
          photos={uploadedPhotos}
          onUploadClick={handleUploadClick}
          onMapClick={handleMapClick}
          onPhotoDeleted={handlePhotoDeleted}
          onPhotoUpdated={handlePhotoUpdated}
          pagination={{
            hasMore: pagination.hasMore,
            isLoadingMore: pagination.isLoadingMore,
            onLoadMore: loadMorePhotos
          }}
          authState={{ isAuthenticated, onLoginClick: () => setShowLoginModal(true) }}
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
          onUploadClick={handleUploadClick}
        />
      )}

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false)
          // 로그인 성공 후 업로드 페이지로 이동
          setTimeout(() => {
            setCurrentPage('upload')
          }, 500)
        }}
      />
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
