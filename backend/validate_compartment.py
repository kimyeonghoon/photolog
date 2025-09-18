#!/usr/bin/env python3
"""
OCI Compartment 설정 검증 스크립트
ioniere(루트) tenancy에 리소스 생성을 방지합니다.
"""

import os
import sys

# 위험한 tenancy ID (ioniere 루트)
DANGEROUS_TENANCY_ID = "ocid1.tenancy.oc1..aaaaaaaayjjulcyf6jtw3slbdxockiwt2cfbzg2z75sumuamy6njcce3a4ma"

# 올바른 compartment ID (yeonghoon.kim)
CORRECT_COMPARTMENT_ID = "ocid1.compartment.oc1..aaaaaaaamhidad3wjjhfjymz25keyffye4ttg7upjvpvamnnajzmyraa2dyq"

def validate_compartment():
    """현재 설정된 compartment가 올바른지 검증"""

    # 환경변수에서 compartment ID 읽기
    current_compartment = os.getenv('NOSQL_COMPARTMENT_ID')

    if not current_compartment:
        print("❌ NOSQL_COMPARTMENT_ID 환경변수가 설정되지 않았습니다!")
        return False

    if current_compartment == DANGEROUS_TENANCY_ID:
        print("🚨 경고: ioniere(루트) tenancy ID가 설정되어 있습니다!")
        print(f"   현재 설정: {current_compartment}")
        print(f"   올바른 설정: {CORRECT_COMPARTMENT_ID}")
        print("   yeonghoon.kim compartment를 사용해야 합니다!")
        return False

    if current_compartment == CORRECT_COMPARTMENT_ID:
        print("✅ 올바른 compartment가 설정되어 있습니다 (yeonghoon.kim)")
        return True

    print(f"⚠️  알 수 없는 compartment ID: {current_compartment}")
    print(f"   예상된 ID: {CORRECT_COMPARTMENT_ID}")
    return False

def main():
    """메인 검증 함수"""
    print("=== OCI Compartment 설정 검증 ===")

    if validate_compartment():
        print("검증 통과! 안전하게 OCI 리소스를 사용할 수 있습니다.")
        sys.exit(0)
    else:
        print("검증 실패! 설정을 확인하고 수정해주세요.")
        sys.exit(1)

if __name__ == "__main__":
    main()