// In app/api/revalidate/route.js

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(request) {
  console.log('--- ✅ /api/revalidate route hit ---');

  // --- Step 1: Log what the server is receiving ---
  const requestBody = await request.json();
  const { secret: receivedSecret, path } = requestBody;

  console.log(`[REVALIDATE_API] Received Path: >>${path}<<`);
  // Log only a portion of the secret for security, but enough to see if it exists
  console.log(`[REVALIDATE_API] Received Secret: >>${String(receivedSecret).substring(0, 5)}...<<`);

  // --- Step 2: Log what the server EXPECTS the secret to be ---
  const expectedSecret = process.env.REVALIDATION_SECRET;
  console.log(`[REVALIDATE_API] Server's Expected Secret: >>${String(expectedSecret).substring(0, 5)}...<<`);

  // --- Step 3: Perform the checks with detailed logs ---
  if (receivedSecret !== expectedSecret) {
    console.error('[REVALIDATE_API] ❌ ERROR: Secrets do not match!');
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  if (!path) {
    console.error('[REVALIDATE_API] ❌ ERROR: Path is missing from the request.');
    return NextResponse.json({ message: 'Path is required' }, { status: 400 });
  }

  console.log('[REVALIDATE_API] ✅ Secrets match and path is present. Proceeding to revalidate...');

  // --- Step 4: Call revalidatePath and log the outcome ---
  try {
    revalidatePath(path);
    console.log(`[REVALIDATE_API] ✅ Successfully called revalidatePath for: ${path}`);
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    console.error(`[REVALIDATE_API] ❌ FATAL ERROR inside revalidatePath for ${path}:`, err);
    return NextResponse.json({ message: 'Error during revalidation', error: err.message }, { status: 500 });
  }
}