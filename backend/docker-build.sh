#!/bin/bash

# 백엔드 Docker 빌드 및 실행 스크립트

set -e

echo "🐳 포토로그 백엔드 Docker 빌드 시작..."

# 이미지 이름과 태그 설정
IMAGE_NAME="photolog-backend"
TAG="latest"
CONTAINER_NAME="photolog-backend-container"

# 1. Docker 이미지 빌드
echo "📦 Docker 이미지 빌드 중..."
docker build -t $IMAGE_NAME:$TAG .

echo "✅ Docker 이미지 빌드 완료: $IMAGE_NAME:$TAG"

# 2. 기존 컨테이너 중지 및 제거 (실행 중인 경우)
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo "🛑 기존 컨테이너 중지 및 제거 중..."
    docker stop $CONTAINER_NAME || true
    docker rm $CONTAINER_NAME || true
fi

echo "🎉 빌드 완료! 다음 명령으로 실행하세요:"
echo ""
echo "# 환경변수 파일과 함께 실행:"
echo "docker run -d --name $CONTAINER_NAME -p 8001:8001 --env-file .env $IMAGE_NAME:$TAG"
echo ""
echo "# 또는 환경변수를 직접 전달:"
echo "docker run -d --name $CONTAINER_NAME -p 8001:8001 \\"
echo "  -e OCI_NAMESPACE=your-namespace \\"
echo "  -e OCI_BUCKET_NAME=photolog-storage \\"
echo "  -e OCI_REGION=ap-chuncheon-1 \\"
echo "  -e NOSQL_COMPARTMENT_ID=your-compartment-id \\"
echo "  -e NOSQL_TABLE_NAME=photos \\"
echo "  -e STORAGE_TYPE=OCI \\"
echo "  -v ~/.oci:/root/.oci:ro \\"
echo "  $IMAGE_NAME:$TAG"
echo ""
echo "📋 로그 확인: docker logs -f $CONTAINER_NAME"
echo "🛑 중지: docker stop $CONTAINER_NAME"