//app/api/user/contacts/groups/auto-generate-async/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// This is the main API route that the client calls to START the job.
// It creates a job record in Firestore and returns a jobId immediately.
export async function POST(request) {
  try {
    console.log('🚀 Starting async AI group generation...');

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { options } = body;

    // Create a job record immediately so the client can start polling.
    const jobId = `ai_grouping_${userId}_${Date.now()}`;
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    
    await jobRef.set({
      id: jobId,
      userId,
      type: 'ai_group_generation',
      status: 'queued',
      progress: 0,
      options,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      estimatedDuration: 120000, // 2 minutes estimate
      stages: [
        { name: 'Fetching Contacts', status: 'pending', progress: 0 },
        { name: 'AI Analysis', status: 'pending', progress: 0 },
        { name: 'Deduplicating Groups', status: 'pending', progress: 0 },
        { name: 'Saving Results', status: 'pending', progress: 0 }
      ]
    });

    // IMPORTANT: Start the long-running process but DO NOT await it.
    // This allows the API to return a response to the client instantly.
    processAIGroupingAsync(userId, jobId, options).catch(error => {
      console.error(`🔴 Background job ${jobId} failed catastrophically:`, error);
      jobRef.update({
        status: 'failed',
        error: error.message || 'An unknown error occurred during background processing.',
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    // Return immediately with the job ID.
    return NextResponse.json({
      success: true,
      jobId,
      message: 'AI group generation started in the background.',
      estimatedDuration: 120000
    });

  } catch (error) {
    console.error('Failed to start background job:', error);
    return NextResponse.json({
      error: 'Failed to start AI group generation',
      details: error.message
    }, { status: 500 });
  }
}


// This is the actual background worker function. It runs on the server
// after the API has already responded.
async function processAIGroupingAsync(userId, jobId, options) {
  const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
  
  try {
    // --- STAGE 1: Fetching Contacts ---
    await jobRef.update({
      status: 'processing',
      progress: 5,
      'stages.0.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
    if (!contactsDoc.exists) throw new Error('No contacts document found for user.');
    const contacts = contactsDoc.data().contacts || [];
    console.log(`[${jobId}] Fetched ${contacts.length} contacts for user ${userId}`);

    if (contacts.length < 5) {
        await jobRef.update({
            status: 'completed',
            progress: 100,
            result: { groups: [], message: 'Not enough contacts to process.' },
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        return;
    }

    await jobRef.update({
      progress: 15,
      'stages.0.status': 'completed',
      'stages.0.progress': 100,
      'stages.1.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    // --- STAGE 2: AI Analysis (The Heavy Lifting) ---
    const { GeminiGroupingEnhancer } = await import('@/lib/services/serviceContact/server/geminiGroupingEnhancer');
    let allGroups = [];

    try {
        if (!GeminiGroupingEnhancer || typeof GeminiGroupingEnhancer.enhanceGrouping !== 'function') {
            throw new Error('GeminiGroupingEnhancer service is not available.');
        }

        // Call the enhancer with ALL contacts at once. It will handle its own internal logic.
        const result = await Promise.race([
            GeminiGroupingEnhancer.enhanceGrouping(contacts, 'enterprise', userId), // Assuming enterprise for now
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI processing took too long and timed out.')), 120000) // 2-minute timeout
            )
        ]);
        
        if (result && result.enhancedGroups) {
            allGroups.push(...result.enhancedGroups);
            console.log(`[${jobId}] ✅ AI processing complete: ${result.enhancedGroups.length} total groups generated.`);
        } else {
            console.log(`[${jobId}] ⚠️ AI processing complete but no groups were generated.`);
        }

    } catch (aiError) {
        console.error(`[${jobId}] Error during AI enhancement phase:`, aiError);
        // Record the error but don't stop the job; we might still have groups from fallback logic.
        await jobRef.update({
            'stageErrors.ai_enhancement': {
                error: aiError.message,
                timestamp: FieldValue.serverTimestamp()
            }
        });
    }

    // --- STAGE 3: Deduplicating Groups ---
    await jobRef.update({
      progress: 85,
      'stages.1.status': 'completed',
      'stages.1.progress': 100,
      'stages.2.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    const uniqueGroups = Array.from(new Map(allGroups.map(group => [group.name.toLowerCase().trim(), group])).values());
    const limitedGroups = uniqueGroups.slice(0, options.maxGroups || 15);
    
    // --- STAGE 4: Saving Results ---
    await jobRef.update({
      progress: 95,
      'stages.2.status': 'completed',
      'stages.2.progress': 100,
      'stages.3.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    let savedCount = 0;
    if (limitedGroups.length > 0) {
        const { AutoGroupService } = await import('@/lib/services/serviceContact/server/autoGroupService');
        const saveResult = await AutoGroupService.saveGeneratedGroups(userId, limitedGroups);
        savedCount = saveResult.savedCount;
    }

    // --- FINAL STAGE: Completing the Job ---
    await jobRef.update({
      status: 'completed',
      progress: 100,
      'stages.3.status': 'completed',
      'stages.3.progress': 100,
      result: {
        groups: limitedGroups, // Return the groups suggested, even if some were duplicates
        totalGenerated: allGroups.length,
        totalUnique: uniqueGroups.length,
        totalSaved: savedCount
      },
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`[${jobId}] ✅ AI group generation job fully completed for user ${userId}. Saved ${savedCount} new groups.`);

  } catch (error) {
    console.error(`[${jobId}] ❌ AI group generation failed for user ${userId}:`, error);
    await jobRef.update({
      status: 'failed',
      error: error.message,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}