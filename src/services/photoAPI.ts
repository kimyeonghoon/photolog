/**
 * 포토로그 백엔드 API 클라이언트
 * 사진 업로드 및 조회 기능 제공
 */

import { authAPI } from './authAPI'

// API 설정
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001'
  : `${window.location.protocol}//${window.location.host}/api`;

// 통합 스토리지 서비스 사용 여부 (환경변수로 제어)
const USE_UNIFIED_STORAGE = true;

// 타입 정의
export interface APIPhotoUploadRequest {
  filename: string;
  file_data: string; // Base64 인코딩된 원본 파일 데이터
  content_type: string;
  description?: string;
  // 프론트엔드에서 처리한 데이터들
  thumbnails?: {
    small?: string; // Base64 데이터
    medium?: string;
    large?: string;
  };
  exif_data?: {
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    camera?: string;
    lens?: string;
    [key: string]: string | number | boolean | undefined;
  };
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface APIPhotoUploadResponse {
  success: boolean;
  message: string;
  data?: {
    photo_id: string;
    filename: string;
    file_url: string;
    thumbnail_urls?: {
      small?: string;
      medium?: string;
      large?: string;
    };
    file_size: number;
    location?: {
      latitude: number;
      longitude: number;
    };
    exif_data: {
      camera: string;
      datetime: string;
      orientation: number;
    };
    thumbnails_generated?: number;
  };
  timestamp: string;
}

export interface APIPhotosListResponse {
  success: boolean;
  message: string;
  data?: {
    photos: Array<{
      id: string;
      filename: string;
      description: string;
      file_url: string;
      thumbnail_urls?: {
        small?: string;
        medium?: string;
        large?: string;
      };
      file_size: number;
      content_type: string;
      upload_timestamp: string;
      location?: {
        latitude: number;
        longitude: number;
      };
      exif_data: Record<string, any>;
    }>;
    count: number;
    total: number;
    has_more: boolean;
  };
  timestamp: string;
}

// API 클라이언트 클래스
export class PhotoAPIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * 파일을 Base64로 인코딩
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * ThumbnailResult를 Base64 문자열로 변환 (data URL에서 데이터 부분만 추출)
   */
  private extractBase64FromDataUrl(dataUrl: string): string {
    // data:image/jpeg;base64,... 형태에서 base64 부분만 추출
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : dataUrl;
  }

  /**
   * HTTP 요청 헬퍼
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    // 인증 헤더 추가
    const authHeaders = authAPI.getAuthHeaders();

    const defaultOptions: RequestInit = {
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const response = await fetch(url, finalOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // 백엔드 응답 형식을 프론트엔드 형식으로 변환
      if (data.status !== undefined) {
        const success = data.status >= 200 && data.status < 300;
        return {
          ...data,
          success: success
        };
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`API 요청 실패: ${error.message}`);
      }
      throw new Error('알 수 없는 API 오류가 발생했습니다');
    }
  }

  /**
   * 서버 상태 확인
   */
  async healthCheck(): Promise<{
    success: boolean;
    message: string;
    version: string;
    endpoints: string[];
  }> {
    return this.makeRequest('/health');
  }

