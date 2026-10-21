'use client';

import dynamic from 'next/dynamic';

// Dynamic import with SSR disabled for browser webcam and WebRTC compatibility
const BiometricScanner = dynamic(
  () => import('../components/BiometricScanner').then((mod) => mod.BiometricScanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-mono text-cyan-400">Loading AegisGuard Biometric Engine...</p>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            AEGIS-GUARD™
          </h1>
          <p className="text-xs text-slate-400">Cloud Multi-Modal Biometric Authentication</p>
        </div>
        <span className="text-xs font-mono px-3 py-1 bg-cyan-950 text-cyan-400 rounded-full border border-cyan-800">
          Vercel Production Ready
        </span>
      </header>

      <BiometricScanner />
    </main>
  );
}
