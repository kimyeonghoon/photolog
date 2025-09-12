// 샘플 사진 데이터 타입 정의
export interface SamplePhotoData {
  filename: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  exifData?: {
    timestamp?: string;
    make?: string;
    model?: string;
    [key: string]: string | number | boolean | undefined;
  };
  uploadedAt: Date;
}

// 실제 샘플 사진 데이터 (제주 올레길 GPS 데이터가 있는 이미지들)
export const samplePhotos: SamplePhotoData[] = [
  {
    filename: 'jeju-olle-3-1.jpg',
    description: '제주 올레 3코스 - 온평포구',
    location: {
      latitude: 33.2441,
      longitude: 126.5691
    },
    exifData: {
      timestamp: '2020-03-15T10:30:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-15T10:30:00')
  },
  {
    filename: 'jeju-olle-3-2.jpg', 
    description: '제주 올레 3코스 - 해안절벽',
    location: {
      latitude: 33.2398,
      longitude: 126.5734
    },
    exifData: {
      timestamp: '2020-03-15T11:15:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-15T11:15:00')
  },
  {
    filename: 'jeju-olle-3-3.jpg',
    description: '제주 올레 3코스 - 표선해비치',
    location: {
      latitude: 33.3234,
      longitude: 126.8456
    },
    exifData: {
      timestamp: '2020-03-15T12:45:00',
      make: 'Samsung', 
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-15T12:45:00')
  },
  {
    filename: 'zoo-1.jpg',
    description: '서울대공원 동물원 - 호랑이',
    // GPS 정보 없음
    exifData: {
      timestamp: '2021-05-20T14:20:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2021-05-20T14:20:00')
  },
  {
    filename: 'zoo-2.jpg',
    description: '서울대공원 동물원 - 기린',
    // GPS 정보 없음
    exifData: {
      timestamp: '2021-05-20T14:35:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2021-05-20T14:35:00')
  },
  {
    filename: 'zoo-3.jpg',
    description: '서울대공원 동물원 - 코끼리',
    // GPS 정보 없음
    exifData: {
      timestamp: '2021-05-20T15:10:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2021-05-20T15:10:00')
  },
  {
    filename: 'jeju-olle-19-1.jpg',
    description: '제주 올레 19코스 - 통오름',
    // GPS 정보 없음
    exifData: {
      timestamp: '2020-03-22T09:15:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-22T09:15:00')
  },
  {
    filename: 'jeju-olle-19-2.jpg',
    description: '제주 올레 19코스 - 동오름',
    // GPS 정보 없음
    exifData: {
      timestamp: '2020-03-22T10:30:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-22T10:30:00')
  },
  {
    filename: 'jeju-olle-19-3.jpg',
    description: '제주 올레 19코스 - 저지오름',
    // GPS 정보 없음
    exifData: {
      timestamp: '2020-03-22T11:45:00',
      make: 'Samsung',
      model: 'SM-A805N'
    },
    uploadedAt: new Date('2020-03-22T11:45:00')
  }
];

// File 객체 생성 헬퍼 함수
export const createFileFromSample = async (sampleData: SamplePhotoData): Promise<File> => {
  try {
    // 실제 파일이 존재하는지 확인 후 로드
    const response = await fetch(`/sample-images/${sampleData.filename}`);
    if (!response.ok) {
      throw new Error(`File not found: ${sampleData.filename}`);
    }
    
    const blob = await response.blob();
    return new File([blob], sampleData.filename, { type: blob.type });
  } catch (error) {
    console.warn(`Failed to load ${sampleData.filename}:`, error);
    // 대체 이미지나 빈 File 객체 반환
    const emptyBlob = new Blob([''], { type: 'image/jpeg' });
    return new File([emptyBlob], sampleData.filename, { type: 'image/jpeg' });
  }
};

// GPS 데이터가 있는 샘플만 필터링
export const samplePhotosWithGPS = samplePhotos.filter(photo => photo.location);

// 샘플 데이터 통계
export const getSampleStats = () => {
  return {
    total: samplePhotos.length,
    withGPS: samplePhotosWithGPS.length,
    withoutGPS: samplePhotos.length - samplePhotosWithGPS.length,
    dateRange: {
      earliest: new Date(Math.min(...samplePhotos.map(p => p.uploadedAt.getTime()))),
      latest: new Date(Math.max(...samplePhotos.map(p => p.uploadedAt.getTime())))
    }
  };
};