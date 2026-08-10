'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { OTPInput } from '@/components/otp-input'
import { createClient } from '@/lib/supabase/client'

type EnrollStep = 'loading' | 'scan' | 'verify' | 'error'

export default function EnrollMFAPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<EnrollStep>('loading')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [factorId, setFactorId] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const enrollmentStarted = useRef(false)
  const qrSource = qrCode.startsWith('<svg') ? `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}` : qrCode

  const redirectByProfile = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', userData.user?.id).single()
    if (profile?.role === 'super_admin') { router.push('/rvc-control-9x2f/dashboard'); return }
    if (profile?.tenant_id) {
      const { data: tenant } = await supabase.from('tenants').select('vertical').eq('id', profile.tenant_id).single()
      router.push(tenant?.vertical === 'restaurant' ? '/restaurant-dashboard' : '/coming-soon')
      return
    }
    router.push('/dashboard')
  }

  useEffect(() => {
    const startEnrollment = async () => {
      // React development mode can run effects twice. Without this guard the
      // second request creates a duplicate friendly-name enrolment error.
      if (enrollmentStarted.current) return
      enrollmentStarted.current = true
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!userData.user) {
          router.push('/login')
          return
        }

        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
        if (factorsError) throw factorsError
        const existingFactor = factors?.all?.find((factor) => factor.factor_type === 'totp') ?? factors?.totp?.[0]

        if (existingFactor) {
          // A verified factor only needs an AAL2 challenge, not another enrolment.
          if (existingFactor.status === 'verified') {
            setFactorId(existingFactor.id)
            setStep('verify')
            return
          }

          // Supabase will reject another enrolment with the same empty/default
          // friendly name. Remove incomplete factors before creating a fresh one.
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: existingFactor.id })
          if (unenrollError) throw unenrollError
        }

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'RVC Authenticator',
        })
        if (enrollError) {
          // A factor may have been created by an earlier request but not yet
          // been returned by listFactors. Re-read it and continue securely.
          if (enrollError.message.includes('already exists')) {
            const { data: retryFactors, error: retryError } = await supabase.auth.mfa.listFactors()
            if (retryError) throw retryError
            const retryFactor = retryFactors?.all?.find((factor) => factor.factor_type === 'totp') ?? retryFactors?.totp?.[0]
            if (retryFactor?.status === 'verified') { setFactorId(retryFactor.id); setStep('verify'); return }
            if (retryFactor) {
              const { error: cleanupError } = await supabase.auth.mfa.unenroll({ factorId: retryFactor.id })
              if (cleanupError) throw cleanupError
              const { data: fresh, error: freshError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'RVC Authenticator' })
              if (freshError) throw freshError
              setFactorId(fresh.id); setQrCode(fresh.totp.qr_code); setSecret(fresh.totp.secret); setStep('scan'); return
            }
          }
          throw enrollError
        }

        setFactorId(data.id)
        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
        setStep('scan')
      } catch (enrollmentError) {
        setError(enrollmentError instanceof Error ? enrollmentError.message : 'Unable to set up two-factor authentication. Please try again.')
        setStep('error')
      }
    }

    startEnrollment()
  }, [])

  const handleVerify = async (code: string = otp) => {
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    setError('')

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })

    if (challengeError) {
      setError(challengeError.message)
      setIsVerifying(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      setError('Incorrect code. Please check your app and try again.')
      setIsVerifying(false)
      return
    }

    await redirectByProfile()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8"
        >
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-950 rounded-full">
              <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          {step === 'loading' && (
            <p className="text-center text-slate-600 dark:text-slate-300">Setting up secure access...</p>
          )}

          {step === 'error' && (
            <>
              <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-center text-red-500 text-sm">{error}</p>
            </>
          )}

          {(step === 'scan' || step === 'verify') && (
            <>
              <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
                {step === 'scan' ? 'Set Up Two-Factor Authentication' : 'Verify Two-Factor Authentication'}
              </h2>
              {step === 'scan' && <p className="text-center text-slate-600 dark:text-slate-300 mb-6 text-sm">
                Scan this QR code with Google Authenticator, Authy, or any TOTP app
              </p>}

              {step === 'scan' && qrCode && (
                <div className="flex justify-center mb-4 rounded-lg bg-white p-4">
                  <img src={qrSource} alt="Scan this QR code in your authenticator app" className="size-52" />
                </div>
              )}

              {step === 'scan' && <details className="mb-6">
                <summary className="text-xs text-center text-indigo-600 dark:text-indigo-400 cursor-pointer">
                  Can't scan? Enter code manually
                </summary>
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2 break-all font-mono">
                  {secret}
                </p>
              </details>}

              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 text-center">
                Enter the 6-digit code from your app to confirm
              </p>

              <div className="mb-4">
                <OTPInput length={6} value={otp} onChange={setOtp} onComplete={handleVerify} />
              </div>

              {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

              <button
                onClick={() => handleVerify()}
                disabled={isVerifying || otp.length !== 6}
                className="w-full px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isVerifying ? 'Verifying...' : 'Verify & Continue'}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
