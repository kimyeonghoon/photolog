// 썸네일 생성을 위한 유틸리티 함수들

export interface ThumbnailOptions {
  width: number;
  height: number;
  mode: 'crop' | 'fit' | 'fill';
  quality?: number; // JPEG 품질 (0.0 - 1.0)
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ThumbnailResult {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

// 기본 썸네일 설정
export const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailOptions = {
  width: 300,
  height: 300,
  mode: 'crop',
  quality: 0.8,
  format: 'jpeg'
};

/**
 * Canvas를 사용하여 이미지 리사이징 수행
 */
export const createThumbnail = async (
  file: File,
  options: Partial<ThumbnailOptions> = {}
): Promise<ThumbnailResult> => {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };

  // 메모리 사용량 추정 및 제한
  const estimatedMemory = estimateMemoryUsage(opts.width, opts.height);
  const maxMemory = 100 * 1024 * 1024; // 100MB 제한
  
  if (estimatedMemory > maxMemory) {
    throw new Error('요청된 썸네일 크기가 너무 큽니다. 메모리 제한을 초과합니다.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    
    // 타임아웃 설정 (30초)
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('썸네일 생성 시간이 초과되었습니다.'));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectUrl);
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
        canvas = null;
      }
      ctx = null;
    };
    
    img.onload = () => {
      try {
        canvas = document.createElement('canvas');
        ctx = canvas.getContext('2d');
        
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas context를 생성할 수 없습니다.'));
          return;
        }

        // 캔버스 크기 설정
        canvas.width = opts.width;
        canvas.height = opts.height;

        // 이미지 크기 계산
        const dimensions = calculateDimensions(
          img.width,
          img.height,
          opts.width,
          opts.height,
          opts.mode
        );

        // 이미지 품질 최적화
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 배경 채우기 (fit 모드일 때 투명도 처리)
        if (opts.mode === 'fit') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 이미지 그리기
        ctx.drawImage(
          img,
          dimensions.sx,
          dimensions.sy,
          dimensions.sWidth,
          dimensions.sHeight,
          dimensions.dx,
          dimensions.dy,
          dimensions.dWidth,
          dimensions.dHeight
        );

        // Blob 생성
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('썸네일 생성에 실패했습니다.'));
              return;
            }

            // File 객체 생성
            const thumbnailFile = new File(
              [blob],
              `thumb_${file.name}`,
              {
                type: `image/${opts.format}`,
                lastModified: Date.now()
              }
            );

            // Data URL 생성
            const reader = new FileReader();
            const canvasWidth = canvas?.width || opts.width;
            const canvasHeight = canvas?.height || opts.height;
            
            reader.onload = () => {
              cleanup();
              resolve({
                file: thumbnailFile,
                dataUrl: reader.result as string,
                width: canvasWidth,
                height: canvasHeight,
                size: blob.size
              });
            };
            reader.onerror = () => {
              cleanup();
              reject(new Error('Data URL 생성에 실패했습니다.'));
            };
            reader.readAsDataURL(blob);
          },
          `image/${opts.format}`,
          opts.quality
        );
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('썸네일 생성 중 오류가 발생했습니다.'));
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('이미지 로드에 실패했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.'));
    };

    // 이미지 로드
    img.src = objectUrl;
  });
};

/**
 * 이미지 크기 및 위치 계산
 */
const calculateDimensions = (
  imgWidth: number,
  imgHeight: number,
  targetWidth: number,
  targetHeight: number,
  mode: 'crop' | 'fit' | 'fill'
) => {
  const imgAspect = imgWidth / imgHeight;
  const targetAspect = targetWidth / targetHeight;

  let sx = 0, sy = 0, sWidth = imgWidth, sHeight = imgHeight;
  let dx = 0, dy = 0, dWidth = targetWidth, dHeight = targetHeight;

  switch (mode) {
    case 'crop':
      // 이미지를 잘라서 타겟 크기에 맞춤 (비율 유지)
      if (imgAspect > targetAspect) {
        // 이미지가 더 넓음 - 좌우를 자름
        sWidth = imgHeight * targetAspect;
        sx = (imgWidth - sWidth) / 2;
      } else {
        // 이미지가 더 높음 - 상하를 자름
        sHeight = imgWidth / targetAspect;
        sy = (imgHeight - sHeight) / 2;
      }
      break;

    case 'fit':
      // 이미지 전체를 보이도록 크기 조정 (비율 유지)
      if (imgAspect > targetAspect) {
        // 이미지가 더 넓음 - 높이를 줄임
        dHeight = targetWidth / imgAspect;
        dy = (targetHeight - dHeight) / 2;
      } else {
        // 이미지가 더 높음 - 너비를 줄임
        dWidth = targetHeight * imgAspect;
        dx = (targetWidth - dWidth) / 2;
      }
      break;

    case 'fill':
      // 이미지를 늘려서 타겟 크기에 맞춤 (비율 무시)
      // 기본값 사용 (변경 없음)
      break;
  }

  return { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight };
};

