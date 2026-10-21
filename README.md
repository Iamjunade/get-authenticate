# AegisGuard™ - Cloud Multi-Modal Biometric Authentication

Enterprise-grade software-only biometric authentication platform featuring 3D facial mapping, AI Security Agent EVA voice guidance, zero raw image storage, and 1-click Vercel deployment.

## Features
- **Zero External Backend / Zero FastAPI**: Pure Next.js + Vercel Serverless Architecture.
- **1-Click Vercel Deployment**: Push directly to GitHub, connect to Vercel, and deploy instantly.
- **Built-in Vercel Storage**: Uses **Vercel KV (Redis)** or serverless vector store for 512-D cosine matching.
- **AI Security Agent EVA**: Real-time voice commands to keep head straight, with personalized voice welcome upon authentication.
- **GDPR & CCPA Compliant**: Zero human photos stored. Only mathematical vector arrays are preserved.

## Quickstart (Local Test)
Open `demo.html` in your browser or run:
```bash
npm run dev
```

## 1-Click Vercel Deployment
1. Push this entire project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/aegisguard-biometrics.git
   git push -u origin main
   ```
2. In [Vercel Dashboard](https://vercel.com):
   - Click **"Add New..." → "Project"**.
   - Select your repo and click **"Deploy"** (Vercel automatically detects Next.js).
3. *(Optional)* In your Vercel Project, go to **Storage → Create Database → KV** to enable persistent vector database across all global users.
