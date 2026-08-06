'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const startEnrollment = async () => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/login')
        return
      }

      // If they already have a verified TOTP factor, no need to enroll again
      const { data: factors } = await supabase.auth.mfa.listFactors()
      if (factors?.totp && factors.totp.length > 0) {
        router.push('/dashboard')
        return
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      })

      if (enrollError) {
        setError(enrollError.message)
        setStep('error')
        return
      }

      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep('scan')
    }

    startEnrollment()
  }, [])

  const handleVerify = async () => {
    if (otp.length !== 6) {
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
      code: otp,
    })

    if (verifyError) {
      setError('Incorrect code. Please check your app and try again.')
      setIsVerifying(false)
      return
    }

    router.push('/dashboard')
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

          {step === 'scan' && (
            <>
              <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
                Set Up Two-Factor Authentication
              </h2>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-6 text-sm">
                Scan this QR code with Google Authenticator, Authy, or any TOTP app
              </p>

              <div
                className="flex justify-center mb-4 bg-white p-4 rounded-lg"
                dangerouslySetInnerHTML={{ __html: qrCode }}
              />

              <details className="mb-6">
                <summary className="text-xs text-center text-indigo-600 dark:text-indigo-400 cursor-pointer">
                  Can't scan? Enter code manually
                </summary>
                <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-2 break-all font-mono">
                  {secret}
                </p>
              </details>

              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 text-center">
                Enter the 6-digit code from your app to confirm
              </p>

              <div className="mb-4">
                <OTPInput length={6} value={otp} onChange={setOtp} onComplete={() => {}} />
              </div>

              {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

              <button
                onClick={handleVerify}
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
