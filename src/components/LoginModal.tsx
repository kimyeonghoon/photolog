/**
 * 로그인 모달 컴포넌트
 * 텔레그램 봇 기반 2FA 인증
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './LoginModal.css'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type AuthStep = 'email' | 'code' | 'success'

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const { login, verifyCode } = useAuth()
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 모달이 열릴 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setStep('email')
      setEmail('')
      setCode('')
      setMessage('')
      setError('')
      setIsLoading(false)
    }
  }, [isOpen])

  // 이메일 제출
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setError('')

    try {
      const response = await login(email.trim())

      if (response.success) {
        setMessage(response.message)
        setStep('code')
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError('로그인 요청 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 인증 코드 제출
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setIsLoading(true)
    setError('')

    try {
      const response = await verifyCode(code.trim())

      if (response.success) {
        setStep('success')
        setMessage('로그인 성공! 잠시 후 자동으로 닫힙니다.')

        // 2초 후 모달 닫기
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 2000)
      } else {
        setError(response.message)
      }
    } catch (error) {
      setError('코드 검증 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 코드 입력 자동 포맷팅 (6자리)
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(value)
  }

  // 뒤로가기 (코드 단계에서 이메일 단계로)
  const handleBackToEmail = () => {
    setStep('email')
    setCode('')
    setError('')
    setMessage('')
  }

  if (!isOpen) return null

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <h2>🔐 로그인</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="login-modal-content">
          {step === 'email' && (
            <>
              <div className="login-step-info">
                <h3>이메일 인증</h3>
                <p>등록된 이메일 주소를 입력하세요. 텔레그램으로 인증 코드가 전송됩니다.</p>
              </div>

              <form onSubmit={handleEmailSubmit}>
                <div className="input-group">
                  <label htmlFor="email">이메일 주소</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@photolog.app"
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && <div className="error-message">❌ {error}</div>}
                {message && <div className="success-message">✅ {message}</div>}

                <button type="submit" disabled={isLoading || !email.trim()} className="submit-button">
                  {isLoading ? '전송 중...' : '인증 코드 요청'}
                </button>
              </form>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="login-step-info">
                <h3>인증 코드 입력</h3>
                <p>텔레그램으로 전송된 6자리 인증 코드를 입력하세요.</p>
                <p className="code-hint">📱 텔레그램 앱을 확인해주세요</p>
              </div>

              <form onSubmit={handleCodeSubmit}>
                <div className="input-group">
                  <label htmlFor="code">인증 코드</label>
                  <input
                    id="code"
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="123456"
                    maxLength={6}
                    className="code-input"
                    required
                    disabled={isLoading}
                    autoComplete="one-time-code"
                  />
                </div>

                {error && <div className="error-message">❌ {error}</div>}
                {message && <div className="success-message">✅ {message}</div>}

                <div className="button-group">
                  <button
                    type="button"
                    onClick={handleBackToEmail}
                    disabled={isLoading}
                    className="back-button"
                  >
                    ← 이메일 변경
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || code.length !== 6}
                    className="submit-button"
                  >
                    {isLoading ? '검증 중...' : '로그인'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="login-success">
              <div className="success-icon">🎉</div>
              <h3>로그인 성공!</h3>
              <p>환영합니다! 잠시 후 자동으로 닫힙니다.</p>
            </div>
          )}
        </div>

        <div className="login-modal-footer">
          <div className="security-notice">
            🛡️ 보안을 위해 토큰은 15분 후 자동 만료됩니다.
          </div>
        </div>
      </div>
    </div>
  )
}