  /**
   * 사진 업로드 (처리된 데이터와 함께)
   */
  async uploadPhoto(
    file: File,
    description?: string,
    processedData?: {
      thumbnails?: { [key: string]: { dataUrl: string } };
      exifData?: any;
      location?: { latitude: number; longitude: number };
    }
  ): Promise<APIPhotoUploadResponse> {
    try {
      // 파일 유효성 검사
      if (!file.type.startsWith('image/')) {
        throw new Error('이미지 파일만 업로드할 수 있습니다');
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB
        throw new Error('파일 크기는 50MB를 초과할 수 없습니다');
      }

      // Base64 인코딩
      const fileData = await this.fileToBase64(file);

      // API 요청 데이터 준비
      const requestData: APIPhotoUploadRequest = {
        filename: file.name,
        file_data: fileData,
        content_type: file.type,
        description: description || ''
      };

      // 프론트엔드에서 처리된 썸네일 데이터 추가
      if (processedData?.thumbnails) {
        requestData.thumbnails = {};
        Object.entries(processedData.thumbnails).forEach(([size, thumbnail]) => {
          if (thumbnail.dataUrl) {
            requestData.thumbnails![size as keyof typeof requestData.thumbnails] = this.extractBase64FromDataUrl(thumbnail.dataUrl);
          }
        });
      }

      // EXIF 데이터 추가
      if (processedData?.exifData) {
        requestData.exif_data = processedData.exifData;
      }

      // 위치 정보 추가
      if (processedData?.location) {
        requestData.location = processedData.location;
      }

      // API 호출
      const response = await this.makeRequest<APIPhotoUploadResponse>(
        '/photos/upload',
        {
          method: 'POST',
          body: JSON.stringify(requestData)
        }
      );

      return response;

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`사진 업로드 실패: ${error.message}`);
      }
      throw new Error('사진 업로드 중 알 수 없는 오류가 발생했습니다');
    }
  }

  /**
   * 다중 사진 업로드 (통합 스토리지 서비스 사용)
   */
  async uploadMultiplePhotosUnified(
    files: Array<{
      file: File;
      description?: string;
      thumbnails?: { [key: string]: { dataUrl: string } };
      exifData?: any;
      location?: { latitude: number; longitude: number };
    }>,
    onProgress?: (completed: number, total: number, currentFile?: string) => void
  ): Promise<APIPhotoUploadResponse[]> {
    try {
      // 모든 파일을 한 번에 처리할 데이터로 변환
      const filesData = await Promise.all(
        files.map(async ({ file, description, thumbnails, exifData, location }) => {
          const fileBase64 = await this.fileToBase64(file);

          return {
            file: fileBase64,
            description: description || '',
            thumbnails: thumbnails || {},
            exifData: exifData || {},
            location: location
          };
        })
      );

      // 통합 엔드포인트로 전송
      const requestData = {
        method: 'POST',
        files: filesData
      };

      const response = await this.makeRequest<{
        success: boolean;
        message: string;
        data?: {
          files: Array<{
            success: boolean;
            data?: any;
            error?: string;
          }>;
          summary: {
            total: number;
            success: number;
            failed: number;
            storage_type: string;
          };
        };
      }>('/photos/upload-unified', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (response.success && response.data) {
        // 프로그레스 업데이트
        if (onProgress) {
          onProgress(response.data.summary.success, response.data.summary.total);
        }

        // 결과 변환
        return response.data.files.map(fileResult => {
          if (fileResult.success && fileResult.data) {
            return {
              success: true,
              message: '업로드 성공',
              data: fileResult.data,
              timestamp: new Date().toISOString()
            };
          } else {
            return {
              success: false,
              message: fileResult.error || '업로드 실패',
              data: undefined,
              timestamp: new Date().toISOString()
            };
          }
        });
      } else {
        throw new Error(response.message || '업로드 실패');
      }

    } catch (error) {
      console.error('통합 업로드 오류:', error);
      throw error;
    }
  }

  /**
   * 다중 사진 업로드 (순차적) - 처리된 데이터와 함께
   */
  async uploadMultiplePhotos(
    files: Array<{
      file: File;
      description?: string;
      thumbnails?: { [key: string]: { dataUrl: string } };
      exifData?: any;
      location?: { latitude: number; longitude: number };
    }>,
    onProgress?: (completed: number, total: number, currentFile?: string) => void
  ): Promise<APIPhotoUploadResponse[]> {
    // 통합 스토리지 서비스 사용 여부에 따라 분기
    if (USE_UNIFIED_STORAGE) {
      return this.uploadMultiplePhotosUnified(files, onProgress);
    }
    const results: APIPhotoUploadResponse[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const { file, description, thumbnails, exifData, location } = files[i];

      try {
        if (onProgress) {
          onProgress(i, total, file.name);
        }

        const result = await this.uploadPhoto(file, description, {
          thumbnails,
          exifData,
          location
        });
        results.push(result);

        if (onProgress) {
          onProgress(i + 1, total);
        }

      } catch (error) {
        // 개별 파일 업로드 실패 시에도 계속 진행
        console.error(`파일 ${file.name} 업로드 실패:`, error);

        const errorResponse: APIPhotoUploadResponse = {
          success: false,
          message: error instanceof Error ? error.message : '업로드 실패',
          timestamp: new Date().toISOString()
        };

        results.push(errorResponse);
      }
    }

    return results;
  }

  /**
   * 사진 목록 조회
   */
  async getPhotos(
    limit: number = 50,
    offset: number = 0,
    orderBy: string = 'upload_timestamp DESC'
  ): Promise<APIPhotosListResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      order_by: orderBy
    });

    return this.makeRequest<APIPhotosListResponse>(
      `/photos?${params}`
    );
  }

  /**
   * 특정 사진 조회
   */
  async getPhoto(photoId: string): Promise<APIPhotosListResponse['data']> {
    return this.makeRequest(`/photos/${photoId}`);
  }

  /**
   * 사진 삭제
   */
  async deletePhoto(photoId: string): Promise<{
    success: boolean;
    message: string;
    photo_id: string;
  }> {
    return this.makeRequest(`/photos/${photoId}`, {
      method: 'DELETE'
    });
  }

  /**
   * 다중 사진 삭제
   */
  async deleteMultiplePhotos(photoIds: string[]): Promise<Array<{
    photo_id: string;
    success: boolean;
    message: string;
  }>> {
    const results = [];

    for (const photoId of photoIds) {
      try {
        const result = await this.deletePhoto(photoId);
        results.push({
          photo_id: photoId,
          success: result.success,
          message: result.message
        });
      } catch (error) {
        results.push({
          photo_id: photoId,
          success: false,
          message: error instanceof Error ? error.message : '삭제 실패'
        });
      }
    }

    return results;
  }

  // 사진 정보 업데이트
  async updatePhoto(photoId: string, updates: {
    description?: string;
    timestamp?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    try {
      const result = await this.makeRequest<any>(`/photos/${photoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      return {
        success: result.success || true,
        message: result.message || '사진 정보가 성공적으로 업데이트되었습니다.',
        data: result.updated_data || result.data
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : '사진 업데이트 중 오류 발생'
      };
    }
  }
}

// 기본 인스턴스 생성
export const photoAPI = new PhotoAPIClient();

// 편의 함수들
export const uploadSinglePhoto = async (
  file: File,
  description?: string
): Promise<APIPhotoUploadResponse> => {
  return photoAPI.uploadPhoto(file, description);
};

export const uploadMultiplePhotos = async (
  files: Array<{
    file: File;
    description?: string;
    thumbnails?: { [key: string]: { dataUrl: string } };
    exifData?: any;
    location?: { latitude: number; longitude: number };
  }>,
  onProgress?: (completed: number, total: number, currentFile?: string) => void
): Promise<APIPhotoUploadResponse[]> => {
  return photoAPI.uploadMultiplePhotos(files, onProgress);
};

export const getPhotosList = async (
  limit?: number,
  offset?: number
): Promise<APIPhotosListResponse> => {
  return photoAPI.getPhotos(limit, offset);
};

export const checkServerHealth = async (): Promise<boolean> => {
  try {
    const health = await photoAPI.healthCheck();
    return health.success;
  } catch {
    return false;
  }
};

export const deleteSinglePhoto = async (photoId: string): Promise<{
  success: boolean;
  message: string;
  photo_id: string;
}> => {
  return photoAPI.deletePhoto(photoId);
};

export const deleteMultiplePhotos = async (photoIds: string[]): Promise<Array<{
  photo_id: string;
  success: boolean;
  message: string;
}>> => {
  return photoAPI.deleteMultiplePhotos(photoIds);
};

// 사진 정보 업데이트
export const updatePhoto = async (photoId: string, updates: {
  description?: string;
  timestamp?: string;
}): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> => {
  return photoAPI.updatePhoto(photoId, updates);
};