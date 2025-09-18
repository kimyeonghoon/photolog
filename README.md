# 📸 포토로그 (Photolog)

여행 사진을 위치 정보와 함께 관리하는 웹 애플리케이션

## 🌟 주요 기능

### 📱 사진 관리
- **다중 사진 업로드**: 여러 사진을 한 번에 업로드
- **자동 썸네일 생성**: 다양한 크기의 썸네일 자동 생성
- **EXIF 데이터 추출**: 촬영 시간, 위치, 카메라 정보 자동 추출
- **메타데이터 편집**: 사진 설명 및 여행 날짜 수정
- **일괄 삭제**: 다중 선택을 통한 배치 삭제

### 🗺️ 위치 서비스
- **GPS 위치 자동 감지**: EXIF 데이터에서 GPS 좌표 추출
- **역 지오코딩**: 좌표를 사람이 읽을 수 있는 주소로 변환
- **한국 지역 특화**: 한글 지역명 지원
- **지도 시각화**: 여행 위치의 대화형 표시

### 🔐 보안 및 인증
- **JWT 기반 인증**: 안전한 토큰 기반 로그인
- **2FA 인증**: 텔레그램 봇을 통한 이중 인증
- **권한 관리**: 인증된 사용자만 사진 관리 가능

## 🛠️ 기술 스택

### Frontend
- **React 18** + **TypeScript**
- **Vite** (빌드 도구)
- **CSS Modules** (스타일링)
- **exifr** (EXIF 데이터 처리)

### Backend
- **Python 3.9+**
- **Oracle Cloud Infrastructure (OCI)**
  - NoSQL Database
  - Object Storage
  - Functions (서버리스)
- **JWT** (인증)
- **Telegram Bot API** (2FA)

### API 및 서비스
- **OpenStreetMap Nominatim** (지오코딩)
- **RESTful API** 설계

## 🚀 시작하기

### 필수 요구사항
- Node.js 18+
- Python 3.9+
- OCI 계정 및 설정

### 로컬 개발 환경 설정

1. **저장소 클론**
   ```bash
   git clone <repository-url>
   cd photolog
   ```

2. **프론트엔드 설정**
   ```bash
   npm install
   npm run dev
   ```

3. **백엔드 설정**
   ```bash
   cd backend
   pip install -r requirements.txt
   python3 tests/simple_server.py --port 8001
   ```

4. **환경 변수 설정**
   ```bash
   # backend/.env 파일 생성 (예시)
   OCI_REGION=ap-chuncheon-1
   NOSQL_COMPARTMENT_ID=your-compartment-id
   NOSQL_TABLE_NAME=photos
   OCI_NAMESPACE=your-namespace
   OCI_BUCKET_NAME=photolog-storage
   TELEGRAM_BOT_TOKEN=your-bot-token
   TELEGRAM_CHAT_ID=your-chat-id
   ALLOWED_EMAIL=your-email@domain.com
   SECRET_KEY=your-secret-key
   ```

### 프로덕션 빌드

```bash
# 프론트엔드 빌드
npm run build

# 빌드 파일은 dist/ 디렉토리에 생성됩니다
```

## 📁 프로젝트 구조

```
photolog/
├── src/                          # 프론트엔드 소스
│   ├── components/               # React 컴포넌트
│   │   ├── PhotoModal.tsx       # 사진 모달 뷰어
│   │   ├── MultiPhotoUpload.tsx # 다중 업로드
│   │   └── LocationDisplay.tsx  # 위치 표시
│   ├── pages/                   # 페이지 컴포넌트
│   │   └── HomePage.tsx         # 메인 페이지
│   ├── services/                # API 서비스
│   │   ├── photoAPI.ts          # 사진 API 클라이언트
│   │   └── authAPI.ts           # 인증 API
│   ├── utils/                   # 유틸리티
│   │   └── geocoding.ts         # 지오코딩 유틸
│   └── types/                   # TypeScript 타입 정의
├── backend/                     # 백엔드 소스
│   ├── shared/                  # 공유 모듈
│   │   └── auth_service.py      # 인증 서비스
│   ├── tests/                   # 개발 서버
│   │   ├── simple_server.py     # 로컬 API 서버
│   │   └── test_func_unified.py # 통합 업로드 핸들러
│   └── functions/               # OCI Functions
├── dist/                        # 빌드 출력
└── docs/                        # 문서
```

## 🔧 개발 가이드

### API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | 서버 상태 확인 |
| POST | `/api/auth/login` | 로그인 (이메일 인증) |
| POST | `/api/auth/verify` | 인증 코드 검증 |
| GET | `/api/photos` | 사진 목록 조회 |
| POST | `/api/photos/upload` | 단일 사진 업로드 |
| POST | `/api/photos/upload-unified` | 다중 사진 업로드 |
| GET | `/api/photos/{id}` | 특정 사진 조회 |
| PUT | `/api/photos/{id}` | 사진 메타데이터 수정 |
| DELETE | `/api/photos/{id}` | 사진 삭제 |

### 주요 기능 구현

#### 사진 업로드 플로우
1. 클라이언트에서 EXIF 데이터 추출
2. 썸네일 생성 (클라이언트 측)
3. Base64 인코딩 후 서버 전송
4. 서버에서 Object Storage 저장
5. NoSQL DB에 메타데이터 저장

#### 인증 플로우
1. 이메일 주소로 로그인 요청
2. 텔레그램 봇으로 인증 코드 전송
3. 사용자가 인증 코드 입력
4. JWT 토큰 발급 및 클라이언트 저장

## 🔒 보안 고려사항

- 모든 API 요청에 JWT 토큰 필요
- 환경 변수로 민감 정보 관리
- CORS 정책 적용
- 파일 업로드 크기 제한 (50MB)
- 이미지 파일 형식 검증

## 📈 성능 최적화

- 클라이언트 사이드 썸네일 생성
- 위치 정보 메모리 캐싱
- 한국 지역 특화 처리로 API 호출 최소화
- 무한 스크롤 페이지네이션
- 이미지 lazy loading

## 🐛 문제 해결

### 일반적인 문제들

**Q: 사진 업로드가 실패합니다**
- 파일 크기가 50MB를 초과하는지 확인
- 이미지 파일 형식인지 확인 (JPEG, PNG 등)
- 네트워크 연결 상태 확인

**Q: 위치 정보가 표시되지 않습니다**
- 사진에 GPS EXIF 데이터가 포함되어 있는지 확인
- 브라우저의 위치 권한 설정 확인

**Q: 로그인이 되지 않습니다**
- 텔레그램 봇 설정이 올바른지 확인
- 허용된 이메일 주소인지 확인
- 네트워크 연결 상태 확인

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다.

## 🙏 감사의 말

- [OpenStreetMap](https://www.openstreetmap.org/) - 지오코딩 서비스
- [exifr](https://github.com/MikeKovarik/exifr) - EXIF 데이터 처리
- [Oracle Cloud Infrastructure](https://www.oracle.com/cloud/) - 클라우드 인프라