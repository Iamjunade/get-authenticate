import { NextResponse } from 'next/server';
import { getAllProfiles } from '@/lib/vectorStore';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeVectors = searchParams.get('includeVectors') === 'true';
    const profiles = await getAllProfiles();

    // When includeVectors=true is requested by the client, provide vectors for 1:N cosine matching
    const resultProfiles = includeVectors
      ? profiles
      : profiles.map(({ vector, ...rest }) => rest);

    return NextResponse.json(
      { users: resultProfiles, count: resultProfiles.length, synced: true },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
