#!/usr/bin/env python3
"""
OCI Compartment 설정 검증 스크립트
ioniere(루트) tenancy에 리소스 생성을 방지합니다.
"""

import os
import sys

def is_tenancy_id(ocid):
    """OCID가 tenancy ID 패턴인지 확인"""
    return ocid.startswith('ocid1.tenancy.oc1..')

def is_compartment_id(ocid):
    """OCID가 compartment ID 패턴인지 확인"""
    return ocid.startswith('ocid1.compartment.oc1..')

def validate_compartment():
    """현재 설정된 compartment가 올바른지 검증"""

    # 환경변수에서 compartment ID 읽기
    current_compartment = os.getenv('NOSQL_COMPARTMENT_ID')

    if not current_compartment:
        print("❌ NOSQL_COMPARTMENT_ID 환경변수가 설정되지 않았습니다!")
        return False

    # Tenancy ID 패턴 체크 (위험)
    if is_tenancy_id(current_compartment):
        print("🚨 경고: Tenancy ID가 설정되어 있습니다!")
        print(f"   현재 설정: {current_compartment}")
        print("   Compartment ID를 사용해야 합니다 (ocid1.compartment.oc1..로 시작)")
        print("   루트 tenancy에 리소스를 생성하지 마세요!")
        return False

    # Compartment ID 패턴 체크 (안전)
    if is_compartment_id(current_compartment):
        print("✅ 올바른 compartment ID 패턴입니다")
        print(f"   설정된 ID: {current_compartment}")
        return True

    # 알 수 없는 패턴
    print(f"⚠️  알 수 없는 OCID 패턴: {current_compartment}")
    print("   올바른 compartment ID인지 확인해주세요 (ocid1.compartment.oc1..로 시작)")
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