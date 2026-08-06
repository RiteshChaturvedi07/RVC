'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { OTPInput } from '@/components/otp-input'
import { createClient } from '@/lib/supabase/client'

type LoginStep = 'credentials' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<LoginStep>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState('')

  const validateCredentials = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!email?.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCredentials()) return

    setIsLoading(true)
    setErrors({})

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setErrors({ password: signInError.message })
      setIsLoading(false)
      return
    }

    /* MFA Bypassed temporarily for fast local development
    // Check if this account has an MFA factor enrolled
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totpFactor = factors?.totp?.[0]

      if (totpFactor) {
        setMfaFactorId(totpFactor.id)
        setStep('otp')
        setIsLoading(false)
        return
      }
    }

    // No MFA enrolled yet — send them to set it up before entering the dashboard
    setIsLoading(false)
    router.push('/enroll-mfa')
    */

    // Redirect straight to dashboard
    setIsLoading(false)
    router.push('/dashboard')
  }

  const handleOTPComplete = (otpValue: string) => {
    if (otpValue.length === 6) {
      handleOTPSubmit(otpValue)
    }
  }

  const handleOTPSubmit = async (otpValue: string = otp) => {
    if (otpValue.length !== 6) {
      setErrors({ otp: 'Please enter a valid 6-digit code' })
      return
    }

    setIsLoading(true)

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: mfaFactorId,
    })

    if (challengeError) {
      setErrors({ otp: challengeError.message })
      setIsLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: otpValue,
    })

    if (verifyError) {
      setErrors({ otp: 'Incorrect code. Please try again.' })
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.push('/dashboard')
  }

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={stepVariants}
          transition={{ duration: 0.3 }}
          key={step}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8"
        >
          {/* Credentials Step */}
          {step === 'credentials' && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Welcome Back</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">Log in to your RVC account</p>

              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (errors.email) setErrors({ ...errors, email: '' })
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 transition-colors ${
                      errors.email ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors({ ...errors, password: '' })
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 transition-colors ${
                        errors.password ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                  )}
                </div>

                <div className="text-right">
                  <Link
                    href="#"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Logging in...' : 'Log In'}
                </button>
              </form>
            </>
          )}

          {/* OTP Step */}
          {step === 'otp' && (
            <>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Verify with 2FA</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-8">
                Enter the 6-digit code from your authenticator app
              </p>

              <div className="mb-8">
                <OTPInput
                  length={6}
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleOTPComplete}
                />
                {errors.otp && (
                  <p className="text-red-500 text-sm mt-4 text-center">{errors.otp}</p>
                )}
              </div>

              <button
                onClick={() => handleOTPSubmit()}
                disabled={isLoading || otp.length !== 6}
                className="w-full px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed mb-4"
              >
                {isLoading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Codes refresh automatically every 30 seconds in your authenticator app.
                </p>
              </div>

              <button
                onClick={() => {
                  setStep('credentials')
                  setErrors({})
                }}
                className="w-full mt-4 px-6 py-2 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 font-medium rounded-lg transition-colors"
              >
                Use Different Email
              </button>
            </>
          )}
        </motion.div>

        {/* Sign Up Link */}
        <p className="text-center text-slate-600 dark:text-slate-400 mt-6">
          New here?{' '}
          <Link href="/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}