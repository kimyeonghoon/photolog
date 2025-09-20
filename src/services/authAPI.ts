/**
 * 인증 관련 API 서비스
 * 텔레그램 봇 기반 2FA 인증 시스템
 */

const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8001'
  : `${window.location.protocol}//${window.location.host}/api`

export interface LoginRequest {
  email: string
}

export interface LoginResponse {
  success: boolean
  message: string
}

export interface VerifyRequest {
  code: string
}

export interface VerifyResponse {
  success: boolean
  message: string
  token?: string
  user?: {
    id: string
    telegram_chat_id: string
  }
}

export interface User {
  id: string
  telegram_chat_id: string
  email?: string
}

export class AuthAPIClient {
  private token: string | null = null

  constructor() {
    // 로컬 스토리지에서 토큰 복원
    this.token = localStorage.getItem('auth_token')
  }

  /**
   * 이메일로 로그인 요청 (텔레그램 코드 발송)
   */
  async requestLogin(email: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      return data
    } catch (error) {
      console.error('로그인 요청 실패:', error)
      throw error
    }
  }

  /**
   * 인증 코드 검증 (JWT 토큰 발급)
   */
  async verifyCode(code: string): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`)
      }

      // 토큰 저장
      if (data.token) {
        this.token = data.token
        localStorage.setItem('auth_token', data.token)
      }

      return data
    } catch (error) {
      console.error('코드 검증 실패:', error)
      throw error
    }
  }

  /**
   * 로그아웃
   */
  logout(): void {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  /**
   * 현재 인증 상태 확인
   */
  isAuthenticated(): boolean {
    return !!this.token
  }

  /**
   * 현재 토큰 반환
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * localStorage에서 토큰 동기화
   */
  syncTokenFromStorage(): void {
    this.token = localStorage.getItem('auth_token')
  }

  /**
   * 인증 헤더 반환
   */
  getAuthHeaders(): Record<string, string> {
    // 매번 최신 토큰을 localStorage에서 동기화
    this.syncTokenFromStorage()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    return headers
  }

  /**
   * JWT 토큰 만료 확인
   */
  isTokenExpired(): boolean {
    if (!this.token) return true

    try {
      // JWT 토큰을 파싱해서 만료 시간 확인
      const payload = JSON.parse(atob(this.token.split('.')[1]))
      const now = Date.now() / 1000

      return payload.exp < now
    } catch (error) {
      console.error('토큰 파싱 오류:', error)
      return true
    }
  }

  /**
   * 토큰 갱신이 필요한지 확인 (만료 5분 전)
   */
  needsRefresh(): boolean {
    if (!this.token) return false

    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]))
      const now = Date.now() / 1000
      const fiveMinutesFromNow = now + (5 * 60) // 5분 후

      return payload.exp < fiveMinutesFromNow
    } catch (error) {
      return false
    }
  }

  /**
   * 사용자 정보 추출 (JWT에서)
   */
  getCurrentUser(): User | null {
    if (!this.token) return null

    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]))
      return {
        id: payload.user_id,
        telegram_chat_id: payload.telegram_chat_id,
      }
    } catch (error) {
      console.error('사용자 정보 추출 오류:', error)
      return null
    }
  }
}

// 싱글톤 인스턴스
export const authAPI = new AuthAPIClient()