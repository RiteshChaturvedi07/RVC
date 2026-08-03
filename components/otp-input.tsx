'use client'

import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
}

export function OTPInput({ length = 6, value, onChange, onComplete }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return
    if (digit.length > 1) {
      // Handle paste
      const pastedValue = digit.slice(0, length - index).replace(/\D/g, '')
      const newValue = localValue.slice(0, index) + pastedValue + localValue.slice(index + pastedValue.length)
      const trimmedValue = newValue.slice(0, length)
      setLocalValue(trimmedValue)
      onChange(trimmedValue)
      
      // Auto-focus last filled input
      const nextIndex = Math.min(index + pastedValue.length, length - 1)
      inputRefs.current[nextIndex]?.focus()
      
      if (trimmedValue.length === length) {
        onComplete?.(trimmedValue)
      }
      return
    }

    const newValue = localValue.slice(0, index) + digit + localValue.slice(index + 1)
    setLocalValue(newValue)
    onChange(newValue)

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Call onComplete when all digits are filled
    if (newValue.length === length && newValue === newValue.replace(/./g, (c) => c !== '' ? '.' : '')) {
      onComplete?.(newValue)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (localValue[index]) {
        const newValue = localValue.slice(0, index) + '' + localValue.slice(index + 1)
        setLocalValue(newValue)
        onChange(newValue)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length }).map((_, index) => (
        <motion.input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={localValue[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          initial={{ scale: 1 }}
          whileFocus={{ scale: 1.05, boxShadow: '0 0 0 3px rgba(67, 56, 202, 0.1)' }}
          className="w-12 h-12 text-center text-2xl font-semibold border-2 border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 transition-colors"
        />
      ))}
    </div>
  )
}
