'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Building2, Users, Stethoscope, Dumbbell, UtensilsCrossed, MoreHorizontal, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const BUSINESS_TYPES = [
  { id: 'school', label: 'School ERP', icon: Users },
  { id: 'college', label: 'College/Institute ERP', icon: Building2 },
  { id: 'hospital', label: 'Hospital HIS', icon: Stethoscope },
  { id: 'gym', label: 'Gym Management', icon: Dumbbell },
  { id: 'restaurant', label: 'Restaurant POS', icon: UtensilsCrossed },
  { id: 'other', label: 'Other', icon: MoreHorizontal },
]

const PLANS = [
  { id: 'starter', name: 'Starter', price: '₹999', features: ['Up to 100 users', 'Basic features', 'Email support'] },
  { id: 'growth', name: 'Growth', price: '₹2,999', features: ['Up to 500 users', 'Advanced features', 'Priority support', 'Custom branding'], popular: true },
  { id: 'pro', name: 'Pro', price: '₹9,999', features: ['Unlimited users', 'All features', '24/7 support', 'API access', 'Custom integrations'] },
]

type FormData = {
  businessType: string
  businessName: string
  ownerName: string
  phone: string
  email: string
  city: string
  password: string
  confirmPassword: string
  plan: string
}

type FormErrors = Partial<Record<keyof FormData, string>>

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    businessType: '',
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    city: '',
    password: '',
    confirmPassword: '',
    plan: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const validateStep = (stepNum: number): boolean => {
    const newErrors: FormErrors = {}

    if (stepNum === 1) {
      if (!formData.businessType) newErrors.businessType = 'Please select a business type'
    } else if (stepNum === 2) {
      if (!formData.businessName?.trim()) newErrors.businessName = 'Business name is required'
      if (!formData.ownerName?.trim()) newErrors.ownerName = 'Owner name is required'
      if (!formData.phone?.trim()) newErrors.phone = 'Phone is required'
      if (!formData.email?.trim()) {
        newErrors.email = 'Email is required'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format'
      }
      if (!formData.city?.trim()) newErrors.city = 'City is required'
      if (!formData.password || formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    } else if (stepNum === 3) {
      if (!formData.plan) newErrors.plan = 'Please select a plan'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handlePrev = () => {
    setStep(step - 1)
    setErrors({})
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const generateSlug = (name: string) => {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const suffix = Math.random().toString(36).slice(2, 7)
    return `${base}-${suffix}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(3)) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      // 1. Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.ownerName },
        },
      })

      if (authError) throw authError
      if (!authData.user) {
        throw new Error('Signup succeeded but no session was returned. Check if "Confirm email" is enabled in Supabase — disable it for local testing.')
      }

      const userId = authData.user.id

      // 2. Create the tenant record
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: formData.businessName,
          vertical: formData.businessType,
          slug: generateSlug(formData.businessName),
          owner_id: userId,
          subscription_plan: formData.plan,
          status: 'trial',
        })
        .select()
        .single()

      if (tenantError) throw tenantError

      // 3. Create the profile record, linking user -> tenant, role = tenant_owner
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        tenant_id: tenant.id,
        role: 'tenant_owner',
        full_name: formData.ownerName,
        phone: formData.phone,
      })

      if (profileError) throw profileError

      router.push('/login')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const stepVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <motion.div
                key={s}
                className={`flex-1 h-1 mx-1 rounded-full ${
                  s <= step ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-slate-200 dark:bg-slate-700'
                }`}
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Step {step} of 3</p>
        </div>

        {/* Card Container */}
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={stepVariants}
          transition={{ duration: 0.3 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit}>
            {/* Step 1: Business Type Selection */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Choose Your Business Type</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-8">Select the industry that best fits your business</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {BUSINESS_TYPES.map((biz) => {
                    const Icon = biz.icon
                    return (
                      <motion.button
                        key={biz.id}
                        type="button"
                        onClick={() => handleInputChange('businessType', biz.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          formData.businessType === biz.id
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        <Icon className="w-8 h-8 mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{biz.label}</p>
                      </motion.button>
                    )
                  })}
                </div>

                {errors.businessType && (
                  <p className="text-red-500 text-sm mb-4">{errors.businessType}</p>
                )}
              </div>
            )}

            {/* Step 2: Business Details */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Business Details</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-8">Tell us about your business</p>

                <div className="space-y-4">
                  {[
                    { label: 'Business Name', field: 'businessName', placeholder: 'Enter business name' },
                    { label: 'Owner Name', field: 'ownerName', placeholder: 'Enter your full name' },
                    { label: 'Phone', field: 'phone', placeholder: 'Enter phone number', type: 'tel' },
                    { label: 'Email', field: 'email', placeholder: 'Enter email', type: 'email' },
                    { label: 'City', field: 'city', placeholder: 'Enter city name' },
                  ].map((input) => (
                    <div key={input.field}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {input.label}
                      </label>
                      <input
                        type={input.type || 'text'}
                        placeholder={input.placeholder}
                        value={formData[input.field as keyof FormData] as string}
                        onChange={(e) =>
                          handleInputChange(input.field as keyof FormData, e.target.value)
                        }
                        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${
                          errors[input.field as keyof FormData]
                            ? 'border-red-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      />
                      {errors[input.field as keyof FormData] && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors[input.field as keyof FormData]}
                        </p>
                      )}
                    </div>
                  ))}

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Password', field: 'password', type: 'password' },
                      { label: 'Confirm Password', field: 'confirmPassword', type: 'password' },
                    ].map((input) => (
                      <div key={input.field}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          {input.label}
                        </label>
                        <input
                          type={input.type}
                          placeholder={input.label.toLowerCase()}
                          value={formData[input.field as keyof FormData] as string}
                          onChange={(e) =>
                            handleInputChange(input.field as keyof FormData, e.target.value)
                          }
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-600 ${
                            errors[input.field as keyof FormData]
                              ? 'border-red-500'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        />
                        {errors[input.field as keyof FormData] && (
                          <p className="text-red-500 text-sm mt-1">
                            {errors[input.field as keyof FormData]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Plan Selection */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Choose Your Plan</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-8">Select the perfect plan for your business</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {PLANS.map((plan) => (
                    <motion.button
                      key={plan.id}
                      type="button"
                      onClick={() => handleInputChange('plan', plan.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                        formData.plan === plan.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                          Most Popular
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-4">
                        {plan.price}
                        <span className="text-sm text-slate-600 dark:text-slate-400">/month</span>
                      </p>
                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                            <Check className="w-4 h-4 text-green-500 mr-2" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </motion.button>
                  ))}
                </div>

                {errors.plan && (
                  <p className="text-red-500 text-sm mb-4">{errors.plan}</p>
                )}
              </div>
            )}

            {/* Submit error */}
            {submitError && (
              <p className="text-red-500 text-sm mt-4 text-center">{submitError}</p>
            )}

            {/* Buttons */}
            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Previous
                </button>
              )}
              <button
                type={step === 3 ? 'submit' : 'button'}
                onClick={step === 3 ? undefined : handleNext}
                disabled={(step === 3 && !formData.plan) || isSubmitting}
                className="flex-1 px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {step === 3 ? (isSubmitting ? 'Creating Account...' : 'Create Account') : 'Next'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Login Link */}
        <p className="text-center text-slate-600 dark:text-slate-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}
