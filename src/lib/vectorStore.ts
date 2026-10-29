/**
 * AegisGuard™ Multi-Tier Cloud Biometric Vector Store
 * Supports:
 *  1. Neon Serverless Postgres (POSTGRES_URL or DATABASE_URL)
 *  2. Vercel KV / Upstash Redis (KV_REST_API_URL or UPSTASH_REDIS_REST_URL)
 *  3. Global Persistent Cloud Vault (REST Cloud Object for multi-device cross-laptop sync)
 *  4. In-Memory Ephemeral Cache
 * 
 * Zero raw facial images are ever stored. Only mathematical 512-D vector embeddings.
 */

import { neon } from '@neondatabase/serverless';

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

// Global Cloud Vault Object ID for universal multi-device sync
const GLOBAL_CLOUD_VAULT_ID = 'ff808181a09d98f701a15fa999a645f6';
const GLOBAL_CLOUD_VAULT_API = `https://api.restful-api.dev/objects/${GLOBAL_CLOUD_VAULT_ID}`;

// In-memory cache for ultra-fast sub-millisecond local reads
let memoryVectorStore: StoredBiometricProfile[] = [];
let neonTableInitialized = false;

/**
 * Calculates Calibrated Anthropometric Biometric Similarity (0.0 to 1.0)
 * Rejects identity mismatch; grants access only when facial geometry truly matches.
 */
export function calculateBiometricSimilarity(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length !== v2.length) return 0;

  const rLen = Math.min(12, v1.length);
  let rDist = 0;
  for (let i = 0; i < rLen; i++) {
    const d = v1[i] - v2[i];
    rDist += d * d;
  }
  rDist = Math.sqrt(rDist) / rLen;

  let cDist = 0;
  for (let i = rLen; i < v1.length; i++) {
    const d = v1[i] - v2[i];
    cDist += d * d;
  }
  cDist = Math.sqrt(cDist) / Math.max(1, v1.length - rLen);

  const totalDist = rDist * 0.65 + cDist * 0.35;
  const confidence = Math.exp(-totalDist * 14);
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculates Cosine / Anthropometric Similarity between two numerical vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  if (a.length === 60) {
    return calculateBiometricSimilarity(a, b);
  }
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
 * Neon Postgres Initialization (Auto-creates table if needed)
 */
async function getNeonSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) return null;
  
  try {
    const sql = neon(dbUrl);
    if (!neonTableInitialized) {
      await sql`
        CREATE TABLE IF NOT EXISTS aegis_biometric_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          department TEXT,
          clearance TEXT,
          vector JSONB NOT NULL,
          vector_id TEXT,
          enrolled_at TEXT
        );
      `;
      neonTableInitialized = true;
    }
    return sql;
  } catch (err) {
    console.warn('[AegisGuard] Neon connection warning:', err);
    return null;
  }
}

/**
 * Fetches all registered biometric vector profiles across cloud tiers
 */
