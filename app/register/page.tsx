'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  UtensilsCrossed,
  Dumbbell,
  GraduationCap,
  Stethoscope,
  Building2,
  MoreHorizontal,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Eye,
  EyeOff,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  X,
  Zap,
  PartyPopper,
  Gift,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

// --- Indian States & Dynamic Cities Dictionary ---
const INDIA_LOCATION_DATA: Record<string, string[]> = {
  Chhattisgarh: ['Raipur', 'Bilaspur', 'Ambikapur', 'Durg-Bhilai', 'Korba', 'Jagdalpur', 'Rajnandgaon', 'Custom / Other'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane', 'Solapur', 'Custom / Other'],
  'Madhya Pradesh': ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur', 'Ujjain', 'Satna', 'Custom / Other'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi', 'Custom / Other'],
  'Delhi NCR': ['New Delhi', 'Gurgaon', 'Noida', 'Faridabad', 'Ghaziabad', 'Custom / Other'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Custom / Other'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Noida', 'Prayagraj', 'Custom / Other'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Custom / Other'],
  'West Bengal': ['Kolkata', 'Siliguri', 'Durgapur', 'Asansol', 'Custom / Other'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer', 'Custom / Other'],
  Other: ['Custom / Other'],
}

// --- Vertical Types ---
const VERTICALS = [
  {
    id: 'restaurant',
    name: 'Restaurant POS & Digital OS',
    status: 'LIVE NOW 🟢',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: UtensilsCrossed,
    isLive: true,
    highlights: ['QR Table Ordering', 'Live Kitchen KDS', '0% Commission', 'Direct UPI Payouts'],
  },
  {
    id: 'gym',
    name: 'Gym & Fitness OS',
    status: 'Early Access ⚡',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Dumbbell,
    isLive: false,
    highlights: ['WhatsApp Expiry Links', 'Biometric Gate Sync', 'Trainer Slots'],
  },
  {
    id: 'school',
    name: 'School & College ERP',
    status: 'Coming Soon 🚀',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    icon: GraduationCap,
    isLive: false,
    highlights: ['Attendance SMS', 'Fee Gateway', 'Report Cards'],
  },
  {
    id: 'hospital',
    name: 'Hospital & Clinic HIS',
    status: 'Coming Soon 🚀',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    icon: Stethoscope,
    isLive: false,
    highlights: ['OPD Token Queue', 'Digital Prescriptions', 'Pharmacy Billing'],
  },
  {
    id: 'crm',
    name: 'Real Estate & Service CRM',
    status: 'Coming Soon 🚀',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: Building2,
    isLive: false,
    highlights: ['Lead Pipeline', 'Follow-up Alerts', 'Commission Track'],
  },
  {
    id: 'other',
    name: 'Other Business',
    status: 'Beta Waitlist ⚡',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    icon: MoreHorizontal,
    isLive: false,
    highlights: ['Custom ERP Specs', 'Priority Onboarding'],
  },
]

type SaaSPlan = {
  id: string
  name: string
  slug?: string
  target_vertical?: string
  billing_interval?: string
  price_monthly: number
  price_quarterly?: number
  price_yearly: number
  promotional_perk?: string | null
  onboarding_offer_type?: 'trial_7_day' | 'promotional_bundle' | 'direct_paid' | 'free_tier'
  badge_text?: string | null
  features: string[]
  is_popular?: boolean
}

const FALLBACK_PLANS: SaaSPlan[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Starter Restaurant OS',
    target_vertical: 'restaurant',
    price_monthly: 999,
    price_quarterly: 2499,
    price_yearly: 9588,
    promotional_perk: 'Get 5 Free QR Table Acrylic Stickers',
    onboarding_offer_type: 'trial_7_day',
    badge_text: 'Popular Choice',
    features: ['Up to 15 Tables', 'Sub-second QR Ordering', 'Live Kitchen KDS', 'Direct UPI Payments', 'Standard Analytics'],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Growth 3-Month Promo Bundle',
    target_vertical: 'restaurant',
    price_monthly: 1999,
    price_quarterly: 4999,
    price_yearly: 19190,
    promotional_perk: 'Get 10 Free QR Acrylic Stands + Free AI Menu Digitization',
    onboarding_offer_type: 'promotional_bundle',
    badge_text: '🎁 3-Month Free Gift Bundle',
    is_popular: true,
    features: ['Unlimited Tables', '10 Free Acrylic Stands Included', 'Multi-Captain KDS Displays', 'WhatsApp Marketing Automation', 'Inventory & Ingredient Track', 'Priority 24/7 Support'],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Multi-Outlet Pro Enterprise',
    target_vertical: 'restaurant',
    price_monthly: 3999,
    price_quarterly: 9999,
    price_yearly: 38390,
    promotional_perk: 'Get 25 Free QR Acrylic Stands + Dedicated Onboarding Manager',
    onboarding_offer_type: 'trial_7_day',
    badge_text: 'Enterprise',
    features: ['Multi-Branch Central Hub', '25 Free Acrylic Stands Included', 'Custom Domain Integration', 'Advanced Audit & Staff Roles', 'Dedicated Account Manager'],
  },
]

function formatErrorMessage(err: unknown): string {
  if (!err) return 'Registration failed. Please try again.'
  let rawMsg = ''
  if (typeof err === 'string') rawMsg = err.trim()
  else if (err instanceof Error && err.message) rawMsg = err.message
  else if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') rawMsg = obj.message
    else if (typeof obj.error_description === 'string') rawMsg = obj.error_description
    else if (typeof obj.error === 'string') rawMsg = obj.error
    else if (typeof obj.msg === 'string') rawMsg = obj.msg
    else if (typeof obj.details === 'string') rawMsg = obj.details
    else {
      try {
        const jsonStr = JSON.stringify(err)
        if (jsonStr && jsonStr !== '{}') rawMsg = jsonStr
      } catch {
        rawMsg = ''
      }
    }
  }

  rawMsg = rawMsg.trim()
  if (!rawMsg || rawMsg === '{}' || rawMsg === '[object Object]') {
    return 'Registration failed. Please check your credentials or select another plan tier.'
  }
  return rawMsg
}

