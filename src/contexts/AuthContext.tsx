/**
 * 인증 Context
 * 전역 인증 상태 관리
 */

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { authAPI } from '../services/authAPI'
import type { User } from '../services/authAPI'

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string) => Promise<{ success: boolean; message: string }>
  verifyCode: (code: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
  checkAuthStatus: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  })

  // 초기 인증 상태 확인
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // 인증 상태 확인
  const checkAuthStatus = () => {
    try {
      const hasToken = authAPI.isAuthenticated()
      const isTokenValid = !authAPI.isTokenExpired()
      const isAuth = hasToken && isTokenValid
      const user = isAuth ? authAPI.getCurrentUser() : null

      console.log('Auth status check:', { hasToken, isTokenValid, isAuth, user }) // 디버깅용

      setAuthState({
        isAuthenticated: isAuth,
        user,
        isLoading: false,
      })

      // 토큰이 만료된 경우 정리
      if (hasToken && !isTokenValid) {
        console.log('Token expired, logging out') // 디버깅용
        authAPI.logout()
      }
    } catch (error) {
      console.error('인증 상태 확인 오류:', error)
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      })
    }
  }

  // 로그인 요청 (이메일로 텔레그램 코드 발송)
  const login = async (email: string) => {
    try {
      const response = await authAPI.requestLogin(email)
      return response
    } catch (error) {
      console.error('로그인 요청 실패:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '로그인 요청 중 오류가 발생했습니다.',
      }
    }
  }

  // 인증 코드 검증
  const verifyCode = async (code: string) => {
    try {
      const response = await authAPI.verifyCode(code)

      if (response.success && response.token) {
        console.log('Code verification successful, token received') // 디버깅용
        // 인증 성공 시 상태 업데이트
        const user = authAPI.getCurrentUser()
        setAuthState({
          isAuthenticated: true,
          user,
          isLoading: false,
        })
        console.log('Auth state updated:', { isAuthenticated: true, user }) // 디버깅용
      }

      return response
    } catch (error) {
      console.error('코드 검증 실패:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : '코드 검증 중 오류가 발생했습니다.',
      }
    }
  }

  // 로그아웃
  const logout = () => {
    authAPI.logout()
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    })
  }

  // 토큰 만료 체크 (5분마다)
  useEffect(() => {
    if (!authState.isAuthenticated) return

    const interval = setInterval(() => {
      if (authAPI.isTokenExpired()) {
        console.log('토큰이 만료되어 로그아웃합니다.')
        logout()
      } else if (authAPI.needsRefresh()) {
        console.log('토큰 갱신이 필요합니다.')
        // 향후 토큰 갱신 로직 추가 가능
      }
    }, 5 * 60 * 1000) // 5분

    return () => clearInterval(interval)
  }, [authState.isAuthenticated])

  const contextValue: AuthContextType = {
    ...authState,
    login,
    verifyCode,
    logout,
    checkAuthStatus,
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { AuthContext }