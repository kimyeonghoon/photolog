# Photolog 백엔드 Docker Compose 관리 Makefile

.PHONY: help build up down restart logs clean dev prod status

# 기본 타겟
help:
	@echo "🐳 Photolog 백엔드 Docker Compose 명령어"
	@echo ""
	@echo "개발 환경:"
	@echo "  make dev        - 개발 환경 시작 (빌드 + 실행)"
	@echo "  make up         - 컨테이너 실행"
	@echo "  make down       - 컨테이너 중지"
	@echo "  make restart    - 컨테이너 재시작"
	@echo "  make build      - 이미지 빌드"
	@echo ""
	@echo "운영 환경:"
	@echo "  make prod       - 운영 환경 시작"
	@echo "  make prod-down  - 운영 환경 중지"
	@echo ""
	@echo "관리:"
	@echo "  make logs       - 로그 확인"
	@echo "  make logs-f     - 로그 실시간 확인"
	@echo "  make status     - 컨테이너 상태 확인"
	@echo "  make clean      - 모든 컨테이너/이미지 정리"
	@echo ""

# 개발 환경
dev: build up

build:
	@echo "📦 백엔드 Docker 이미지 빌드 중..."
	docker compose build

up:
	@echo "🚀 백엔드 컨테이너 시작 중..."
	docker compose up -d

down:
	@echo "🛑 백엔드 컨테이너 중지 중..."
	docker compose down

restart: down up

# 운영 환경
prod:
	@echo "🚀 백엔드 운영 환경 시작 중..."
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	@echo "🛑 백엔드 운영 환경 중지 중..."
	docker compose -f docker-compose.prod.yml down

# 로그 및 상태
logs:
	docker compose logs photolog-backend

logs-f:
	docker compose logs -f photolog-backend

status:
	@echo "📊 백엔드 컨테이너 상태:"
	docker compose ps
	@echo ""
	@echo "📊 백엔드 이미지:"
	docker images | grep photolog-backend

# 정리
clean:
	@echo "🧹 Docker 정리 중..."
	docker compose down -v --rmi all
	docker system prune -f

# 헬스체크
health:
	@echo "🔍 백엔드 헬스체크:"
	@curl -s http://localhost:8001/health | jq . || echo "백엔드 연결 실패"