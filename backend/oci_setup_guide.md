# OCI 계정 연동 설정 가이드

## 1. OCI 계정 정보 수집

다음 정보들을 OCI 콘솔에서 수집해야 합니다:

### 기본 계정 정보
```bash
# OCI 콘솔 > Identity & Security > Compartments
TENANCY_OCID="ocid1.tenancy.oc1..aaaaaaaa..."

# OCI 콘솔 > Identity & Security > Users > Your User
USER_OCID="ocid1.user.oc1..aaaaaaaa..."

# 사용할 리전 (예: ap-seoul-1, ap-chuncheon-1)
REGION="ap-seoul-1"

# Object Storage Namespace (OCI 콘솔 > Object Storage > Buckets에서 확인)
NAMESPACE="your-tenancy-namespace"

# 생성할 버킷 이름
BUCKET_NAME="photolog-storage"

# Compartment ID (대부분 TENANCY_OCID와 동일)
COMPARTMENT_ID="ocid1.compartment.oc1..aaaaaaaa..."
```

## 2. API 키 생성

### 2-1. 키 페어 생성
```bash
# 키 페어 생성 (로컬에서)
mkdir -p ~/.oci
openssl genrsa -out ~/.oci/oci_api_key.pem 2048
openssl rsa -pubout -in ~/.oci/oci_api_key.pem -out ~/.oci/oci_api_key_public.pem

# 권한 설정
chmod 600 ~/.oci/oci_api_key.pem
chmod 644 ~/.oci/oci_api_key_public.pem
```

### 2-2. 공개 키를 OCI에 등록
1. OCI 콘솔 > Identity & Security > Users > Your User
2. API Keys 탭 > Add API Key
3. Public Key 내용 복사해서 등록
4. Fingerprint 확인 및 기록

## 3. 설정 파일 생성

### 3-1. OCI Config 파일 (~/.oci/config)
```ini
[DEFAULT]
user=ocid1.user.oc1..aaaaaaaa...
fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
tenancy=ocid1.tenancy.oc1..aaaaaaaa...
region=ap-seoul-1
key_file=~/.oci/oci_api_key.pem
```

### 3-2. 환경변수 설정 (.env 파일)
```bash
# OCI Object Storage
OCI_NAMESPACE=your-tenancy-namespace
OCI_BUCKET_NAME=photolog-storage
OCI_REGION=ap-seoul-1

# OCI NoSQL Database
NOSQL_COMPARTMENT_ID=ocid1.compartment.oc1..aaaaaaaa...
NOSQL_TABLE_NAME=photos

# Storage Type (LOCAL or OCI)
STORAGE_TYPE=OCI
```

## 4. 버킷 생성

OCI 콘솔에서 Object Storage 버킷을 생성:

1. OCI 콘솔 > Storage > Object Storage > Buckets
2. Create Bucket
3. 버킷 이름: `photolog-storage`
4. Visibility: Public 또는 Private (필요에 따라)

## 5. 테스트 스크립트

```python
# test_oci_connection.py
import oci
from backend.shared.config import Config
from backend.shared.oci_client import OCIObjectStorageClient

def test_connection():
    try:
        Config.validate_config()
        client = OCIObjectStorageClient()

        # 네임스페이스 조회 테스트
        namespace = client.object_storage.get_namespace().data
        print(f"✅ OCI 연결 성공! Namespace: {namespace}")

        # 버킷 목록 조회 테스트
        buckets = client.object_storage.list_buckets(
            namespace_name=namespace,
            compartment_id=Config.NOSQL_COMPARTMENT_ID
        )
        print(f"✅ 버킷 목록 조회 성공: {len(buckets.data)} 개")

        return True

    except Exception as e:
        print(f"❌ OCI 연결 실패: {str(e)}")
        return False

if __name__ == "__main__":
    test_connection()
```

## 6. 주의사항

- API 키 파일의 권한을 반드시 600으로 설정
- Fingerprint를 정확히 입력
- Compartment ID는 대부분 Tenancy OCID와 동일
- Region 코드를 정확히 입력 (ap-seoul-1, ap-chuncheon-1 등)