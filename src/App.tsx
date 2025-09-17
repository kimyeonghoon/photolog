import { useState, useEffect } from 'react'
import { HomePage } from './pages/HomePage'
import { UploadPage } from './pages/UploadPage'
import { MapPage } from './pages/MapPage'
import { ThemeProvider } from './contexts/ThemeContext'
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


function App() {
  const [uploadedPhotos, setUploadedPhotos] = useState<UnifiedPhotoData[]>([])
  const [currentPage, setCurrentPage] = useState<'home' | 'upload' | 'map'>('home')
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 앱 시작 시 서버에서 기존 사진 목록 불러오기
  useEffect(() => {
    const loadExistingPhotos = async () => {
      try {
        console.log('🔄 서버에서 기존 사진 목록 불러오는 중...')
        const apiClient = new PhotoAPIClient()
        const response = await apiClient.getPhotos(50, 0, 'upload_timestamp DESC')

        if (response.success && response.data) {
          console.log(`✅ ${response.data.photos.length}개 사진을 서버에서 불러왔습니다`)

          // 서버 데이터를 UnifiedPhotoData 형식으로 변환
          const serverPhotos: UnifiedPhotoData[] = response.data.photos.map(photo => ({
            id: photo.id, // 이제 API가 photo.id를 반환함
            filename: photo.filename,
            file_url: photo.file_url,
            thumbnail_urls: photo.thumbnail_urls,
            file: null, // 서버에서 불러온 데이터는 File 객체가 없음
            description: photo.description || '',
            location: photo.location || undefined,
            thumbnail: undefined, // 서버 데이터는 thumbnail (로컬 dataUrl) 사용하지 않음
            standardThumbnails: undefined, // 서버 데이터는 standardThumbnails (로컬 dataUrl) 사용하지 않음
            exifData: photo.exif_data || null,
            uploadedAt: new Date(photo.upload_timestamp || Date.now()),
            serverData: {
              fileUrl: photo.file_url,
              thumbnailUrls: photo.thumbnail_urls || {},
              uploadTimestamp: photo.upload_timestamp,
              fileSize: photo.file_size
            }
          }))

          setUploadedPhotos(serverPhotos)
        } else {
          console.log('⚠️ 서버에서 사진 목록을 불러오지 못했습니다:', response.message)
        }
      } catch (error) {
        console.error('❌ 사진 목록 불러오기 실패:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExistingPhotos()
  }, [])

  const handleUpload = async (dataArray: PhotoUploadData[]) => {
    setIsUploading(true);

    try {
      console.log(`🚀 handleUpload 호출됨 - 받은 데이터:`, dataArray);
      console.log(`🔍 데이터 타입 및 구조 확인:`, dataArray.map(data => ({
        filename: data.file?.name,
        hasStandardThumbnails: !!data.standardThumbnails,
        standardThumbnailsType: typeof data.standardThumbnails,
        keys: data.standardThumbnails ? Object.keys(data.standardThumbnails) : 'N/A',
        actualValue: data.standardThumbnails
      })));

      console.log(`📋 API로 업로드할 사진 ${dataArray.length}개:`, dataArray);

      // 썸네일 데이터 디버깅
      dataArray.forEach((data, index) => {
        console.log(`📸 사진 ${index + 1}:`, {
          filename: data.file.name,
          hasStandardThumbnails: !!data.standardThumbnails,
          thumbnailSizes: data.standardThumbnails ? Object.keys(data.standardThumbnails) : [],
          thumbnailInfo: data.standardThumbnails ? Object.entries(data.standardThumbnails).map(([size, thumb]) => ({
            size,
            hasDataUrl: !!thumb?.dataUrl,
            width: thumb?.width,
            height: thumb?.height
          })) : []
        });
      });

      // API를 통한 업로드 (처리된 데이터와 함께)
      const uploadFilesWithData = dataArray.map(data => {
        // standardThumbnails를 PhotoAPI가 기대하는 형태로 변환
        console.log(`🔍 변환 전 standardThumbnails (${data.file.name}):`, data.standardThumbnails);

        let thumbnails: { [key: string]: { dataUrl: string } } | undefined;
        if (data.standardThumbnails) {
          thumbnails = {};
          console.log(`📝 변환 시작 - entries:`, Object.entries(data.standardThumbnails));

          Object.entries(data.standardThumbnails).forEach(([size, thumbnailResult]) => {
            console.log(`🔧 처리 중 - ${size}:`, {
              hasResult: !!thumbnailResult,
              hasDataUrl: !!thumbnailResult?.dataUrl,
              dataUrlLength: thumbnailResult?.dataUrl?.length || 0
            });

            if (thumbnailResult?.dataUrl) {
              thumbnails![size] = { dataUrl: thumbnailResult.dataUrl };
              console.log(`✅ 변환 성공 - ${size}`);
            } else {
              console.log(`❌ 변환 실패 - ${size}: dataUrl 없음`);
            }
          });

          console.log(`📊 변환 후 thumbnails:`, Object.keys(thumbnails));
        } else {
          console.log(`❌ standardThumbnails가 없습니다`);
        }

        const result = {
          file: data.file,
          description: data.description,
          thumbnails,
          exifData: data.exifData,
          location: data.location
        };

        // 변환된 썸네일 데이터 로그
        console.log(`🔄 변환된 썸네일 데이터 (${data.file.name}):`, {
          hasThumbnails: !!thumbnails,
          thumbnailSizes: thumbnails ? Object.keys(thumbnails) : [],
          thumbnailCount: thumbnails ? Object.keys(thumbnails).length : 0
        });

        return result;
      });

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
