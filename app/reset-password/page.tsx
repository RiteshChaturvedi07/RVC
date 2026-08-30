'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // --- States ---
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [expiredError, setExpiredError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  // Listen to Supabase Auth State changes & check URL query/hash params
  useEffect(() => {
    // Check URL parameters for explicit errors (e.g. otp_expired)
    const errorCode = searchParams.get('error_code') || searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (errorCode === 'otp_expired' || errorCode === '401' || (errorDescription && errorDescription.includes('expired'))) {
      setExpiredError('This recovery link has expired or is invalid. Please request a new password reset link.')
      setIsVerifying(false)
      return
    }

    // Subscribe to Auth State Changes (Recovery token exchange)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setIsSessionActive(true)
        setIsVerifying(false)
      }
    })

    // Also check current active session directly & exchange code if present
    async function checkCurrentSession() {
      try {
        const urlCode = searchParams.get('code') || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('code') : null)
        if (urlCode) {
          const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(urlCode)
          if (!exchangeErr && exchangeData.session) {
            setIsSessionActive(true)
            setIsVerifying(false)
            return
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setIsSessionActive(true)
        } else if (typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token'))) {
          setIsSessionActive(true)
        } else {
          setExpiredError('No active recovery session detected. Please request a password reset link.')
        }
      } catch {
        setExpiredError('Failed to verify recovery session. Please try requesting a new reset link.')
      } finally {
        setIsVerifying(false)
      }
    }

    void checkCurrentSession()

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [searchParams, supabase.auth])

  // --- Password Strength Evaluator ---
  const passwordChecks = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    }
  }, [password])

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length
  }, [passwordChecks])

  const passwordStrengthLabel = useMemo(() => {
    if (!password) return { label: 'None', color: 'bg-slate-300 dark:bg-slate-700 text-slate-400' }
    if (passwordScore <= 1) return { label: 'Weak ⚠️', color: 'bg-rose-500 text-white' }
    if (passwordScore === 2) return { label: 'Medium 🟡', color: 'bg-amber-500 text-white' }
    if (passwordScore === 3) return { label: 'Strong 🟢', color: 'bg-indigo-500 text-white' }
    return { label: 'Bulletproof 🔥', color: 'bg-emerald-500 text-white' }
  }, [password, passwordScore])

  // --- Form Submission ---
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordScore < 4) {
      setSubmitError('Password does not meet security requirements.')
      return
    }

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    setSubmitError('')

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) throw error

      setIsSuccess(true)
      toast.success('🎉 Password updated successfully! Redirecting to login...')
      setTimeout(() => {
        router.replace('/login')
      }, 1500)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : 'Failed to update password. Please try again.'
      setSubmitError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[450px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-emerald-500/15 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="w-full max-w-md space-y-6">
        
        {/* Top Header Brand Link */}
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <span className="text-white font-extrabold text-lg">R</span>
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
                RVC
              </span>
              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-bold -mt-1">
                Multi-Vertical OS
              </span>
            </div>
          </Link>

          <Link href="/login" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Back to Log In →
          </Link>
        </div>

        {/* Main Card Container */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0d1322]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6"
        >
          {isVerifying ? (
            /* Loading State while verifying session token */
            <div className="text-center py-8 space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                Verifying password recovery session...
              </p>
            </div>
          ) : expiredError || !isSessionActive ? (
            /* Expired / Invalid Token Error State Card */
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Reset Link Expired or Invalid
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  {expiredError || 'This recovery link is invalid or has already been used.'}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/forgot-password"
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Request New Reset Link</span>
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            /* Success State Card */
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  Password Updated!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  Your new password is live. Redirecting to log in...
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all inline-flex items-center gap-1.5"
                >
                  <span>Go to Login Now</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            /* New Password Update Form */
            <>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <KeyRound className="w-3.5 h-3.5" />
                  Set New Password
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Update Account Password
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                  Choose a new strong password for your RVC OS account.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                
                {/* New Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter new password..."
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (submitError) setSubmitError('')
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Confirm new password..."
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value)
                        if (submitError) setSubmitError('')
                      }}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {confirmPassword && (
                    <div className="mt-1">
                      {password === confirmPassword ? (
                        <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Passwords match
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-500">Passwords do not match</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Password Strength Meter & Checklist */}
                <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Password Strength</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${passwordStrengthLabel.color}`}>
                      {passwordStrengthLabel.label}
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordScore <= 1
                          ? 'w-1/4 bg-rose-500'
                          : passwordScore === 2
                          ? 'w-2/4 bg-amber-500'
                          : passwordScore === 3
                          ? 'w-3/4 bg-indigo-500'
                          : 'w-full bg-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[10px]">
                    <span className={`flex items-center gap-1 font-semibold ${passwordChecks.length ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {passwordChecks.length ? <Check className="w-3 h-3" /> : '○'} Min 8 chars
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${passwordChecks.uppercase ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {passwordChecks.uppercase ? <Check className="w-3 h-3" /> : '○'} 1 Uppercase
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${passwordChecks.number ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {passwordChecks.number ? <Check className="w-3 h-3" /> : '○'} 1 Number
                    </span>
                    <span className={`flex items-center gap-1 font-semibold ${passwordChecks.special ? 'text-emerald-500' : 'text-slate-400'}`}>
                      {passwordChecks.special ? <Check className="w-3 h-3" /> : '○'} 1 Special (@#$)
                    </span>
                  </div>
                </div>

                {submitError && (
                  <p className="text-rose-500 text-[11px] font-semibold text-center">{submitError}</p>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <span>Update Password & Log In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </motion.div>

      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex items-center justify-center p-8">
          <div className="w-full max-w-md h-96 bg-white/80 dark:bg-slate-900/80 rounded-3xl animate-pulse" />
        </div>
      }
    >
      <ResetPasswordFormContent />
    </Suspense>
  )
}
