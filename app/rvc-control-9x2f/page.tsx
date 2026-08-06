'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { OTPInput } from '@/components/otp-input'
import { createClient } from '@/lib/supabase/client'

type AdminLoginStep = 'credentials' | 'otp'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<AdminLoginStep>('credentials')
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
      newErrors.email = 'Admin email is required'
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
      // Generic message on purpose — don't reveal whether the email exists
      setErrors({ password: 'Invalid credentials.' })
      setIsLoading(false)
      return
    }

    /* MFA Bypassed temporarily for fast local development
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totpFactor = factors?.totp?.[0]

    if (!totpFactor) {
      // MFA is mandatory for admin access — refuse and sign out
      await supabase.auth.signOut()
      setErrors({ password: 'MFA is not configured for this account. Contact the system owner.' })
      setIsLoading(false)
      return
    }

    setMfaFactorId(totpFactor.id)
    setStep('otp')
    setIsLoading(false)
    */

    // Final gate: confirm this account is actually a super_admin before granting access
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user?.id)
      .single()

    if (profile?.role !== 'super_admin') {
      await supabase.auth.signOut()
      setErrors({ password: 'Access denied.' })
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.push('/rvc-control-9x2f/dashboard')
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

    // Final gate: confirm this account is actually a super_admin before granting access
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user?.id)
      .single()

    if (profile?.role !== 'super_admin') {
      await supabase.auth.signOut()
      setErrors({ otp: 'Access denied.' })
      setStep('credentials')
      setIsLoading(false)
      return
    }

    setIsLoading(false)
    router.push('/rvc-control-9x2f/dashboard')
  }

  const stepVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  }

  return (
    <div className="min-h-screen bg-slate-950 dark:bg-black flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5 dark:opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(67, 56, 202, 0.05) 25%, rgba(67, 56, 202, 0.05) 26%, transparent 27%, transparent 74%, rgba(67, 56, 202, 0.05) 75%, rgba(67, 56, 202, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(67, 56, 202, 0.05) 25%, rgba(67, 56, 202, 0.05) 26%, transparent 27%, transparent 74%, rgba(67, 56, 202, 0.05) 75%, rgba(67, 56, 202, 0.05) 76%, transparent 77%, transparent)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-indigo-600 rounded-full filter blur-3xl opacity-10 absolute" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={stepVariants}
          transition={{ duration: 0.3 }}
          key={step}
          className="relative"
        >
          {/* Animated border */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur" />

          <div className="relative bg-slate-900 rounded-xl p-8 border border-indigo-600 border-opacity-30 shadow-2xl">
            {/* Lock Icon */}
            <div className="flex justify-center mb-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="p-3 bg-indigo-600 bg-opacity-20 rounded-full"
              >
                <Lock className="w-6 h-6 text-indigo-500" />
              </motion.div>
            </div>

            {/* Credentials Step */}
            {step === 'credentials' && (
              <>
                <h1 className="text-2xl font-bold text-center text-slate-100 mb-1">RVC Control Panel</h1>
                <p className="text-center text-indigo-400 text-sm mb-8">Secure Administrative Access</p>

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                      Admin Email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@rvc.internal"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors({ ...errors, email: '' })
                      }}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-indigo-600 border-opacity-30 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all"
                    />
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1.5">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
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
                        className="w-full px-4 py-2.5 bg-slate-800 border border-indigo-600 border-opacity-30 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 placeholder-slate-500 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-xs mt-1.5">{errors.password}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed mt-6"
                  >
                    {isLoading ? 'Authenticating...' : 'Authenticate'}
                  </button>
                </form>
              </>
            )}

            {/* OTP Step */}
            {step === 'otp' && (
              <>
                <h1 className="text-2xl font-bold text-center text-slate-100 mb-1">Two-Factor Authentication</h1>
                <p className="text-center text-slate-400 text-sm mb-8">
                  Enter the 6-digit code from your authenticator app
                </p>

                <div className="mb-8">
                  <div className="flex gap-2 justify-center mb-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="w-10 h-10 bg-slate-800 border border-indigo-600 border-opacity-30 rounded-lg"
                      />
                    ))}
                  </div>

                  <OTPInput
                    length={6}
                    value={otp}
                    onChange={setOtp}
                    onComplete={handleOTPComplete}
                  />
                  {errors.otp && (
                    <p className="text-red-400 text-xs mt-4 text-center">{errors.otp}</p>
                  )}
                </div>

                <button
                  onClick={() => handleOTPSubmit()}
                  disabled={isLoading || otp.length !== 6}
                  className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Verify Access'}
                </button>

                <div className="mt-6 pt-6 border-t border-slate-700 text-center">
                  <p className="text-slate-500 text-xs">
                    Codes refresh automatically every 30 seconds in your app.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setStep('credentials')
                    setErrors({})
                  }}
                  className="w-full mt-4 px-6 py-2 border border-slate-700 text-slate-400 hover:text-slate-300 hover:border-slate-600 font-medium rounded-lg transition-colors text-sm"
                >
                  Use Different Email
                </button>
              </>
            )}
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-slate-900 border border-slate-800 rounded-lg text-center"
        >
          <p className="text-xs text-slate-500 leading-relaxed">
            🔒 RVC Internal Access — Unauthorized use prohibited
          </p>
        </motion.div>
      </div>
    </div>
  )
}
