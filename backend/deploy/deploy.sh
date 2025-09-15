#!/bin/bash

# 포토로그 백엔드 배포 스크립트
# OCI Functions 배포 자동화

set -e

echo "🚀 포토로그 백엔드 배포 시작..."

# 환경 변수 확인
check_env_vars() {
    echo "📋 환경 변수 확인 중..."

    required_vars=(
        "OCI_TENANCY"
        "OCI_USER"
        "OCI_FINGERPRINT"
        "OCI_KEY_FILE"
        "OCI_REGION"
        "OCI_NAMESPACE"
        "OCI_BUCKET_NAME"
        "NOSQL_COMPARTMENT_ID"
        "NOSQL_TABLE_NAME"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "❌ 환경 변수 $var 가 설정되지 않았습니다."
            exit 1
        fi
    done

    echo "✅ 모든 필수 환경 변수가 설정되었습니다."
}

# OCI CLI 설정 확인
check_oci_cli() {
    echo "🔧 OCI CLI 설정 확인 중..."

    if ! command -v oci &> /dev/null; then
        echo "❌ OCI CLI가 설치되지 않았습니다."
        echo "설치 가이드: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
        exit 1
    fi

    if ! oci iam user get --user-id $OCI_USER &> /dev/null; then
        echo "❌ OCI CLI 인증 설정이 올바르지 않습니다."
        exit 1
    fi

    echo "✅ OCI CLI 설정이 정상입니다."
}

# Fn CLI 설정 확인
check_fn_cli() {
    echo "⚙️ Fn CLI 설정 확인 중..."

    if ! command -v fn &> /dev/null; then
        echo "❌ Fn CLI가 설치되지 않았습니다."
        echo "설치 명령: curl -LSs https://raw.githubusercontent.com/fnproject/cli/master/install | sh"
        exit 1
    fi

    echo "✅ Fn CLI가 설치되어 있습니다."
}

# OCI 리소스 생성
create_oci_resources() {
    echo "🏗️ OCI 리소스 생성 중..."

    # Object Storage 버킷 생성
    echo "📦 Object Storage 버킷 확인/생성..."
    if ! oci os bucket get --bucket-name $OCI_BUCKET_NAME --namespace $OCI_NAMESPACE &> /dev/null; then
        echo "버킷 생성 중: $OCI_BUCKET_NAME"
        oci os bucket create \
            --compartment-id $NOSQL_COMPARTMENT_ID \
            --name $OCI_BUCKET_NAME \
            --namespace $OCI_NAMESPACE
        echo "✅ 버킷이 생성되었습니다."
    else
        echo "✅ 버킷이 이미 존재합니다."
    fi

    # NoSQL 테이블 생성 (DDL)
    echo "🗄️ NoSQL 테이블 확인/생성..."
    # 실제 환경에서는 OCI Console 또는 Terraform으로 미리 생성 권장
    echo "ℹ️ NoSQL 테이블은 수동으로 생성해주세요."
    echo "   테이블명: $NOSQL_TABLE_NAME"
    echo "   스키마: docs/nosql-schema.md 참조"
}

# Functions 애플리케이션 생성
create_fn_application() {
    echo "📱 Functions 애플리케이션 생성 중..."

    APP_NAME="photolog-backend"
    SUBNET_ID=${SUBNET_ID:-"your-subnet-id"}  # 실제 서브넷 ID로 변경 필요

    # 애플리케이션 존재 확인
    if oci fn application get --application-id $(oci fn application list --compartment-id $NOSQL_COMPARTMENT_ID --display-name $APP_NAME --query 'data[0].id' --raw-output 2>/dev/null) &> /dev/null; then
        echo "✅ Functions 애플리케이션이 이미 존재합니다."
    else
        echo "애플리케이션 생성 중: $APP_NAME"
        oci fn application create \
            --compartment-id $NOSQL_COMPARTMENT_ID \
            --display-name $APP_NAME \
            --subnet-ids "[\"$SUBNET_ID\"]"
        echo "✅ Functions 애플리케이션이 생성되었습니다."
    fi
}

# 개별 함수 배포
deploy_function() {
    local function_name=$1
    local function_path="../functions/$function_name"

    echo "🔄 $function_name 함수 배포 중..."

    if [ ! -d "$function_path" ]; then
        echo "❌ 함수 디렉토리가 존재하지 않습니다: $function_path"
        exit 1
    fi

    cd "$function_path"

    # 함수 배포
    fn deploy --app photolog-backend --no-cache

    cd - > /dev/null

    echo "✅ $function_name 함수가 배포되었습니다."
}

# API Gateway 설정
setup_api_gateway() {
    echo "🌐 API Gateway 설정..."
    echo "ℹ️ API Gateway는 OCI Console에서 수동으로 설정해주세요."
    echo "   설정 가이드: docs/api-gateway-setup.md 참조"
}

# 메인 배포 프로세스
main() {
    echo "==============================================="
    echo "🎯 포토로그 백엔드 배포 스크립트"
    echo "==============================================="

    # 사전 확인
    check_env_vars
    check_oci_cli
    check_fn_cli

    # 리소스 생성
    create_oci_resources
    create_fn_application

    # 함수 배포
    echo "📦 Functions 배포 시작..."
    deploy_function "photo-upload"
    # deploy_function "photo-list"
    # deploy_function "thumbnail-generator"
    # deploy_function "metadata-processor"

    # API Gateway 안내
    setup_api_gateway

    echo ""
    echo "🎉 배포가 완료되었습니다!"
    echo ""
    echo "다음 단계:"
    echo "1. OCI Console에서 API Gateway 설정"
    echo "2. 프론트엔드에서 API 엔드포인트 연동"
    echo "3. 테스트 및 모니터링 설정"
    echo ""
}

# 스크립트 실행
main "$@"