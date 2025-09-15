# NoSQL 데이터베이스 스키마

## 📋 테이블 구조

### `photos` 테이블

사진 메타데이터와 관련 정보를 저장하는 메인 테이블입니다.

#### DDL (Data Definition Language)

```sql
CREATE TABLE IF NOT EXISTS photos (
    id STRING,
    filename STRING,
    description STRING,
    file_url STRING,
    thumbnail_url STRING,
    file_size INTEGER,
    content_type STRING,
    upload_timestamp TIMESTAMP,
    file_hash STRING,
    exif_data JSON,
    location JSON,
    tags ARRAY(STRING),
    PRIMARY KEY(id)
);

-- 인덱스 생성
CREATE INDEX idx_upload_timestamp ON photos (upload_timestamp);
CREATE INDEX idx_location ON photos (location.latitude, location.longitude);
```

#### 컬럼 설명

| 컬럼명 | 데이터 타입 | 설명 | 제약조건 |
|--------|-------------|------|----------|
| `id` | STRING | 고유 식별자 (UUID) | PRIMARY KEY, NOT NULL |
| `filename` | STRING | 원본 파일명 | NOT NULL |
| `description` | STRING | 사진 설명 | NULLABLE |
| `file_url` | STRING | Object Storage 파일 URL | NOT NULL |
| `thumbnail_url` | STRING | 썸네일 이미지 URL | NULLABLE |
| `file_size` | INTEGER | 파일 크기 (bytes) | NOT NULL |
| `content_type` | STRING | MIME 타입 | NOT NULL |
| `upload_timestamp` | TIMESTAMP | 업로드 일시 | NOT NULL |
| `file_hash` | STRING | 파일 해시 (SHA-256) | NOT NULL |
| `exif_data` | JSON | EXIF 메타데이터 | NULLABLE |
| `location` | JSON | GPS 위치 정보 | NULLABLE |
| `tags` | ARRAY(STRING) | 태그 목록 | DEFAULT [] |

## 📊 데이터 예시

### 기본 사진 레코드

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "jeju-hallasan-sunrise.jpg",
  "description": "제주도 한라산에서 본 새벽 일출",
  "file_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/n/namespace/b/photolog-bucket/o/photos/550e8400-e29b-41d4-a716-446655440000.jpg",
  "thumbnail_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/n/namespace/b/photolog-bucket/o/thumbnails/550e8400-e29b-41d4-a716-446655440000_medium.jpg",
  "file_size": 2048576,
  "content_type": "image/jpeg",
  "upload_timestamp": "2024-03-15T09:30:00.000Z",
  "file_hash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "exif_data": {
    "Make": "Apple",
    "Model": "iPhone 14 Pro",
    "DateTime": "2024:03:15 06:30:00",
    "DateTimeOriginal": "2024:03:15 06:30:00",
    "Orientation": 1,
    "ExifImageWidth": 4032,
    "ExifImageHeight": 3024,
    "FocalLength": 6.86,
    "FNumber": 1.78,
    "ExposureTime": "1/250",
    "ISO": 64,
    "WhiteBalance": 0,
    "Flash": 16,
    "GPSInfo": {
      "GPSLatitude": [33, 22, 6.12],
      "GPSLatitudeRef": "N",
      "GPSLongitude": [126, 31, 44.88],
      "GPSLongitudeRef": "E",
      "GPSAltitude": 1947.5,
      "GPSTimeStamp": [21, 30, 0]
    }
  },
  "location": {
    "latitude": 33.3683666667,
    "longitude": 126.5291333333,
    "altitude": 1947.5,
    "place_name": "한라산 백록담, 제주특별자치도 제주시"
  },
  "tags": ["제주도", "한라산", "일출", "백록담", "여행"]
}
```

### GPS 정보가 없는 사진

```json
{
  "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "filename": "indoor-coffee-shop.jpg",
  "description": "아늑한 카페 내부",
  "file_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/n/namespace/b/photolog-bucket/o/photos/6ba7b810-9dad-11d1-80b4-00c04fd430c8.jpg",
  "thumbnail_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/n/namespace/b/photolog-bucket/o/thumbnails/6ba7b810-9dad-11d1-80b4-00c04fd430c8_medium.jpg",
  "file_size": 1536000,
  "content_type": "image/jpeg",
  "upload_timestamp": "2024-03-14T15:45:00.000Z",
  "file_hash": "b3f0c7f6bb4df7d1c3e7a9f8e4d5b2a1c9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4",
  "exif_data": {
    "Make": "Canon",
    "Model": "EOS R5",
    "DateTime": "2024:03:14 15:45:00",
    "Orientation": 1,
    "ExifImageWidth": 3840,
    "ExifImageHeight": 2560,
    "FocalLength": 50,
    "FNumber": 2.8,
    "ExposureTime": "1/60",
    "ISO": 800
  },
  "location": null,
  "tags": ["카페", "실내", "음료"]
}
```

## 🔍 쿼리 패턴

### 1. 최신 사진 목록 조회

```sql
SELECT * FROM photos
ORDER BY upload_timestamp DESC
LIMIT 20;
```

### 2. 특정 위치 근처 사진 검색

```sql
SELECT * FROM photos
WHERE location.latitude BETWEEN 33.0 AND 34.0
  AND location.longitude BETWEEN 126.0 AND 127.0
