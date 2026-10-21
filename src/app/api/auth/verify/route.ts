import { NextResponse } from 'next/server';
import { matchVector1toN } from '@/lib/vectorStore';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const start = performance.now();
  try {
    const body = await request.json();
    const { live_vector, threshold = 0.90 } = body;

    if (!live_vector || !Array.isArray(live_vector)) {
      return NextResponse.json(
        { error: 'Live face vector array is required.' },
        { status: 400 }
      );
    }

    const { bestMatch, score } = await matchVector1toN(live_vector, threshold);
    const latencyMs = Math.round(performance.now() - start);

    if (bestMatch && score >= threshold) {
      return NextResponse.json({
        status: 'SUCCESS',
        user: bestMatch,
        confidence_score: score,
        latency_ms: latencyMs,
        liveness_verified: true,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      status: 'REJECTED',
      user: null,
      confidence_score: score,
      latency_ms: latencyMs,
      message: `Access denied. Confidence score ${(score * 100).toFixed(1)}% did not meet required threshold.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
  }
}