/**
 * 여러 크기의 썸네일을 동시에 생성
 */
export const createMultipleThumbnails = async (
  file: File,
  sizes: { name: string; options: Partial<ThumbnailOptions> }[]
): Promise<{ [key: string]: ThumbnailResult }> => {
  const results: { [key: string]: ThumbnailResult } = {};
  const maxConcurrent = 3; // 동시 처리 제한
  
  // 청크 단위로 처리
  for (let i = 0; i < sizes.length; i += maxConcurrent) {
    const chunk = sizes.slice(i, i + maxConcurrent);
    
    try {
      const chunkResults = await Promise.allSettled(
        chunk.map(async ({ name, options }) => {
          try {
            const thumbnail = await createThumbnail(file, options);
            return { name, thumbnail };
          } catch (error) {
            console.error(`썸네일 생성 실패 (${name}):`, error);
            throw new Error(`${name} 썸네일 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          }
        })
      );

      // 성공한 결과만 수집
      chunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[result.value.name] = result.value.thumbnail;
        } else {
          console.warn(`청크 처리 실패 (${chunk[index].name}):`, result.reason);
        }
      });

      // 메모리 압박을 피하기 위한 작은 지연
      if (i + maxConcurrent < sizes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('썸네일 청크 처리 실패:', error);
      // 개별 실패가 전체를 중단시키지 않도록 계속 진행
    }
  }

  if (Object.keys(results).length === 0) {
    throw new Error('모든 썸네일 생성에 실패했습니다.');
  }

  return results;
};

/**
 * 썸네일 생성 가능 여부 확인
 */
export const canCreateThumbnail = (file: File): { canCreate: boolean; reason?: string } => {
  // 지원 형식 확인
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!supportedTypes.includes(file.type)) {
    return { canCreate: false, reason: '지원되지 않는 파일 형식입니다.' };
  }

  // 파일 크기 확인 (100MB 제한)
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    return { canCreate: false, reason: `파일 크기가 너무 큽니다. (최대 ${Math.round(maxSize / 1024 / 1024)}MB)` };
  }

  // 최소 파일 크기 확인
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    return { canCreate: false, reason: '파일이 너무 작습니다.' };
  }

  // Canvas API 지원 확인
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { canCreate: false, reason: 'Canvas API를 지원하지 않는 브라우저입니다.' };
    }
    
    // 메모리 제약 확인 (대략적인 추정)
    const navigator = window.navigator as Navigator & { deviceMemory?: number };
    if (navigator.deviceMemory && navigator.deviceMemory < 2) {
      return { canCreate: false, reason: '디바이스 메모리가 부족합니다.' };
    }

    return { canCreate: true };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return { canCreate: false, reason: 'Canvas API 초기화에 실패했습니다.' };
  }
};

/**
 * 간단한 썸네일 생성 가능 여부 확인 (하위 호환성)
 */
export const canCreateThumbnailSimple = (file: File): boolean => {
  return canCreateThumbnail(file).canCreate;
};

/**
 * 메모리 사용량 추정
 */
export const estimateMemoryUsage = (width: number, height: number): number => {
  // 4 bytes per pixel (RGBA)
  return width * height * 4;
};

/**
 * 최적 썸네일 크기 추천
 */
export const getOptimalThumbnailSize = (
  originalWidth: number,
  originalHeight: number,
  targetSize: number = 300
): { width: number; height: number } => {
  const aspect = originalWidth / originalHeight;
  
  if (aspect >= 1) {
    // 가로가 더 긴 경우
    return {
      width: targetSize,
      height: Math.round(targetSize / aspect)
    };
  } else {
    // 세로가 더 긴 경우
    return {
      width: Math.round(targetSize * aspect),
      height: targetSize
    };
  }
};