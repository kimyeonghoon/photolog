// 역 지오코딩 유틸리티
// 위도/경도를 사용하여 대략적인 위치명을 반환

interface LocationInfo {
  address: string;
  city?: string;
  region?: string;
  country?: string;
}

// 무료 OpenStreetMap Nominatim API를 사용한 역 지오코딩
export const reverseGeocode = async (lat: number, lng: number): Promise<LocationInfo | null> => {
  try {
    // Nominatim API 호출 (무료, 사용량 제한 있음)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko,en&addressdetails=1&zoom=14`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.error) {
      console.warn('Geocoding API 오류:', data?.error);
      return null;
    }
    
    // 주소 정보 추출
    const address = data.address || {};
    const displayName = data.display_name || '';
    
    // 한국어 우선, 영어 대체
    const city = address.city || address.town || address.village || address.county || address.state_district;
    const region = address.state || address.province || address.region;
    const country = address.country;
    
    // 짧은 주소 형태로 생성
    let shortAddress = '';
    if (city && region) {
      shortAddress = `${city}, ${region}`;
    } else if (city) {
      shortAddress = city;
    } else if (region) {
      shortAddress = region;
    } else {
      // 마지막 수단: display_name에서 첫 두 부분 추출
      const parts = displayName.split(',').map((s: string) => s.trim());
      shortAddress = parts.slice(0, 2).join(', ');
    }
    
    return {
      address: shortAddress || displayName,
      city,
      region,
      country
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