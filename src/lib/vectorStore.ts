/**
 * Vercel Serverless Vector Store & Cosine Matcher
 * Uses Vercel KV (Upstash Redis) if available, with in-memory fallback.
 * Zero external servers required!
 */

export interface StoredBiometricProfile {
  id: string;
  name: string;
  email: string;
  department: string;
  clearance: string;
  vector: number[];
  vectorId: string;
  enrolledAt: string;
}

// In-memory fallback cache for serverless invocation
let memoryVectorStore: StoredBiometricProfile[] = [];

/**
 * Calculates Cosine Similarity between two numerical unit vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dot / denominator : 0;
}

/**
 * Fetches all registered biometric vector profiles
 */
export async function getAllProfiles(): Promise<StoredBiometricProfile[]> {
  // Check if Vercel KV is configured (auto-injected by Vercel Dashboard)
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/biometric_users`, {
        headers: { Authorization: `Bearer ${kvToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data && data.result) {
        return typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
      }
    } catch (err) {
      console.warn("Vercel KV fetch error, using memory fallback:", err);
    }
  }

  return memoryVectorStore;
}

/**
 * Saves a new biometric profile into Vercel Storage
 */
export async function saveProfile(profile: StoredBiometricProfile): Promise<void> {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  // Update in-memory
  memoryVectorStore.push(profile);

  if (kvUrl && kvToken) {
    try {
      const all = await getAllProfiles();
      const updated = [...all.filter(p => p.id !== profile.id), profile];
      await fetch(`${kvUrl}/set/biometric_users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kvToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.warn("Vercel KV write error:", err);
    }
  }
}

/**
 * Performs 1:N vector search across all profiles
 */
export async function matchVector1toN(
  liveVector: number[],
  threshold = 0.90
): Promise<{ bestMatch: StoredBiometricProfile | null; score: number }> {
  const profiles = await getAllProfiles();
  let bestMatch: StoredBiometricProfile | null = null;
  let highestScore = -1;

  for (const profile of profiles) {
    const score = cosineSimilarity(liveVector, profile.vector);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = profile;
    }
  }

  return {
    bestMatch: highestScore >= threshold ? bestMatch : null,
    score: highestScore,
  };
}
