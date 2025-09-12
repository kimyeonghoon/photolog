import React, { useState, useRef, useCallback } from 'react';
import exifr from 'exifr';

// 타입 정의
interface PhotoUploadData {
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  lens?: string;
  [key: string]: any;
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
      setState(prev => ({ ...prev, preview, file, progress: 30 }));

      // EXIF 데이터 추출
      const exifData = await extractExifData(file);
      setState(prev => ({ ...prev, exifData, progress: 60 }));

      setState(prev => ({ ...prev, progress: 100, isUploading: false }));
    } catch (error) {
      const errorMessage = '파일 처리 중 오류가 발생했습니다.';
      setState(prev => ({ ...prev, error: errorMessage, isUploading: false }));
      onError(errorMessage);
    }
  }, [validateFile, extractExifData, onError]);

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

    if (state.exifData?.latitude && state.exifData?.longitude) {
      uploadData.location = {
        latitude: state.exifData.latitude,
        longitude: state.exifData.longitude,
      };
    }

    onUpload(uploadData);
  }, [state.file, state.description, state.exifData, onUpload]);

  const handleReset = useCallback(() => {
    if (state.preview) {
      URL.revokeObjectURL(state.preview);
    }
    setState({
      isUploading: false,
      progress: 0,
      preview: null,
      file: null,
      description: '',
      exifData: null,
      error: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, [state.preview]);

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
            <img 
              src={state.preview} 
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