type FormDataState = {
  vertical: string
  businessName: string
  ownerName: string
  phone: string
  email: string
  state: string
  city: string
  customCity: string
  password: string
  confirmPassword: string
  planId: string
  billingCycle: 'monthly' | 'quarterly' | 'yearly'
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  // --- States ---
  const [step, setStep] = useState(1)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [plans, setPlans] = useState<SaaSPlan[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Waitlist Modal State
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false)
  const [waitlistVerticalName, setWaitlistVerticalName] = useState('')
  const [waitlistInput, setWaitlistInput] = useState('')
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false)

  // Form Data
  const [formData, setFormData] = useState<FormDataState>({
    vertical: 'restaurant',
    businessName: '',
    ownerName: '',
    phone: '',
    email: '',
    state: 'Chhattisgarh',
    city: 'Raipur',
    customCity: '',
    password: '',
    confirmPassword: '',
    planId: '00000000-0000-0000-0000-000000000002',
    billingCycle: 'quarterly',
  })

  // Errors state
  const [errors, setErrors] = useState<Partial<Record<keyof FormDataState, string>>>({})

  // Fetch Live SaaS Plans from Supabase (RPC first, then table query)
  useEffect(() => {
    async function fetchPlans() {
      setLoadingPlans(true)
      try {
        let rawPlans: any[] | null = null

        // 1. Try RPC function (SECURITY DEFINER)
        const { data: rpcData } = await supabase.rpc('get_active_saas_plans')
        if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          rawPlans = rpcData
        }

        // 2. Fallback to table SELECT query
        if (!rawPlans || rawPlans.length === 0) {
          const { data: tableData } = await supabase
            .from('saas_plans')
            .select('*')
            .order('price_monthly', { ascending: true })
          if (tableData && Array.isArray(tableData) && tableData.length > 0) {
            rawPlans = tableData.filter((p: any) => p.is_active !== false)
          }
        }

        if (rawPlans && rawPlans.length > 0) {
          const formattedPlans: SaaSPlan[] = rawPlans.map((p: any) => {
            let parsedFeatures: string[] = []
            if (Array.isArray(p.features)) {
              parsedFeatures = p.features.map(String)
            } else if (typeof p.features === 'string') {
              try {
                const parsed = JSON.parse(p.features)
                if (Array.isArray(parsed)) parsedFeatures = parsed.map(String)
                else if (typeof parsed === 'object' && parsed !== null) parsedFeatures = Object.values(parsed).map(String)
                else parsedFeatures = [p.features]
              } catch {
                parsedFeatures = [p.features]
              }
            } else if (typeof p.features === 'object' && p.features !== null) {
              parsedFeatures = Object.values(p.features).map(String)
            }

            const monthlyPrice = Number(p.price_monthly || 0)
            const quarterlyPrice = Number(p.price_quarterly || Math.round(monthlyPrice * 2.7))
            const yearlyPrice = Number(p.price_yearly || monthlyPrice * 10)

            return {
              id: String(p.id),
              name: String(p.name || 'SaaS Plan'),
              slug: p.slug ? String(p.slug) : undefined,
              target_vertical: p.target_vertical ? String(p.target_vertical) : 'restaurant',
              billing_interval: p.billing_interval ? String(p.billing_interval) : 'monthly',
              price_monthly: monthlyPrice,
              price_quarterly: quarterlyPrice,
              price_yearly: yearlyPrice,
              promotional_perk: p.promotional_perk ? String(p.promotional_perk) : null,
              onboarding_offer_type: p.onboarding_offer_type || 'trial_7_day',
              badge_text: p.badge_text ? String(p.badge_text) : null,
              features: parsedFeatures.length > 0 ? parsedFeatures : ['All core features included'],
              is_popular: Boolean(p.is_popular),
            }
          })
          setPlans(formattedPlans)
          const popular = formattedPlans.find((p) => p.is_popular) || formattedPlans[0]
          if (popular) setFormData((prev) => ({ ...prev, planId: popular.id }))
        } else {
          setPlans(FALLBACK_PLANS)
        }
      } catch {
        setPlans(FALLBACK_PLANS)
      } finally {
        setLoadingPlans(false)
      }
    }
    void fetchPlans()
  }, [])

  // Filter plans based on target vertical domain selected in Step 1
  const domainFilteredPlans = useMemo(() => {
    const matched = plans.filter((p) => (p.target_vertical || 'restaurant').toLowerCase() === formData.vertical.toLowerCase())
    return matched.length > 0 ? matched : plans
  }, [plans, formData.vertical])

  // City options based on state selection
  const cityOptions = useMemo(() => {
    return INDIA_LOCATION_DATA[formData.state] || INDIA_LOCATION_DATA['Other']
  }, [formData.state])

  // --- Strict Input Sanitizers ---
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/[^0-9]/g, '')
    if (rawVal.length <= 10) {
      setFormData((prev) => ({ ...prev, phone: rawVal }))
      if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
    }
  }

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))
    ) {
      return
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault()
    }
  }

  // --- Password Strength Evaluator ---
  const passwordChecks = useMemo(() => {
    const p = formData.password
    return {
      length: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      number: /[0-9]/.test(p),
      special: /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
    }
  }, [formData.password])

  const passwordScore = useMemo(() => {
    return Object.values(passwordChecks).filter(Boolean).length
  }, [passwordChecks])

  const passwordStrengthLabel = useMemo(() => {
    if (!formData.password) return { label: 'None', color: 'bg-slate-300 dark:bg-slate-700 text-slate-400' }
    if (passwordScore <= 1) return { label: 'Weak ⚠️', color: 'bg-rose-500 text-white' }
    if (passwordScore === 2) return { label: 'Medium 🟡', color: 'bg-amber-500 text-white' }
    if (passwordScore === 3) return { label: 'Strong 🟢', color: 'bg-indigo-500 text-white' }
    return { label: 'Bulletproof 🔥', color: 'bg-emerald-500 text-white' }
  }, [formData.password, passwordScore])

  // --- Step Validation ---
  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<Record<keyof FormDataState, string>> = {}

    if (currentStep === 1) {
      if (!formData.vertical) newErrors.vertical = 'Please select a business vertical'
    } else if (currentStep === 2) {
      if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required'
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required'
      if (!formData.phone.trim() || formData.phone.length !== 10) {
        newErrors.phone = 'Enter a valid 10-digit mobile number'
      }
      if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Enter a valid email address'
      }
      if (!formData.state) newErrors.state = 'Please select a state'
      if (!formData.city) newErrors.city = 'Please select a city'
      if (formData.city === 'Custom / Other' && !formData.customCity.trim()) {
        newErrors.customCity = 'Specify your city name'
      }

      if (passwordScore < 4) {
        newErrors.password = 'Password does not meet enterprise security requirements'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    } else if (currentStep === 3) {
      if (!formData.planId) newErrors.planId = 'Please select a plan'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(3, prev + 1))
    }
  }

  const handlePrev = () => {
    setStep((prev) => Math.max(1, prev - 1))
    setErrors({})
  }

  // --- Waitlist Handler ---
  const handleVerticalSelect = (vertical: (typeof VERTICALS)[0]) => {
    if (vertical.isLive) {
      setFormData((prev) => ({ ...prev, vertical: vertical.id }))
      setStep(2)
    } else {
      setWaitlistVerticalName(vertical.name)
      setWaitlistModalOpen(true)
    }
  }

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!waitlistInput.trim()) {
      toast.error('Please enter your email or mobile number')
      return
    }
    setSubmittingWaitlist(true)
    setTimeout(() => {
      setSubmittingWaitlist(false)
      toast.success(`🎉 You're registered for ${waitlistVerticalName} early access! We will notify you first.`)
      setWaitlistModalOpen(false)
      setWaitlistInput('')
    }, 500)
  }

  // --- Account Registration Submission ---
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep(3)) return

    setIsSubmitting(true)
    setSubmitError('')

    const finalCity = formData.city === 'Custom / Other' ? formData.customCity : formData.city
    const selectedPlan = plans.find((p) => p.id === formData.planId) || domainFilteredPlans[0]

    // Validate if planId is a valid UUID that exists in database saas_plans table
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.planId)
    const planExistsInDb = plans.some((p) => p.id === formData.planId)
    const validPlanIdUuid = isUuid && planExistsInDb ? formData.planId : null

    const offerType = selectedPlan?.onboarding_offer_type || 'trial_7_day'
    const isTrial = offerType === 'trial_7_day'
    const trialDays = isTrial ? 7 : 0
    const subStatus = isTrial ? 'trial' : 'active'

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/login?email_confirmed=1`,
          data: {
            full_name: formData.ownerName.trim(),
            phone: `+91${formData.phone.trim()}`,
            business_name: formData.businessName.trim(),
            business_type: formData.vertical,
            plan: selectedPlan?.slug || formData.planId,
            plan_id: validPlanIdUuid,
            plan_billing_cycle: formData.billingCycle,
            onboarding_offer_type: offerType,
            promotional_perk: selectedPlan?.promotional_perk || null,
            state: formData.state,
            city: finalCity,
            trial_period: trialDays,
            subscription_status: subStatus,
          },
        },
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Account initialized, but session failed. Please log in.')
      }

      if (offerType === 'promotional_bundle') {
        toast.success(`Welcome to RVC! Your 3-month promo bundle with free gift perks is active.`)
      } else if (isTrial) {
        toast.success('Welcome to RVC! Your 7-day free trial is live.')
      } else {
        toast.success('Welcome to RVC! Your business workspace is ready.')
      }

      router.push('/restaurant-dashboard')
    } catch (err: unknown) {
      const errorMessage = formatErrorMessage(err)
      setSubmitError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      
      {/* Background Glow Overlay */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[650px] h-[450px] bg-gradient-to-tr from-indigo-600/15 via-purple-600/10 to-emerald-500/15 rounded-full blur-3xl opacity-60" />
      </div>

      <div className="w-full max-w-3xl space-y-6">
        
        {/* Top Header & Brand Link */}
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
                Multi-Domain OS
              </span>
            </div>
          </Link>

          <Link href="/login" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            Already registered? Log in →
          </Link>
        </div>

        {/* Dynamic 3-Step Stepper Header */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-4 shadow-sm flex items-center justify-between text-xs font-bold font-mono">
          {[
            { num: 1, title: 'Business Domain' },
            { num: 2, title: 'Credentials' },
            { num: 3, title: 'SaaS Plan & Perks' },
          ].map((s, idx) => {
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}>
                  {s.title}
                </span>
                {idx < 2 && <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">---</span>}
              </div>
            )
          })}
        </div>

        {/* Main Card Container */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0d1322]/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6"
        >
          <form onSubmit={handleRegisterSubmit}>
            
            {/* ================= STEP 1: BUSINESS VERTICAL SELECTOR ================= */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Step 1 of 3
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Select Your Business Vertical
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Choose the operational engine suited for your store or establishment.
                  </p>
                </div>

                {/* Vertical Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {VERTICALS.map((vert) => {
                    const Icon = vert.icon
                    const isSelected = formData.vertical === vert.id
                    return (
                      <button
                        key={vert.id}
                        type="button"
                        onClick={() => handleVerticalSelect(vert)}
                        className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.01] ${
                          vert.isLive
                            ? isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
                              : 'border-emerald-500/40 bg-white dark:bg-slate-900/90 hover:border-emerald-500'
                            : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 hover:border-indigo-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`p-2.5 rounded-xl border ${vert.badgeColor}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${vert.badgeColor}`}>
                            {vert.status}
                          </span>
                        </div>

                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-2">
                          {vert.name}
                        </h3>

                        <div className="space-y-1">
                          {vert.highlights.map((h) => (
                            <div key={h} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-emerald-500" />
                              {h}
                            </div>
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {errors.vertical && <p className="text-red-500 text-xs font-semibold">{errors.vertical}</p>}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    Continue to Business Details <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 2: BUSINESS & CREDENTIAL DETAILS ================= */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <User className="w-3.5 h-3.5" />
                    Step 2 of 3
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Business & Account Credentials
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Provide store identity, owner contact, and secure enterprise password.
                  </p>
                </div>

                <div className="space-y-4 text-xs sm:text-sm">
                  
                  {/* Business Name & Owner Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Restaurant / Business Name *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) => setFormData((p) => ({ ...p, businessName: e.target.value }))}
                          placeholder="e.g. Royal Spice Cafe"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {errors.businessName && <p className="text-red-500 text-[11px] mt-1">{errors.businessName}</p>}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Owner / Captain Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          required
                          value={formData.ownerName}
                          onChange={(e) => setFormData((p) => ({ ...p, ownerName: e.target.value }))}
                          placeholder="e.g. Ritesh Chaturvedi"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {errors.ownerName && <p className="text-red-500 text-[11px] mt-1">{errors.ownerName}</p>}
                    </div>
                  </div>

                  {/* Phone (Masked +91) & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number (+91 Strict Mask) *
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 text-xs font-mono font-bold text-slate-500 select-none">
                          +91
                        </span>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          onKeyDown={handlePhoneKeyDown}
                          maxLength={10}
                          placeholder="9876543210"
                          className="w-full pl-12 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {errors.phone && <p className="text-red-500 text-[11px] mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                          placeholder="owner@royalspice.com"
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  {/* 2-Tier State & Linked City Dropdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        State / UT *
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <select
                          value={formData.state}
                          onChange={(e) => {
                            const nextState = e.target.value
                            const nextCities = INDIA_LOCATION_DATA[nextState] || INDIA_LOCATION_DATA['Other']
                            setFormData((p) => ({ ...p, state: nextState, city: nextCities[0] }))
                          }}
                          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {Object.keys(INDIA_LOCATION_DATA).map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        City / Hub *
                      </label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {cityOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Custom City Text input if Custom selected */}
                  {formData.city === 'Custom / Other' && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Specify Your City / Town Name *
                      </label>
                      <input
                        type="text"
                        value={formData.customCity}
                        onChange={(e) => setFormData((p) => ({ ...p, customCity: e.target.value }))}
                        placeholder="e.g. Korba / Dhamtari"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {errors.customCity && <p className="text-red-500 text-[11px] mt-1">{errors.customCity}</p>}
                    </div>
                  )}

                  {/* Enterprise Password Validation Section */}
                  <div className="pt-2 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Password input */}
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Password *
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                            placeholder="Enter password..."
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

                      {/* Confirm Password input */}
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Confirm Password *
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData((p) => ({ ...p, confirmPassword: e.target.value }))}
                            placeholder="Confirm password..."
                            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {formData.confirmPassword && (
                          <div className="mt-1">
                            {formData.password === formData.confirmPassword ? (
                              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Passwords match
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-rose-500">Passwords do not match</span>
                            )}
                          </div>
                        )}
                        {errors.confirmPassword && <p className="text-red-500 text-[11px] mt-1">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    {/* Animated Strength Meter */}
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
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-7 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    Proceed to SaaS Plan & Perks <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ================= STEP 3: SAAS PLAN & OFFER BUNDLE ACTIVATION ================= */}
            {step === 3 && (
              <div className="space-y-6">
                
                {/* Step 3 Header */}
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <PartyPopper className="w-3.5 h-3.5" />
                    Step 3 of 3 • Offer Bundle Activation
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                    Select SaaS Plan & Activate Registration Offer
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Choose your operating tier. Enjoy 3-month promotional bundle perks or a 7-day free trial.
                  </p>
                </div>

                {/* Animated Celebration Banner */}
                <div className="bg-gradient-to-r from-emerald-500/15 via-purple-500/15 to-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 rounded-2xl p-4 text-center font-semibold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 animate-pulse" />
                  <span>
                    🎉 <strong>Exclusive Onboarding Offer Active:</strong> Includes Free QR Stands + 0% Commission UPI Payments
                  </span>
                </div>

                {/* Billing Cycle Toggle */}
                <div className="flex items-center justify-center gap-2 p-1.5 rounded-2xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 w-fit mx-auto text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, billingCycle: 'monthly' }))}
                    className={`px-4 py-2 rounded-xl transition-all ${
                      formData.billingCycle === 'monthly'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Monthly (1 Mo)
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, billingCycle: 'quarterly' }))}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                      formData.billingCycle === 'quarterly'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Quarterly (3-Mo Bundle)</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500 text-white text-[10px] font-extrabold animate-pulse">
                      🎁 Free Perks
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, billingCycle: 'yearly' }))}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                      formData.billingCycle === 'yearly'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Yearly (12 Mo)</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-extrabold">
                      Save ~20%
                    </span>
                  </button>
                </div>

                {/* Dynamic Live Plans Grid */}
                {loadingPlans ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-8">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800/60 animate-pulse p-4" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {domainFilteredPlans.map((plan) => {
                      const isSelected = formData.planId === plan.id
                      const quarterlyPrice = Number(plan.price_quarterly || Math.round(plan.price_monthly * 2.7))
                      
                      const displayPrice =
                        formData.billingCycle === 'yearly'
                          ? Math.round(plan.price_yearly / 12)
                          : formData.billingCycle === 'quarterly'
                          ? Math.round(quarterlyPrice / 3)
                          : plan.price_monthly

                      const offerType = plan.onboarding_offer_type || 'trial_7_day'

                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, planId: plan.id }))}
                          className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-xl shadow-emerald-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:border-emerald-500/40'
                          }`}
                        >
                          {plan.is_popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 text-white text-[10px] font-extrabold shadow-md whitespace-nowrap">
                              ⭐ Recommended Plan
                            </div>
                          )}

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-1">
                                {plan.name}
                              </h3>
                            </div>

                            {/* Offer Badge Pill */}
                            <div className="mb-2">
                              {offerType === 'trial_7_day' && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                                  🟢 7-Day Free Trial Included
                                </span>
                              )}
                              {offerType === 'promotional_bundle' && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300 text-[10px] font-bold border border-purple-500/30">
                                  🎁 3-Month Bundle + Free Perks
                                </span>
                              )}
                              {offerType === 'direct_paid' && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/30">
                                  ⚡ Instant Paid Activation
                                </span>
                              )}
                              {offerType === 'free_tier' && (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30">
                                  ✨ Permanent Free Tier
                                </span>
                              )}
                            </div>

                            {/* Price display */}
                            <div className="my-2">
                              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                                ₹{displayPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs text-slate-500"> /mo</span>
                              {formData.billingCycle === 'quarterly' && (
                                <div className="text-[10px] text-purple-400 font-semibold mt-0.5">
                                  Billed quarterly (₹{quarterlyPrice.toLocaleString('en-IN')}/3 mo)
                                </div>
                              )}
                              {formData.billingCycle === 'yearly' && (
                                <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                                  Billed annually (₹{plan.price_yearly.toLocaleString('en-IN')}/yr)
                                </div>
                              )}
                            </div>

                            {/* Free Promotional Gift Box */}
                            {plan.promotional_perk && (
                              <div className="my-2.5 p-2.5 rounded-xl border border-purple-500/40 bg-purple-500/10 text-[11px] font-semibold text-purple-300 flex items-start gap-1.5">
                                <Gift className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-purple-400 block">Free Gift Included:</span>
                                  <span>{plan.promotional_perk}</span>
                                </div>
                              </div>
                            )}

                            {/* Entitlements Checklist */}
                            <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-3">
                              {plan.features.map((f, i) => (
                                <li key={i} className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div
                            className={`mt-5 py-2 text-center rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isSelected ? 'Selected Plan ✓' : 'Select This Plan'}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {submitError && (
                  <p className="text-rose-500 text-xs font-bold text-center p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    {submitError}
                  </p>
                )}

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-600/30 hover:scale-[1.02] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        'Activating Business Workspace...'
                      ) : (
                        <>
                          <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                          🚀 Activate Plan & Launch Workspace →
                        </>
                      )}
                    </button>
                  </div>

                  {/* Reassurance Footer Note */}
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Instant Workspace Provisioning • Full Access to QR Orders & Live KDS • 24/7 Support</span>
                  </p>
                </div>
              </div>
            )}

          </form>
        </motion.div>
      </div>

      {/* Early Access Waitlist Modal */}
      <AnimatePresence>
        {waitlistModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-2xl space-y-4"
            >
              <button
                type="button"
                onClick={() => setWaitlistModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Join Beta Waitlist: {waitlistVerticalName}
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {waitlistVerticalName} is currently in closed early access testing. Submit your details to lock priority onboarding and 3 months free trial upon release.
              </p>

              <form onSubmit={handleWaitlistSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistInput}
                    onChange={(e) => setWaitlistInput(e.target.value)}
                    placeholder="name@business.com or +91 9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingWaitlist}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  {submittingWaitlist ? 'Registering...' : '⚡ Lock Priority Early Access'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
