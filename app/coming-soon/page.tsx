import Link from 'next/link'

export default function ComingSoonPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><section className="max-w-lg"><p className="text-sm font-semibold uppercase tracking-[.2em] text-amber-400">RVC Platform</p><h1 className="mt-4 text-4xl font-bold">This product is coming soon.</h1><p className="mt-4 leading-7 text-slate-300">RVC is currently onboarding restaurants. School, hospital, gym, and other business modules will open after their dedicated workflows are ready.</p><Link href="/" className="mt-8 inline-block rounded-xl bg-amber-500 px-5 py-3 font-semibold text-slate-950">Back to RVC</Link></section></main>
}
