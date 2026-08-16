'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[App Error Boundary] Caught unhandled runtime UI crash:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white">
          <div className="max-w-md rounded-3xl border border-red-500/20 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-lg">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400">
              <AlertTriangle className="size-8 animate-pulse" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Something went wrong</h2>
            <p className="mt-2 text-sm text-slate-400">
              {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
            </p>

            <button
              onClick={this.handleReset}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              <RefreshCw className="size-4" />
              Reload Workspace
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
