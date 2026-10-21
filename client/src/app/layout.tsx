import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AegisGuard™ - Multi-Modal Biometric Face Authentication',
  description: 'Zero-Image Software Biometric Engine with Real-Time Liveness & AI Security Agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
