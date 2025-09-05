// app/api/user/contacts/groups/job-status/[jobId]/route.js
// API route for checking background job status

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { jobId } = params;
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobData = jobDoc.data();
    
    // Verify user owns this job
    if (jobData.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      job: {
        id: jobData.id,
        status: jobData.status,
        progress: jobData.progress,
        stages: jobData.stages,
        result: jobData.result,
        error: jobData.error,
        estimatedTimeRemaining: calculateTimeRemaining(jobData),
        createdAt: jobData.createdAt,
        updatedAt: jobData.updatedAt,
        currentChunk: jobData.currentChunk,
        totalChunks: jobData.totalChunks
      }
    });

  } catch (error) {
    console.error('Failed to get job status:', error);
    return NextResponse.json({
      error: 'Failed to get job status',
      details: error.message
    }, { status: 500 });
  }
}

function calculateTimeRemaining(jobData) {
  if (jobData.status === 'completed' || jobData.status === 'failed') {
    return 0;
  }
  
  const progress = jobData.progress || 0;
  const estimatedTotal = jobData.estimatedDuration || 30000;
  const elapsed = Date.now() - (jobData.createdAt?.toMillis() || Date.now());
  
  if (progress > 0) {
    const estimatedRemaining = (elapsed / progress) * (100 - progress);
    return Math.max(0, Math.min(estimatedRemaining, estimatedTotal - elapsed));
  }
  
  return estimatedTotal - elapsed;
}