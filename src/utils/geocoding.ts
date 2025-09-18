/**
 * 역 지오코딩 유틸리티
 * GPS 좌표(위도/경도)를 사용하여 사람이 읽을 수 있는 위치명으로 변환
 *
 * 주요 기능:
 * - 한국 지역 특수 처리 (한글 지역명 제공)
 * - OpenStreetMap Nominatim API를 통한 해외 지역 처리
 * - CORS 문제 해결을 위한 백엔드 프록시 사용
 * - 메모리 캐시를 통한 성능 최적화
 * - Graceful fallback (좌표 표시로 대체)
 */

interface LocationInfo {
  address: string;
  city?: string;
  region?: string;
  country?: string;
}

// 무료 OpenStreetMap Nominatim API를 사용한 역 지오코딩
export const reverseGeocode = async (lat: number, lng: number): Promise<LocationInfo | null> => {
  try {
    // 먼저 한국 지역인지 확인하고, 한국이면 한국어 지역명 사용
    const koreanRegion = getKoreanRegion(lat, lng);
    if (koreanRegion) {
      return {
        address: koreanRegion,
        city: koreanRegion,
        region: koreanRegion,
        country: '한국'
      };
    }

    // 해외 지역의 경우 CORS 우회를 시도하되, 실패하면 좌표로 표시
    try {
      // CORS 우회를 위해 프록시 서버 사용 (로컬에서만)
      if (window.location.hostname === 'localhost') {
        const API_BASE_URL = 'http://localhost:8001';
        const response = await fetch(
          `${API_BASE_URL}/geocoding/reverse?lat=${lat}&lng=${lng}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const data = result.data;
            const address = data.address || {};
            const displayName = data.display_name || '';

            const city = address.city || address.town || address.village || address.county || address.state_district;
            const region = address.state || address.province || address.region;
            const country = address.country;

            let shortAddress = '';
            if (city && region) {
              shortAddress = `${city}, ${region}`;
            } else if (city) {
              shortAddress = city;
            } else if (region) {
              shortAddress = region;
            } else {
              const parts = displayName.split(',').map((s: string) => s.trim());
              shortAddress = parts.slice(0, 2).join(', ');
            }

            return {
              address: shortAddress || displayName,
              city,
              region,
              country
            };
          }
        }
      }
    } catch (proxyError) {
      console.warn('프록시 지오코딩 실패:', proxyError);
    }

    // 프록시 실패 시 좌표 표시로 fallback
    return {
      address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      city: undefined,
      region: undefined,
      country: undefined
    };

  } catch (error) {
    console.warn('역 지오코딩 실패:', error);
    return null;
  }
};

// 한국 특화 위치 표시 (대략적인 지역 분류)
export const getKoreanRegion = (lat: number, lng: number): string | null => {
  // 한국 좌표 범위 확인
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return null; // 한국 외 지역
  }
  
  // 대략적인 지역 분류 (위도/경도 기반)
  if (lat >= 37.4 && lat <= 37.7 && lng >= 126.7 && lng <= 127.3) {
    return '서울';
  } else if (lat >= 37.2 && lat <= 37.5 && lng >= 126.6 && lng <= 127.1) {
    return '인천/경기';
  } else if (lat >= 35.0 && lat <= 35.3 && lng >= 128.8 && lng <= 129.4) {
    return '부산';
  } else if (lat >= 35.8 && lat <= 36.0 && lng >= 128.5 && lng <= 128.8) {
    return '대구';
  } else if (lat >= 37.2 && lat <= 37.4 && lng >= 127.0 && lng <= 127.5) {
    return '경기';
  } else if (lat >= 36.4 && lat <= 37.8 && lng >= 127.2 && lng <= 129.0) {
    return '강원';
  } else if (lat >= 36.7 && lat <= 37.7 && lng >= 126.5 && lng <= 127.5) {
    return '충청';
  } else if (lat >= 35.0 && lat <= 36.8 && lng >= 126.2 && lng <= 129.5) {
    return '경상';
  } else if (lat >= 34.6 && lat <= 36.0 && lng >= 125.9 && lng <= 127.8) {
    return '전라';
  } else if (lat >= 33.1 && lat <= 33.6 && lng >= 126.1 && lng <= 126.9) {
    return '제주';
  }
  
  return '한국';
};

// 위치 정보를 사용자에게 표시할 형태로 포맷
export const formatLocationDisplay = async (lat: number, lng: number): Promise<string> => {
  // 1단계: 한국 지역 확인
  const koreanRegion = getKoreanRegion(lat, lng);
  if (koreanRegion) {
    // 2단계: 더 상세한 정보 시도
    const locationInfo = await reverseGeocode(lat, lng);
    if (locationInfo?.address) {
      return locationInfo.address;
    }
    return koreanRegion;
  }
  
  // 3단계: 해외 지역 처리
  const locationInfo = await reverseGeocode(lat, lng);
  if (locationInfo?.address) {
    return locationInfo.address;
  }
  
  // 4단계: 실패 시 좌표 표시
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

// 캐시를 사용한 최적화된 위치 조회
const locationCache = new Map<string, { data: LocationInfo | null; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24시간

export const getCachedLocation = async (lat: number, lng: number): Promise<string> => {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = locationCache.get(key);
  
  // 캐시 확인
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    if (cached.data?.address) {
      return cached.data.address;
    }
  }
  
  // 새로운 조회
  const result = await formatLocationDisplay(lat, lng);
  
  // 캐시 저장
  locationCache.set(key, {
    data: { address: result },
    timestamp: Date.now()
  });
  
  return result;
};