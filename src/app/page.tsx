'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Instant redirect to the full biometric engine
    window.location.replace('/demo.html');
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white space-y-4 font-mono">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-cyan-400 tracking-wider">INITIALIZING AEGIS-GUARD™ BIOMETRIC ENGINE...</p>
    </div>
  );
}
