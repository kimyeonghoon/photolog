import React, { useState, useRef, useCallback, useEffect } from 'react';
import exifr from 'exifr';
import {
  createThumbnail,
  canCreateThumbnail,
  createStandardThumbnails,
  type ThumbnailResult
} from '../utils/thumbnailGenerator';
import './MultiPhotoUpload.css';

// 타입 정의
interface FileUploadData {
  id: string;
  file: File;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  thumbnail?: ThumbnailResult; // 미리보기용
  standardThumbnails?: { [key: string]: ThumbnailResult }; // 서버 전송용 (small, medium, large)
  exifData?: ExifData | null;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  progress: number;
  previewUrl?: string; // 즉시 미리보기용 URL
}

interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  camera?: string;
  lens?: string;
  [key: string]: string | number | boolean | undefined;
}

interface MultiPhotoUploadProps {
  onUpload: (data: FileUploadData[]) => void;
  onError: (error: string) => void;
}

interface UploadState {
  files: FileUploadData[];
  isProcessing: boolean;
  totalProgress: number;
  globalDescription: string;
  isDragOver: boolean;
  travelDate: string;
}

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 50; // 최대 파일 수 제한

export const MultiPhotoUpload: React.FC<MultiPhotoUploadProps> = ({ onUpload, onError }) => {
  const [state, setState] = useState<UploadState>({
    files: [],
    isProcessing: false,
    totalProgress: 0,
    globalDescription: '',
    isDragOver: false,
    travelDate: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // 파일 ID 생성 함수
  const generateFileId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  // 파일 유효성 검사
  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return '지원되지 않는 파일 형식입니다. JPG, PNG, HEIC 파일만 업로드 가능합니다.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기가 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다.';
    }
    return null;
  }, []);

  // EXIF 데이터 추출
  const extractExifData = useCallback(async (file: File, travelDate?: string): Promise<ExifData | null> => {
    try {
      // 더 광범위한 EXIF 데이터 추출 시도
      const exif = await exifr.parse(file, {
        // pick 옵션을 제거하여 모든 EXIF 데이터를 추출
        translateKeys: true,
        mergeOutput: true
      });

      if (!exif) {
        // EXIF가 없어도 여행날짜가 있으면 사용
        if (travelDate) {
          const travelDateTime = new Date(travelDate + 'T12:00:00');
          return {
            timestamp: travelDateTime.toISOString()
          };
        }
        return null;
      }


      const exifData: ExifData = {};

      // GPS 정보 추출 - 여러 방법으로 시도
      let lat: number | undefined;
      let lng: number | undefined;
      
      
      // 방법 1: 자동 변환된 좌표
      if (exif.latitude && exif.longitude) {
        lat = exif.latitude;
        lng = exif.longitude;
      }
      // 방법 2: 직접 GPS 태그에서 추출
      else if (exif.GPSLatitude && exif.GPSLongitude) {
        lat = exif.GPSLatitude;
        lng = exif.GPSLongitude;
        
        // GPS 참조 방향 확인
        if (exif.GPSLatitudeRef === 'S' && lat) lat = -lat;
        if (exif.GPSLongitudeRef === 'W' && lng) lng = -lng;
      }
      // 방법 3: 숫자 태그로 시도
      else if (exif[2] && exif[4]) {
        lat = exif[2];
        lng = exif[4];
        if (exif[1] === 'S' && lat) lat = -lat;
        if (exif[3] === 'W' && lng) lng = -lng;
      }
      
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        exifData.latitude = lat;
        exifData.longitude = lng;
      }

      // 촬영 시간 - 문자열과 Date 객체 모두 처리

      // EXIF 날짜 문자열을 Date 객체로 변환하는 함수
      const parseExifDate = (dateValue: any): string | null => {
        if (!dateValue) return null;

        try {
          // 이미 Date 객체인 경우
          if (dateValue instanceof Date) {
            return dateValue.toISOString();
          }

          // 문자열인 경우 (예: "2024:12:31 14:30:15")
          if (typeof dateValue === 'string') {
            // EXIF 형식의 날짜를 표준 형식으로 변환
            const standardFormat = dateValue.replace(/:/g, '-').replace(/-(\d{2}) /, 'T$1:');
            const date = new Date(standardFormat);

            if (!isNaN(date.getTime())) {
              return date.toISOString();
            }

            // 다른 형식으로 시도
            const date2 = new Date(dateValue);
            if (!isNaN(date2.getTime())) {
              return date2.toISOString();
            }
          }

          return null;
        } catch (error) {
          console.warn('날짜 파싱 실패:', dateValue, error);
          return null;
        }
      };

      // 우선순위에 따라 촬영시간 설정
      let timestamp = null;
      if (exif.DateTimeOriginal) {
        timestamp = parseExifDate(exif.DateTimeOriginal);
      }

      if (!timestamp && exif.DateTime) {
        timestamp = parseExifDate(exif.DateTime);
      }

      if (!timestamp && exif.CreateDate) {
        timestamp = parseExifDate(exif.CreateDate);
      }

      if (!timestamp && exif.DateTimeDigitized) {
        timestamp = parseExifDate(exif.DateTimeDigitized);
      }

      if (timestamp) {
        exifData.timestamp = timestamp;
      } else if (travelDate) {
        // EXIF 촬영시간이 없으면 사용자 입력 여행날짜 사용
        const travelDateTime = new Date(travelDate + 'T12:00:00'); // 정오로 설정
        exifData.timestamp = travelDateTime.toISOString();
      }

      // 카메라 정보 - 숫자 태그와 문자열 키 모두 확인
      const make = exif.Make || exif[271];
      const model = exif.Model || exif[272];
      
      if (make || model) {
        exifData.camera = [make, model].filter(Boolean).join(' ');
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

  // 미리보기용 썸네일 생성
  const generatePreviewThumbnail = useCallback(async (file: File): Promise<ThumbnailResult | null> => {
    const canCreate = canCreateThumbnail(file);
    if (!canCreate.canCreate) {
      console.warn(`썸네일 생성 불가: ${canCreate.reason}`);
      return null;
    }

    try {
      return await createThumbnail(file, {
        width: 200,
        height: 200,
        mode: 'crop',
        quality: 0.8
      });
    } catch (error) {
      return null;
    }
  }, []);

  // 서버 전송용 표준 썸네일들 생성
  const generateStandardThumbnails = useCallback(async (file: File): Promise<{ [key: string]: ThumbnailResult } | null> => {
    const canCreate = canCreateThumbnail(file);

    if (!canCreate.canCreate) {
      return null;
    }

    try {
      const result = await createStandardThumbnails(file);
      return result;
    } catch (error) {
      console.error('❌ 표준 썸네일 생성 실패:', error);
      return null;
    }
  }, []);

  // 개별 파일 처리
  const processFile = useCallback(async (fileData: FileUploadData) => {
    // 상태를 processing으로 변경
    setState(prev => ({
      ...prev,
      files: prev.files.map(f =>
        f.id === fileData.id ? { ...f, status: 'processing', progress: 10 } : f
      )
    }));

    try {
      // EXIF 데이터 추출
      const exifData = await extractExifData(fileData.file, state.travelDate);

      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.id === fileData.id ? { ...f, progress: 30, exifData } : f
        )
      }));

      // GPS 정보 설정
      const location = exifData?.latitude && exifData?.longitude
        ? { latitude: exifData.latitude, longitude: exifData.longitude }
        : undefined;

      // 미리보기용 썸네일 생성
      const previewThumbnail = await generatePreviewThumbnail(fileData.file);

      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.id === fileData.id ? { ...f, progress: 60, thumbnail: previewThumbnail || undefined } : f
        )
      }));

      // 서버 전송용 표준 썸네일들 생성
      const standardThumbnails = await generateStandardThumbnails(fileData.file);

      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.id === fileData.id
            ? {
                ...f,
                status: 'completed',
                progress: 100,
                location,
                thumbnail: previewThumbnail || undefined,
                standardThumbnails: standardThumbnails || undefined,
                exifData
              }
            : f
        )
      }));


    } catch (error) {
      setState(prev => ({
        ...prev,
        files: prev.files.map(f =>
          f.id === fileData.id
            ? { ...f, status: 'error', error: '파일 처리 중 오류가 발생했습니다.' }
            : f
        )
      }));
    }
  }, [extractExifData, generatePreviewThumbnail, generateStandardThumbnails, state.travelDate]);

  // 파일 추가 (즉시 미리보기 생성)
  const addFiles = useCallback((files: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    // 파일 수 제한 확인
    if (state.files.length + files.length > MAX_FILES) {
      onError(`최대 ${MAX_FILES}개의 파일까지 업로드할 수 있습니다.`);
      return;
    }

    // 각 파일 유효성 검사
    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      onError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      const newFileData: FileUploadData[] = validFiles.map(file => {
        // 즉시 미리보기 URL 생성
        const previewUrl = URL.createObjectURL(file);
        
        return {
          id: generateFileId(),
          file,
          description: '', // 개별 설명은 빈 문자열로 시작
          status: 'pending',
          progress: 0,
          previewUrl // 즉시 미리보기용 URL 추가
        };
      });

      setState(prev => ({
        ...prev,
        files: [...prev.files, ...newFileData]
      }));
    }
  }, [state.files.length, state.globalDescription, validateFile, onError]);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    // 입력 값 초기화 (같은 파일 다시 선택 가능)
    event.target.value = '';
  }, [addFiles]);

  // 드래그 앤 드롭 핸들러들
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setState(prev => ({ ...prev, isDragOver: false }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragOver: false }));
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  // 개별 파일 삭제 (URL 정리 포함)
  const removeFile = useCallback((fileId: string) => {
    setState(prev => {
      const fileToRemove = prev.files.find(f => f.id === fileId);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      
      return {
        ...prev,
        files: prev.files.filter(f => f.id !== fileId)
      };
    });
  }, []);

  // 전체 파일 삭제 (URL 정리 포함)
  const clearAllFiles = useCallback(() => {
    setState(prev => {
      // 모든 preview URL 정리
      prev.files.forEach(file => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
      
      return {
        ...prev,
        files: []
      };
    });
  }, []);

  // 업로드 완료 처리 (먼저 정의)
  const handleUploadComplete = useCallback(() => {
    const completedFiles = state.files.filter(f => f.status === 'completed');

    if (completedFiles.length > 0) {
      // 설명 조합 로직: 개별 설명이 있으면 "전체설명 - 개별설명", 없으면 "전체설명"
      const filesWithDescriptions = completedFiles.map(file => {
        const individualDesc = file.description?.trim();

        const result = {
          ...file,
          description: individualDesc
            ? `${state.globalDescription} - ${individualDesc}`
            : state.globalDescription
        };

        return result;
      });

      onUpload(filesWithDescriptions);

      // URL 정리 후 초기화
      setState(prev => {
        prev.files.forEach(file => {
          if (file.previewUrl) {
            URL.revokeObjectURL(file.previewUrl);
          }
        });

        return { ...prev, files: [], globalDescription: '' };
      });
    }
  }, [state.files, state.globalDescription, onUpload]);

  // 모든 파일 처리 시작
  const processAllFiles = useCallback(async () => {
    const pendingFiles = state.files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setState(prev => ({ ...prev, isProcessing: true }));

    try {
      // 배치 처리 (4개씩 병렬 처리)
      const batchSize = 4;
      for (let i = 0; i < pendingFiles.length; i += batchSize) {
        const batch = pendingFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(processFile));
      }
    } catch (error) {
      console.error('파일 처리 중 오류:', error);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.files, processFile]);

  // 처리 완료 후 자동 업로드를 위한 상태
  const [shouldAutoUpload, setShouldAutoUpload] = useState(false);

  // 처리 시작 함수
  const startProcessAndUpload = useCallback(async () => {
    setShouldAutoUpload(true);
    await processAllFiles();
  }, [processAllFiles]);

  // 처리 완료 후 자동 업로드 감지
  useEffect(() => {
    if (shouldAutoUpload && !state.isProcessing) {
      const completedFiles = state.files.filter(f => f.status === 'completed');
      const pendingFiles = state.files.filter(f => f.status === 'pending');
      
      if (completedFiles.length > 0 && pendingFiles.length === 0) {
        // 모든 파일 처리 완료, 자동 업로드
        setShouldAutoUpload(false);
        handleUploadComplete();
      }
    }
  }, [state.isProcessing, state.files, shouldAutoUpload, handleUploadComplete]);

  // 전체 진행률 계산
  useEffect(() => {
    if (state.files.length === 0) {
      setState(prev => ({ ...prev, totalProgress: 0 }));
      return;
    }

    const totalProgress = state.files.reduce((sum, file) => sum + file.progress, 0);
    const averageProgress = Math.round(totalProgress / state.files.length);
    
    setState(prev => ({ ...prev, totalProgress: averageProgress }));
  }, [state.files]);

  // 컴포넌트 언마운트 시 URL 정리
  useEffect(() => {
    return () => {
      state.files.forEach(file => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, [state.files]);

  const pendingCount = state.files.filter(f => f.status === 'pending').length;
  const completedCount = state.files.filter(f => f.status === 'completed').length;
  const errorCount = state.files.filter(f => f.status === 'error').length;

  return (
    <div className="multi-photo-upload">
      <div className="upload-header">
        <h2>📸 사진 업로드</h2>
        <p>여러 장의 사진을 한 번에 업로드하세요</p>
      </div>

      {/* 전체 설명 입력 (필수) */}
      <div className="global-description">
        <label htmlFor="globalDescription">
          전체 설명 <span className="required">*</span>
        </label>
        <input
          id="globalDescription"
          type="text"
          value={state.globalDescription}
          onChange={(e) => setState(prev => ({ ...prev, globalDescription: e.target.value }))}
          placeholder="예: 제주도 여행 2024 (필수 입력)"
          maxLength={100}
          required
        />
        {!state.globalDescription.trim() && state.files.length > 0 && (
          <div className="validation-message">
            ⚠️ 전체 설명을 입력해야 업로드할 수 있습니다
          </div>
        )}
      </div>

      {/* 여행날짜 입력 (선택) */}
      <div className="travel-date">
        <label htmlFor="travelDate">
          📅 여행날짜 (선택)
        </label>
        <input
          id="travelDate"
          type="date"
          value={state.travelDate}
          onChange={(e) => {
            setState(prev => ({ ...prev, travelDate: e.target.value }));
          }}
          placeholder="EXIF 촬영시간이 없는 사진에 적용됩니다"
        />
        <div className="field-description">
          💡 EXIF 촬영시간이 없는 사진에 이 날짜가 적용됩니다
        </div>
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <div 
        ref={dropZoneRef}
        className={`drop-zone ${state.isDragOver ? 'drag-over' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="drop-zone-content">
          <div className="drop-zone-icon">📁</div>
          <div className="drop-zone-text">
            <strong>파일을 끌어다 놓거나 클릭하여 선택하세요</strong>
            <p>JPG, PNG, HEIC 파일 지원 (최대 10MB, {MAX_FILES}개까지)</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* 파일 목록 */}
      {state.files.length > 0 && (
        <div className="files-section">
          <div className="files-header">
            <h3>선택된 파일 ({state.files.length}개)</h3>
            <div className="files-actions">
              {pendingCount > 0 && !state.isProcessing && (
                <button 
                  onClick={startProcessAndUpload}
                  className={`upload-button ${state.globalDescription.trim() ? 'primary' : 'disabled'}`}
                  disabled={!state.globalDescription.trim()}
                  title={!state.globalDescription.trim() ? '전체 설명을 입력해주세요' : ''}
                >
                  {pendingCount}장 업로드
                </button>
              )}
              {state.isProcessing && (
                <button disabled className="upload-button processing">
                  처리 중... ({completedCount}/{state.files.length})
                </button>
              )}
              {completedCount > 0 && pendingCount === 0 && !state.isProcessing && (
                <button 
                  onClick={handleUploadComplete}
                  className="upload-button success"
                >
                  포토로그에 추가
                </button>
              )}
              <button 
                onClick={clearAllFiles}
                className="clear-button"
                disabled={state.isProcessing}
              >
                전체 삭제
              </button>
            </div>
          </div>

          {/* 전체 진행률 */}
          {state.isProcessing && (
            <div className="total-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${state.totalProgress}%` }}
                />
              </div>
              <div className="progress-text">
                전체 진행률: {state.totalProgress}% 
                (완료: {completedCount}, 대기: {pendingCount}, 오류: {errorCount})
              </div>
            </div>
          )}

          {/* 파일 그리드 */}
          <div className="files-grid">
            {state.files.map(fileData => (
              <div key={fileData.id} className={`file-item ${fileData.status}`}>
                <div className="file-preview">
                  {fileData.thumbnail ? (
                    <img 
                      src={fileData.thumbnail.dataUrl} 
                      alt={fileData.file.name}
                    />
                  ) : fileData.previewUrl ? (
                    <img 
                      src={fileData.previewUrl}
                      alt={fileData.file.name}
                      style={{ opacity: fileData.status === 'processing' ? 0.7 : 1 }}
                    />
                  ) : (
                    <div className="preview-placeholder">
                      📷
                    </div>
                  )}
                  
                  {/* 상태 오버레이 */}
                  <div className="file-status">
                    {fileData.status === 'processing' && (
                      <div className="status-processing">⏳</div>
                    )}
                    {fileData.status === 'completed' && (
                      <div className="status-completed">✅</div>
                    )}
                    {fileData.status === 'error' && (
                      <div className="status-error">❌</div>
                    )}
                  </div>

                  {/* 삭제 버튼 */}
                  <button 
                    className="remove-file"
                    onClick={() => removeFile(fileData.id)}
                    title="파일 제거"
                  >
                    ×
                  </button>
                </div>

                <div className="file-info">
                  <div className="file-name" title={fileData.file.name}>
                    {fileData.file.name}
                  </div>
                  <div className="file-size">
                    {(fileData.file.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  
                  {/* 개별 설명 입력 */}
                  <div className="file-description">
                    <input
                      type="text"
                      placeholder="이 사진의 설명 (선택사항)"
                      value={fileData.description || ''}
                      onChange={(e) => {
                        setState(prev => ({
                          ...prev,
                          files: prev.files.map(f => 
                            f.id === fileData.id 
                              ? { ...f, description: e.target.value }
                              : f
                          )
                        }));
                      }}
                      maxLength={100}
                      className="description-input-small"
                    />
                  </div>

                  {/* GPS 정보 표시 */}
                  {fileData.location && (
                    <div className="file-location">
                      📍 GPS 정보 있음
                    </div>
                  )}
                  
                  {/* 에러 메시지 */}
                  {fileData.error && (
                    <div className="file-error">
                      {fileData.error}
                    </div>
                  )}

                  {/* 진행률 */}
                  {fileData.status === 'processing' && (
                    <div className="file-progress">
                      <div 
                        className="progress-bar small"
                        style={{ width: `${fileData.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};