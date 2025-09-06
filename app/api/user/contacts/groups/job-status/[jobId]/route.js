// app/api/user/contacts/groups/job-status/[jobId]/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { BackgroundJobService } from '@/lib/services/serviceContact/server/backgroundJobService';

export async function GET(request, { params }) {
  try {
    // Extract and verify auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ [JobStatus] Missing or invalid Authorization header');
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (authError) {
      console.error('❌ [JobStatus] Token verification failed:', authError.message);
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const { jobId } = params;

    console.log(`🔍 [JobStatus] Checking job ${jobId} for user ${userId}`);

    // Get job status from service
    const jobData = await BackgroundJobService.getJobStatus(userId, jobId);

    return NextResponse.json({
      success: true,
      job: jobData
    });

  } catch (error) {
    console.error(`❌ [JobStatus] Failed to get job status for ${params?.jobId}:`, error);
    
    // Handle specific error types
    if (error.message === 'Job not found') {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (error.message === 'Permission denied') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }
    if (error.message?.includes('Token')) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    return NextResponse.json({
      error: 'Failed to retrieve job status',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}