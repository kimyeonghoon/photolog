import React, { useState, useRef, useCallback } from 'react';
import exifr from 'exifr';
import { 
  createThumbnail, 
  canCreateThumbnail,
  type ThumbnailResult
} from '../utils/thumbnailGenerator';

// 타입 정의
interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: ThumbnailResult;
  thumbnails?: { [key: string]: ThumbnailResult };
  exifData?: ExifData;
}

interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  lens?: string;
  [key: string]: string | number | boolean | undefined;
}

interface PhotoUploadProps {
  onUpload: (data: PhotoUploadData) => void;
  onError: (error: string) => void;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  preview: string | null;
  file: File | null;
  description: string;
  exifData: ExifData | null;
  error: string | null;
  thumbnail: ThumbnailResult | null;
  thumbnails: { [key: string]: ThumbnailResult };
  thumbnailGenerating: boolean;
  thumbnailError: string | null;
}

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ onUpload, onError }) => {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    preview: null,
    file: null,
    description: '',
    exifData: null,
    error: null,
    thumbnail: null,
    thumbnails: {},
    thumbnailGenerating: false,
    thumbnailError: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return '지원되지 않는 파일 형식입니다. JPG, PNG, HEIC 파일만 업로드 가능합니다.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기가 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다.';
    }
    return null;
  }, []);

  const extractExifData = useCallback(async (file: File): Promise<ExifData | null> => {
    try {
      const exif = await exifr.parse(file);
      if (!exif) return null;

      const exifData: ExifData = {};

      // GPS 정보 추출
      if (exif.latitude && exif.longitude) {
        exifData.latitude = exif.latitude;
        exifData.longitude = exif.longitude;
      }

      // 촬영 시간
      if (exif.DateTimeOriginal) {
        exifData.timestamp = exif.DateTimeOriginal.toISOString();
      }

      // 카메라 정보
      if (exif.Make || exif.Model) {
        exifData.camera = [exif.Make, exif.Model].filter(Boolean).join(' ');
      }

      // 렌즈 정보
      if (exif.LensModel) {
        exifData.lens = exif.LensModel;
      }

      return exifData;
    } catch (error) {
      console.warn('EXIF 데이터 추출 실패:', error);
      return null;
    }
  }, []);

  const generateThumbnails = useCallback(async (file: File) => {
    const canCreate = canCreateThumbnail(file);
    if (!canCreate.canCreate) {
      const errorMessage = `썸네일 생성 불가: ${canCreate.reason}`;
      console.warn(errorMessage);
      setState(prev => ({ 
        ...prev, 
        thumbnailError: errorMessage
      }));
      return;
    }

    setState(prev => ({ 
      ...prev, 
      thumbnailGenerating: true, 
      thumbnailError: null 
    }));

    try {
      // 300x300 썸네일 하나만 생성
      const thumbnail = await createThumbnail(file, {
        width: 300,
        height: 300,
        mode: 'crop',
        quality: 0.8
      });

      setState(prev => ({ 
        ...prev, 
        thumbnail: thumbnail,
        thumbnails: { medium: thumbnail }, // 호환성을 위해 medium으로 저장
        thumbnailGenerating: false,
        thumbnailError: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? `썸네일 생성 실패: ${error.message}`
        : '썸네일 생성 중 알 수 없는 오류가 발생했습니다.';
      
      console.error('썸네일 생성 실패:', error);
      setState(prev => ({ 
        ...prev, 
        thumbnailError: errorMessage,
        thumbnailGenerating: false 
      }));
    }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      onError(validationError);
      return;
    }

    setState(prev => ({ ...prev, isUploading: true, progress: 0, error: null }));

    try {
      // 미리보기 생성
      const preview = URL.createObjectURL(file);
      setState(prev => ({ ...prev, preview, file, progress: 20 }));

      // EXIF 데이터 추출
      const exifData = await extractExifData(file);
      setState(prev => ({ ...prev, exifData, progress: 50 }));

      // 썸네일 생성 (백그라운드에서 실행)
      generateThumbnails(file);
      setState(prev => ({ ...prev, progress: 80 }));

      setState(prev => ({ ...prev, progress: 100, isUploading: false }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      const errorMessage = '파일 처리 중 오류가 발생했습니다.';
      setState(prev => ({ ...prev, error: errorMessage, isUploading: false }));
      onError(errorMessage);
    }
  }, [validateFile, extractExifData, generateThumbnails, onError]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDescriptionChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    if (value.length <= 50) {
      setState(prev => ({ ...prev, description: value }));
    }
  }, []);

  const handleUpload = useCallback(() => {
    if (!state.file) return;

    const uploadData: PhotoUploadData = {
      file: state.file,
      description: state.description,
    };

    // EXIF 데이터 추가 (촬영 시간 포함)
    if (state.exifData) {
      uploadData.exifData = state.exifData;
      
      // 위치 정보가 있으면 location 필드도 설정
      if (state.exifData.latitude && state.exifData.longitude) {
        uploadData.location = {
          latitude: state.exifData.latitude,
          longitude: state.exifData.longitude,
        };
      }
    }

    // 썸네일 데이터 추가
    if (state.thumbnail) {
      uploadData.thumbnail = state.thumbnail;
    }

    if (Object.keys(state.thumbnails).length > 0) {
      uploadData.thumbnails = state.thumbnails;
    }

    onUpload(uploadData);
  }, [state.file, state.description, state.exifData, state.thumbnail, state.thumbnails, onUpload]);

  const handleReset = useCallback(() => {
    if (state.preview) {
      URL.revokeObjectURL(state.preview);
    }

    // 썸네일 메모리 정리
    if (state.thumbnail?.dataUrl) {
      URL.revokeObjectURL(state.thumbnail.dataUrl);
    }
    Object.values(state.thumbnails).forEach(thumbnail => {
      if (thumbnail.dataUrl && thumbnail.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnail.dataUrl);
      }
    });

    setState({
      isUploading: false,
      progress: 0,
      preview: null,
      file: null,
      description: '',
      exifData: null,
      error: null,
      thumbnail: null,
      thumbnails: {},
      thumbnailGenerating: false,
      thumbnailError: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [state.preview, state.thumbnail, state.thumbnails]);

  return (
    <div className="photo-upload">
      <div className="upload-area">
        {!state.preview ? (
          <div className="upload-buttons">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="upload-button"
              disabled={state.isUploading}
            >
              📁 파일 선택
            </button>
            
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="upload-button camera-button"
              disabled={state.isUploading}
            >
              📷 카메라 촬영
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/heic"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              aria-label="사진 파일 선택"
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
              aria-label="카메라로 사진 촬영"
            />
          </div>
        ) : (
          <div className="preview-area">
            <div className="main-preview">
              <img 
                src={state.thumbnail?.dataUrl || state.preview} 
                alt="미리보기" 
                className="preview-image"
              />
              <button
                type="button"
                onClick={handleReset}
                className="reset-button"
                aria-label="사진 다시 선택"
              >
                ✕
              </button>
              {state.thumbnailGenerating && (
                <div className="thumbnail-loading">
                  <div className="loading-spinner"></div>
                  <span>썸네일 생성 중...</span>
                </div>
              )}
            </div>
            
            {Object.keys(state.thumbnails).length > 0 && (
              <div className="thumbnail-preview">
                <h4>생성된 썸네일</h4>
                <div className="thumbnail-sizes">
                  {Object.entries(state.thumbnails).map(([size, thumbnail]) => (
                    <div key={size} className="thumbnail-item">
                      <img 
                        src={thumbnail.dataUrl} 
                        alt={`${size} 썸네일`}
                        className="thumbnail-image"
                      />
                      <div className="thumbnail-info">
                        <span className="size-label">{size}</span>
                        <span className="dimensions">{thumbnail.width}×{thumbnail.height}</span>
                        <span className="file-size">{Math.round(thumbnail.size / 1024)}KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state.isUploading && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${state.progress}%` }}
            />
            <span className="progress-text">{state.progress}%</span>
          </div>
        )}

        {state.error && (
          <div className="error-message" role="alert">
            {state.error}
          </div>
        )}

        {state.thumbnailError && (
          <div className="thumbnail-error" role="alert">
            ⚠️ {state.thumbnailError}
            <button 
              type="button" 
              onClick={() => state.file && generateThumbnails(state.file)}
              className="retry-button"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {state.exifData && (
        <div className="exif-info">
          <h3>사진 정보</h3>
          {state.exifData.latitude && state.exifData.longitude && (
            <p>📍 위치: {state.exifData.latitude.toFixed(6)}, {state.exifData.longitude.toFixed(6)}</p>
          )}
          {state.exifData.timestamp && (
            <p>📅 촬영 시간: {new Date(state.exifData.timestamp).toLocaleString('ko-KR')}</p>
          )}
          {state.exifData.camera && (
            <p>📷 카메라: {state.exifData.camera}</p>
          )}
          {state.exifData.lens && (
            <p>🔍 렌즈: {state.exifData.lens}</p>
          )}
        </div>
      )}

      <div className="description-area">
        <label htmlFor="photo-description">
          사진 설명 ({state.description.length}/50)
        </label>
        <textarea
          id="photo-description"
          value={state.description}
          onChange={handleDescriptionChange}
          placeholder="사진에 대한 짧은 설명을 입력하세요..."
          maxLength={50}
          rows={3}
          className="description-input"
        />
      </div>

      {state.file && !state.isUploading && (
        <button
          type="button"
          onClick={handleUpload}
          className="final-upload-button"
          disabled={!state.file}
        >
          업로드하기
        </button>
      )}
    </div>
  );
};