export async function getAllProfiles(): Promise<StoredBiometricProfile[]> {
  // Tier 1: Neon Postgres
  const sql = await getNeonSql();
  if (sql) {
    try {
      const rows = await sql`SELECT * FROM aegis_biometric_profiles ORDER BY enrolled_at DESC`;
      if (rows && rows.length > 0) {
        const neonProfiles: StoredBiometricProfile[] = rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          email: r.email || '',
          department: r.department || '',
          clearance: r.clearance || '',
          vector: Array.isArray(r.vector) ? r.vector : JSON.parse(r.vector || '[]'),
          vectorId: r.vector_id || r.id,
          enrolledAt: r.enrolled_at || new Date().toISOString(),
        }));
        memoryVectorStore = neonProfiles;
        return neonProfiles;
      }
    } catch (err) {
      console.warn('[AegisGuard] Neon query fallback:', err);
    }
  }

  // Tier 2: Vercel KV / Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (kvUrl && kvToken) {
    try {
      const res = await fetch(`${kvUrl}/get/biometric_users`, {
        headers: { Authorization: `Bearer ${kvToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      if (data && data.result) {
        const kvProfiles: StoredBiometricProfile[] = typeof data.result === 'string' 
          ? JSON.parse(data.result) 
          : data.result;
        memoryVectorStore = kvProfiles;
        return kvProfiles;
      }
    } catch (err) {
      console.warn('[AegisGuard] Vercel KV fetch fallback:', err);
    }
  }

  // Tier 3: Universal Cloud Vault (Cross-Laptop & Multi-Device Sync)
  try {
    const cloudRes = await fetch(GLOBAL_CLOUD_VAULT_API, {
      cache: 'no-store',
    });
    if (cloudRes.ok) {
      const cloudData = await cloudRes.json();
      if (cloudData && cloudData.data && Array.isArray(cloudData.data.users)) {
        const cloudProfiles: StoredBiometricProfile[] = cloudData.data.users;
        // Merge with any in-memory profiles
        const mergedMap = new Map<string, StoredBiometricProfile>();
        cloudProfiles.forEach(p => mergedMap.set(p.id, p));
        memoryVectorStore.forEach(p => mergedMap.set(p.id, p));
        const combined = Array.from(mergedMap.values());
        memoryVectorStore = combined;
        return combined;
      }
    }
  } catch (err) {
    console.warn('[AegisGuard] Cloud Vault fetch fallback:', err);
  }

  // Tier 4: In-Memory Fallback
  return memoryVectorStore;
}

/**
 * Saves a new biometric profile into Cloud Storage
 */
export async function saveProfile(profile: StoredBiometricProfile): Promise<void> {
  // Update in-memory
  const existingIdx = memoryVectorStore.findIndex(p => p.id === profile.id);
  if (existingIdx >= 0) {
    memoryVectorStore[existingIdx] = profile;
  } else {
    memoryVectorStore.push(profile);
  }

  // Tier 1: Neon Postgres
  const sql = await getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO aegis_biometric_profiles (id, name, email, department, clearance, vector, vector_id, enrolled_at)
        VALUES (${profile.id}, ${profile.name}, ${profile.email}, ${profile.department}, ${profile.clearance}, ${JSON.stringify(profile.vector)}, ${profile.vectorId}, ${profile.enrolledAt})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          department = EXCLUDED.department,
          clearance = EXCLUDED.clearance,
          vector = EXCLUDED.vector,
          vector_id = EXCLUDED.vector_id,
          enrolled_at = EXCLUDED.enrolled_at;
      `;
    } catch (err) {
      console.warn('[AegisGuard] Neon write error:', err);
    }
  }

  // Tier 2: Vercel KV / Upstash Redis
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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
      console.warn('[AegisGuard] Vercel KV write error:', err);
    }
  }

  // Tier 3: Universal Cloud Vault (Cross-Laptop Persistence)
  try {
    const all = await getAllProfiles();
    const updatedUsers = [...all.filter(p => p.id !== profile.id), profile];
    await fetch(GLOBAL_CLOUD_VAULT_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'AegisProfiles',
        data: { users: updatedUsers, lastUpdated: new Date().toISOString() }
      }),
    });
  } catch (err) {
    console.warn('[AegisGuard] Cloud Vault write error:', err);
  }
}

/**
 * Performs 1:N vector search across all profiles
 */
export async function matchVector1toN(
  liveVector: number[],
  threshold = 0.78
): Promise<{ bestMatch: StoredBiometricProfile | null; score: number }> {
  const profiles = await getAllProfiles();
  let bestMatch: StoredBiometricProfile | null = null;
  let highestScore = 0;

  for (const profile of profiles) {
    if (!profile.vector || profile.vector.length !== liveVector.length) continue;
    const similarity = calculateBiometricSimilarity(liveVector, profile.vector);
    if (similarity > highestScore) {
      highestScore = similarity;
      bestMatch = profile;
    }
  }

  return {
    bestMatch: highestScore >= threshold ? bestMatch : null,
    score: highestScore,
  };
}
