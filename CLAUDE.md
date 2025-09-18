# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 코드 작업을 할 때 참고할 가이드를 제공합니다.

## 프로젝트 개요

이 프로젝트는 Oracle Cloud Infrastructure(OCI)에서 서버리스 환경으로 배포되는 여행 포토로그 웹 애플리케이션입니다. 사용자가 짧은 텍스트 설명과 함께 사진을 업로드하고, EXIF 위치 데이터를 자동 추출하며, 썸네일을 생성하고, 대화형 지도에 여행 위치를 표시하는 기능을 제공합니다.

## 계획된 아키텍처

프로젝트 명세서(기획서.md)에 따라 애플리케이션은 다음과 같이 구성됩니다:

### 프론트엔드
- **프레임워크**: React 기반 웹 애플리케이션
- **사진 업로드**: 파일 선택 및 카메라 촬영 기능
- **EXIF 처리**: exifr 라이브러리를 사용한 클라이언트 측 EXIF 데이터 추출
- **지도 연동**: 위치 마커가 포함된 대화형 지도 표시
- **UI 컴포넌트**: 짧은 텍스트 입력 폼 및 사진 썸네일 표시

### 백엔드 (서버리스)
- **런타임**: Python 기반 OCI Functions
- **API Gateway**: 사진 업로드 및 메타데이터용 RESTful 엔드포인트
- **파일 저장소**: 사진 자산용 OCI Object Storage
- **썸네일 처리**: 자동 썸네일 생성 함수
- **데이터베이스**: OCI NoSQL DB 또는 호환 가능한 데이터베이스 서비스

### 인프라
- **클라우드 플랫폼**: Oracle Cloud Infrastructure (OCI)
- **인증**: OAuth 지원을 포함한 OCI IAM 연동
- **저장소**: 사진 및 썸네일용 Object Storage
- **데이터베이스**: 메타데이터 및 위치 정보용 NoSQL 데이터베이스

## 개발 단계

프로젝트는 체계적인 개발 방식을 따릅니다:

1. **요구사항 및 설계**: 기능 명세, 데이터베이스 스키마, API 설계, UI/UX 플로우
2. **프론트엔드 개발**: React 설정, 사진 업로드, EXIF 추출, 지도 연동
3. **서버리스 백엔드**: OCI Functions, API Gateway, Object Storage 연동
4. **데이터베이스 연동**: NoSQL 데이터베이스 설정, 메타데이터 저장 API
5. **보안 및 인증**: 사용자 인증, 개인정보 보호 규정 준수, 위치 권한
6. **테스트 및 배포**: 통합 테스트, CI/CD 자동화, 프로덕션 배포

## 주요 기능

- **사진 관리**: 업로드, 썸네일 생성, EXIF 데이터 추출, 단일/일괄 삭제
- **위치 서비스**: EXIF 데이터에서 자동 위치 감지
- **텍스트 통합**: 사진 업로드와 함께 짧은 텍스트 설명
- **지도 시각화**: 여행 위치의 대화형 표시
- **날짜 관리**: EXIF 촬영시간 우선, 없을 경우 사용자 입력 여행날짜 fallback
- **개인정보 보호 제어**: 위치 데이터에 대한 사용자 동의, 개인정보 보호 정책 준수

## 구현 완료 기능

### 사진 삭제 기능 (2024-09-18)
- **단일 삭제**: PhotoModal에서 개별 사진 삭제 (확인 다이얼로그 포함)
- **일괄 삭제**: HomePage에서 다중 선택을 통한 배치 삭제
- **완전 삭제**: NoSQL 메타데이터와 Object Storage 파일 모두 제거
- **UI/UX 개선**: iOS 스타일 헤더 레이아웃, 시각적 분리, 반응형 디자인