ORDER BY upload_timestamp DESC;
```

### 3. 특정 날짜 범위 사진 조회

```sql
SELECT * FROM photos
WHERE upload_timestamp >= '2024-03-01T00:00:00.000Z'
  AND upload_timestamp < '2024-04-01T00:00:00.000Z'
ORDER BY upload_timestamp ASC;
```

### 4. 태그별 사진 검색

```sql
SELECT * FROM photos
WHERE ARRAY_CONTAINS(tags, '제주도')
ORDER BY upload_timestamp DESC;
```

### 5. 파일 크기별 통계

```sql
SELECT
  COUNT(*) as total_photos,
  SUM(file_size) as total_size,
  AVG(file_size) as avg_size,
  MAX(file_size) as max_size,
  MIN(file_size) as min_size
FROM photos;
```

## 🚀 성능 최적화

### 인덱스 전략

1. **Primary Index**: `id` (기본 키)
2. **Time-based Index**: `upload_timestamp` (시간순 정렬)
3. **Location Index**: `location.latitude, location.longitude` (지리적 검색)
4. **Tag Index**: `tags` (태그 기반 검색)

### 파티셔닝 전략

대용량 데이터 처리를 위한 파티셔닝:

```sql
-- 월별 파티셔닝 예시
CREATE TABLE photos_2024_03 (
    id STRING,
    -- ... 동일한 스키마
    upload_timestamp TIMESTAMP
) PARTITION BY upload_timestamp;
```

## 🔄 마이그레이션 스크립트

### 초기 테이블 생성

```sql
-- photos 테이블 생성
CREATE TABLE IF NOT EXISTS photos (
    id STRING,
    filename STRING,
    description STRING,
    file_url STRING,
    thumbnail_url STRING,
    file_size INTEGER,
    content_type STRING,
    upload_timestamp TIMESTAMP,
    file_hash STRING,
    exif_data JSON,
    location JSON,
    tags ARRAY(STRING),
    PRIMARY KEY(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_upload_timestamp ON photos (upload_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location ON photos (location.latitude, location.longitude);
CREATE INDEX IF NOT EXISTS idx_tags ON photos (tags);
```

### 데이터 검증 쿼리

```sql
-- 중복 파일 해시 확인
SELECT file_hash, COUNT(*) as count
FROM photos
GROUP BY file_hash
HAVING COUNT(*) > 1;

-- GPS 정보가 있는 사진 비율
SELECT
  COUNT(CASE WHEN location IS NOT NULL THEN 1 END) as photos_with_gps,
  COUNT(*) as total_photos,
  ROUND(COUNT(CASE WHEN location IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as gps_percentage
FROM photos;

-- 월별 업로드 통계
SELECT
  DATE_TRUNC('month', upload_timestamp) as month,
  COUNT(*) as photo_count,
  SUM(file_size) as total_size
FROM photos
GROUP BY DATE_TRUNC('month', upload_timestamp)
ORDER BY month DESC;
```