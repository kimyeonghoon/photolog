-- 업로드 상태 추가 마이그레이션
-- 실행: mysql -u [user] -p [database] < add_upload_status.sql

-- upload_status 필드 추가
ALTER TABLE photos
ADD COLUMN upload_status ENUM('uploading', 'completed', 'failed')
DEFAULT 'completed'
AFTER upload_timestamp;

-- 기존 데이터는 모두 'completed' 상태로 설정 (이미 DEFAULT로 처리됨)

-- 업로드 상태별 조회를 위한 인덱스 추가
ALTER TABLE photos ADD INDEX idx_upload_status (upload_status);

-- 미완료 업로드 정리를 위한 복합 인덱스
ALTER TABLE photos ADD INDEX idx_status_timestamp (upload_status, upload_timestamp);