# MySQL 마이그레이션 가이드

## 개요

이 가이드는 포토로그 애플리케이션을 OCI NoSQL Database에서 MySQL로 마이그레이션하는 방법을 설명합니다.

## 마이그레이션된 구성 요소

### 1. 새로운 파일들

- `shared/mysql_client.py`: MySQL 데이터베이스 클라이언트
- `shared/database_client.py`: 데이터베이스 클라이언트 팩토리

### 2. 수정된 파일들

- `shared/config.py`: MySQL 설정 추가
- `shared/storage_service.py`: 데이터베이스 클라이언트 팩토리 사용
- `tests/simple_server.py`: 데이터베이스 클라이언트 팩토리 사용
- `tests/test_func_unified.py`: 데이터베이스 클라이언트 팩토리 사용
- `requirements.txt`: PyMySQL 의존성 추가
- `.env.example`: MySQL/NoSQL 통합 환경 설정 예제

## 마이그레이션 단계

### 1. 환경 설정

```bash
# 가상환경 활성화
source venv/bin/activate

# MySQL 의존성 설치
pip install PyMySQL==1.1.0

# 환경변수 설정 파일 복사
cp .env.example .env
```

### 2. 환경변수 수정

`.env` 파일에서 다음 항목들을 실제 값으로 수정:

```env
DATABASE_TYPE=mysql
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=rhymix
```

### 3. MySQL 데이터베이스 설정

1. MySQL 서버 확인:
   ```bash
   mysql -h localhost -u root -p
   ```

2. 데이터베이스 생성 (필요한 경우):
   ```sql
   CREATE DATABASE rhymix CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. 덤프 데이터 로드:
   ```bash
   mysql -h localhost -u root -p rhymix < photos_dump.sql
   ```

### 4. 마이그레이션 검증

```bash
# MySQL 연결 테스트
python3 test_mysql_direct.py

# 애플리케이션 테스트
python3 test_mysql_migration.py
```

## 데이터베이스 스키마

### photos 테이블 구조

```sql
CREATE TABLE `photos` (
  `id` varchar(36) NOT NULL,
  `filename` varchar(255) DEFAULT NULL,
  `description` text,
  `file_url` varchar(2048) DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `content_type` varchar(100) DEFAULT NULL,
  `upload_timestamp` datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
  `taken_timestamp` datetime(6) DEFAULT NULL,
  `travel_date` date DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `location_address` text,
  `location_city` varchar(100) DEFAULT NULL,
  `location_country` varchar(100) DEFAULT NULL,
  `thumbnail_small` varchar(2048) DEFAULT NULL,
  `thumbnail_medium` varchar(2048) DEFAULT NULL,
  `thumbnail_large` varchar(2048) DEFAULT NULL,
  `camera_make` varchar(100) DEFAULT NULL,
  `camera_model` varchar(100) DEFAULT NULL,
  `iso_speed` int DEFAULT NULL,
  `aperture` varchar(20) DEFAULT NULL,
  `shutter_speed` varchar(50) DEFAULT NULL,
  `focal_length` varchar(20) DEFAULT NULL,
  `thumbnail_urls_json` json DEFAULT NULL,
  `location_json` json DEFAULT NULL,
  `exif_data_json` json DEFAULT NULL,
  `tags` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_upload_timestamp` (`upload_timestamp`),
  KEY `idx_taken_timestamp` (`taken_timestamp`),
  KEY `idx_travel_date` (`travel_date`),
  KEY `idx_location` (`latitude`,`longitude`),
  KEY `idx_camera` (`camera_make`,`camera_model`),
  KEY `idx_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## API 호환성

마이그레이션 후에도 기존 API 엔드포인트는 동일하게 작동합니다:

- `GET /api/photos`: 사진 목록 조회
- `POST /api/photos/upload`: 사진 업로드
- `PUT /api/photos/{id}`: 사진 메타데이터 수정
- `DELETE /api/photos/{id}`: 사진 삭제
- `GET /api/photos/search`: 위치 기반 검색

## 성능 개선사항

### 1. 인덱스 최적화

- 업로드/촬영 시간별 정렬을 위한 timestamp 인덱스
- 위치 기반 검색을 위한 복합 인덱스 (latitude, longitude)
- 카메라 정보 검색을 위한 복합 인덱스

### 2. 위치 기반 검색

MySQL의 공간 함수를 활용한 정확한 거리 계산:

```sql
SELECT *,
  (6371 * acos(cos(radians(?)) * cos(radians(latitude)) *
   cos(radians(longitude) - radians(?)) +
   sin(radians(?)) * sin(radians(latitude)))) AS distance
FROM photos
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
HAVING distance <= ?
ORDER BY distance
```

### 3. JSON 필드 지원

MySQL 5.7+ JSON 데이터 타입을 활용하여 복잡한 메타데이터 저장:

- `thumbnail_urls_json`: 썸네일 URL 정보
- `location_json`: 위치 상세 정보
- `exif_data_json`: EXIF 메타데이터
- `tags`: 태그 배열

## 롤백 방법

MySQL에서 NoSQL로 되돌리려면:

1. 환경변수 변경:
   ```env
   DATABASE_TYPE=nosql
   ```

2. 애플리케이션 재시작

## 주의사항

1. **백업**: 마이그레이션 전에 기존 NoSQL 데이터를 백업해야 합니다.
2. **다운타임**: 데이터 마이그레이션 중에는 서비스 중단이 필요할 수 있습니다.
3. **인덱스 재구성**: 대용량 데이터의 경우 인덱스 생성에 시간이 걸릴 수 있습니다.
4. **연결 수 제한**: MySQL 연결 수 제한을 확인하고 필요시 조정하세요.

## 문제 해결

### MySQL 연결 오류

```bash
ERROR 2003 (HY000): Can't connect to MySQL server
```

해결 방법:
1. MySQL 서버 상태 확인: `systemctl status mysql`
2. 포트 및 호스트 설정 확인
3. 방화벽 설정 확인

### 권한 오류

```bash
ERROR 1045 (28000): Access denied for user
```

해결 방법:
1. 사용자 권한 확인: `SHOW GRANTS FOR 'user'@'host';`
2. 필요한 권한 부여: `GRANT ALL PRIVILEGES ON database.* TO 'user'@'host';`

### 문자셋 오류

```bash
ERROR 1366 (HY000): Incorrect string value
```

해결 방법:
1. 데이터베이스 문자셋 확인: `SHOW CREATE DATABASE database_name;`
2. UTF8MB4 설정 확인: `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`