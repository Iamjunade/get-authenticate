import { NextResponse } from 'next/server';
import { saveProfile, StoredBiometricProfile } from '@/lib/vectorStore';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, department, clearance, vector } = body;

    if (!name || !vector || !Array.isArray(vector)) {
      return NextResponse.json(
        { error: 'Name and numerical face vector array are required.' },
        { status: 400 }
      );
    }

    const newProfile: StoredBiometricProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name,
      email: email || '',
      department: department || 'Cyber Defense',
      clearance: clearance || 'Level 5 (Top Secret)',
      vector,
      vectorId: 'vec_' + Math.random().toString(36).substring(2, 10),
      enrolledAt: new Date().toISOString(),
    };

    await saveProfile(newProfile);

    return NextResponse.json({
      status: 'ENROLLED',
      user: newProfile,
      message: 'Biometric vector successfully saved into Vercel storage. Zero raw images retained.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Enrollment failed' }, { status: 500 });
  }
}