### EXIF 날짜 처리 개선 (2024-09-18)
- **메타데이터 날짜 지정**: EXIF 촬영시간이 없는 경우 사용자 입력 날짜 사용 가능
- **여행날짜 입력 UI**: MultiPhotoUpload에 선택적 날짜 입력 필드 추가
- **우선순위 로직**: EXIF 촬영시간 > 사용자 입력 여행날짜 > 업로드 시간 순서로 적용
- **스마트 fallback**: 촬영시간이 없는 사진에 자동으로 여행날짜(정오) 적용

### OCI 안전 설정 및 배포 (2024-09-18)
- **Compartment 보안**: `yeonghoon.kim` compartment만 사용 (루트 tenancy 사용 금지)
- **검증 스크립트**: `backend/validate_compartment.py`로 잘못된 설정 자동 감지
- **Object Storage**: `photolog-storage` 버킷 (`yeonghoon.kim` compartment에 생성)
- **NoSQL Database**: `photos` 테이블 (`yeonghoon.kim` compartment에 생성)
- **환경설정 보호**: .env 파일에 경고 주석 및 올바른 compartment ID 명시

### 사진 메타데이터 수정 기능 수정 (2024-09-18)
- **필드명 통일**: 프론트엔드-백엔드 간 `timestamp` → `travel_date`로 일관성 개선
- **백엔드 Import 오류 수정**: NoSQL 클라이언트 상대 import 문제 해결
- **타입 정의 개선**: TypeScript 인터페이스 일관성 유지
- **API 호출 안정화**: PUT 엔드포인트 JSON 파싱 및 인증 플로우 개선

### CORS 문제 해결 및 지오코딩 개선 (2024-09-18)
- **지오코딩 프록시**: OpenStreetMap Nominatim API CORS 우회를 위한 백엔드 프록시 구현
- **한국 지역 Fallback**: 좌표 기반 한국 지역 감지 및 한국어 지역명 제공
- **네트워크 오류 처리**: 지오코딩 실패 시 좌표 표시로 graceful fallback
- **캐싱 시스템**: 24시간 지속되는 위치 정보 캐시로 성능 개선

### 프로덕션 환경 검증 (2024-09-18)
- **완전한 인증 플로우**: 텔레그램 봇 기반 2FA 시스템 프로덕션 검증
- **API 엔드포인트 테스트**: 모든 CRUD 작업의 인증 및 권한 검증 완료
- **32개 사진 데이터**: 실제 여행 사진들이 정상적으로 저장 및 표시됨
- **Oracle Cloud 연동**: Object Storage 및 NoSQL DB 정상 작동 확인

## 개발 참고사항

### 보안 및 개인정보 보호
- 애플리케이션은 명시적인 위치 동의를 통해 사용자 개인정보를 우선 보호합니다
- 텔레그램 봇 기반 2FA 시스템으로 강력한 인증 보안 구현
- 위치 기반 기능은 개인정보 보호 규정을 신중하게 처리해야 합니다

### 성능 최적화
- 더 나은 성능을 위해 EXIF 데이터 처리는 클라이언트 측에서 수행됩니다
- 지오코딩 결과 24시간 캐싱으로 API 호출 최소화
- 썸네일 생성을 통한 효율적인 이미지 로딩

### 아키텍처
- 서버리스 아키텍처는 확장성과 비용 효율성을 보장합니다
- Oracle Cloud Infrastructure 완전 활용 (Object Storage, NoSQL DB)
- 프론트엔드-백엔드 API 일관성 유지 (필드명 통일)

### 국제화 및 접근성
- UI 요소에 한국어 지원 완료
- 한국 지역 좌표 기반 지역명 제공
- 안드로이드 크롬의 GPS 메타데이터 제거는 정상적인 보안 기능

### 기술 스택
- **Frontend**: React + TypeScript + Vite
- **Backend**: Python + OCI Functions
- **Database**: OCI NoSQL Database
- **Storage**: OCI Object Storage
- **Authentication**: 텔레그램 봇 + JWT
- **Maps**: Leaflet + OpenStreetMap