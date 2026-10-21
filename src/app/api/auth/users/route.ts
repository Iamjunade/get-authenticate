import { NextResponse } from 'next/server';
import { getAllProfiles } from '@/lib/vectorStore';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const profiles = await getAllProfiles();
    // Return profiles without the raw vector embeddings to keep response lightweight
    const safeProfiles = profiles.map(({ vector, ...rest }) => rest);
    return NextResponse.json({ users: safeProfiles, count: safeProfiles.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
