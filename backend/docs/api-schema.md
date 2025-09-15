# 포토로그 API 스키마 문서

## 📸 사진 업로드 API

### POST /api/photos/upload

여행 사진을 업로드하고 메타데이터를 저장합니다.

#### 요청 (Request)

**Content-Type**: `application/json`

```json
{
  "filename": "string",        // 원본 파일명 (필수)
  "file_data": "string",       // Base64 인코딩된 파일 데이터 (필수)
  "content_type": "string",    // MIME 타입 (필수)
  "description": "string"      // 사진 설명 (선택)
}
```

**요청 예시**:
```json
{
  "filename": "jeju-sunset.jpg",
  "file_data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYA...",
  "content_type": "image/jpeg",
  "description": "제주도 성산일출봉에서 본 아름다운 일몰"
}
```

#### 응답 (Response)

**성공 응답 (201 Created)**:
```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "data": {
    "photo_id": "uuid-string",
    "filename": "jeju-sunset.jpg",
    "file_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/...",
    "file_size": 2048576,
    "location": {
      "latitude": 33.4617,
      "longitude": 126.9423
    },
    "exif_data": {
      "camera": "iPhone 14 Pro",
      "datetime": "2024:03:15 18:30:00",
      "orientation": 1
    }
  },
  "timestamp": "2024-03-15T09:30:00.000Z"
}
```

**에러 응답 (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Missing required fields: [filename, file_data]",
  "data": null,
  "timestamp": "2024-03-15T09:30:00.000Z"
}
```

#### 상태 코드

| 코드 | 설명 |
|------|------|
| 201 | 업로드 성공 |
| 400 | 잘못된 요청 (필수 필드 누락, 파일 형식 오류 등) |
| 413 | 파일 크기 초과 (50MB 제한) |
| 500 | 서버 내부 오류 |

#### 제한 사항

- **파일 크기**: 최대 50MB
- **지원 형식**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`
- **요청 제한**: 분당 100회 (향후 구현)

---

## 📋 사진 목록 조회 API

### GET /api/photos

업로드된 사진 목록을 조회합니다.

#### 쿼리 파라미터

| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| `limit` | integer | 조회할 사진 수 (1-100) | 50 |
| `offset` | integer | 건너뛸 사진 수 | 0 |
| `order_by` | string | 정렬 기준 (`upload_timestamp DESC/ASC`) | `upload_timestamp DESC` |

#### 응답 (Response)

**성공 응답 (200 OK)**:
```json
{
  "success": true,
  "message": "Photos retrieved successfully",
  "data": {
    "photos": [
      {
        "id": "uuid-string",
        "filename": "jeju-sunset.jpg",
        "description": "제주도 성산일출봉에서 본 아름다운 일몰",
        "file_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/...",
        "thumbnail_url": "https://objectstorage.ap-seoul-1.oraclecloud.com/...",
        "file_size": 2048576,
        "content_type": "image/jpeg",
        "upload_timestamp": "2024-03-15T09:30:00.000Z",
        "location": {
          "latitude": 33.4617,
          "longitude": 126.9423
        },
        "exif_data": {
          "camera": "iPhone 14 Pro",
          "datetime": "2024:03:15 18:30:00"
        }
      }
    ],
    "count": 1,
    "total": 1,
    "has_more": false
  },
  "timestamp": "2024-03-15T09:30:00.000Z"
}
```

---

## 🗄️ 데이터베이스 스키마

### NoSQL 테이블: `photos`

```json
{
  "id": "string (Primary Key)",
  "filename": "string",
  "description": "string",
  "file_url": "string",
  "thumbnail_url": "string",
  "file_size": "number",
  "content_type": "string",
  "upload_timestamp": "string (ISO 8601)",
  "file_hash": "string (SHA-256)",
  "exif_data": {
    "Make": "string",
    "Model": "string",
    "DateTime": "string",
    "Orientation": "number",
    "GPSInfo": "object"
  },
  "location": {
    "latitude": "number",
    "longitude": "number"
  },
  "tags": ["string"]
}
```

#### 인덱스

- **Primary Index**: `id`
- **Secondary Index**: `upload_timestamp` (정렬용)
- **Secondary Index**: `location.latitude, location.longitude` (지리적 쿼리용)

---

## 🔐 인증 및 보안

### API 키 인증 (향후 구현)

```http
Authorization: Bearer your-api-key
```

### CORS 설정

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 보안 헤더

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

---

## 📊 에러 응답 형식

모든 에러 응답은 다음 형식을 따릅니다:

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE",
  "data": null,
  "timestamp": "2024-03-15T09:30:00.000Z"
}
```

### 일반적인 에러 코드

| 코드 | 설명 |
|------|------|
| `INVALID_REQUEST` | 잘못된 요청 형식 |
| `MISSING_FIELDS` | 필수 필드 누락 |
| `FILE_TOO_LARGE` | 파일 크기 초과 |
| `INVALID_FILE_TYPE` | 지원하지 않는 파일 형식 |
| `UPLOAD_FAILED` | 파일 업로드 실패 |
| `DATABASE_ERROR` | 데이터베이스 오류 |
| `INTERNAL_ERROR` | 서버 내부 오류 |

---

## 🧪 테스트 예시

### cURL을 사용한 사진 업로드

```bash
curl -X POST https://api.photolog.example.com/photos/upload \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-photo.jpg",
    "file_data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYA...",
    "content_type": "image/jpeg",
    "description": "테스트 사진"
  }'
```

### JavaScript Fetch를 사용한 업로드

```javascript
const uploadPhoto = async (file, description) => {
  const fileData = await convertToBase64(file);

  const response = await fetch('/api/photos/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      file_data: fileData,
      content_type: file.type,
      description: description
    })
  });

  return await response.json();
};
```