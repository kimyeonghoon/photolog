# 포토로그 백엔드 (Photolog Backend)

여행 포토로그 애플리케이션의 서버리스 백엔드 시스템

## 📁 디렉토리 구조

```
backend/
├── functions/                 # OCI Functions 서버리스 함수들
│   ├── photo-upload/         # 사진 업로드 API
│   ├── photo-list/           # 사진 목록 조회 API
│   ├── thumbnail-generator/  # 썸네일 생성 함수
│   └── metadata-processor/   # EXIF 메타데이터 처리 함수
├── shared/                   # 공통 유틸리티 및 모듈
├── docs/                     # API 문서화
└── tests/                    # 테스트 코드
```

## 🛠️ 기술 스택

- **런타임**: Python 3.9+
- **클라우드**: Oracle Cloud Infrastructure (OCI)
- **서버리스**: OCI Functions
- **API**: OCI API Gateway
- **저장소**: OCI Object Storage
- **데이터베이스**: OCI NoSQL Database

## 🚀 Functions 목록

### 1. photo-upload
- 사진 파일 업로드 처리
- Object Storage 저장
- 메타데이터 추출 및 저장

### 2. photo-list
- 업로드된 사진 목록 조회
- 필터링 및 정렬 기능

### 3. thumbnail-generator
- 자동 썸네일 생성
- 다양한 크기 지원

### 4. metadata-processor
- EXIF 데이터 처리
- 위치 정보 추출
- 지오코딩 서비스 연동

## 📝 개발 가이드

1. 각 함수는 독립적인 디렉토리에서 개발
2. `shared/` 디렉토리의 공통 모듈 활용
3. OCI SDK를 사용한 클라우드 서비스 연동
4. 환경 변수를 통한 설정 관리