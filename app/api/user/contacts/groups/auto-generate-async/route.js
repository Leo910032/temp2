// app/api/user/contacts/groups/auto-generate-async/route.js
// FIXED VERSION - Proper timeout handling and progress updates

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Create a job record immediately
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
      estimatedDuration: 120000, // 2 minutes estimate (was 300 seconds, too long)
      stages: [
        { name: 'Fetching contacts', status: 'pending', progress: 0 },
        { name: 'AI analysis', status: 'pending', progress: 0 },
        { name: 'Group generation', status: 'pending', progress: 0 },
        { name: 'Saving results', status: 'pending', progress: 0 }
      ]
    });

    // Start background processing (don't await it)
    processAIGroupingAsync(userId, jobId, options).catch(error => {
      console.error('Background job failed:', error);
      // Update job status to failed
      jobRef.update({
        status: 'failed',
        error: error.message,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    // Return immediately with job ID
    return NextResponse.json({
      success: true,
      jobId,
      message: 'AI group generation started in background',
      estimatedDuration: 120000 // 2 minutes
    });

  } catch (error) {
    console.error('Failed to start background job:', error);
    return NextResponse.json({
      error: 'Failed to start AI group generation',
      details: error.message
    }, { status: 500 });
  }
}

// FIXED: Background processing function with proper timeout and progress handling
async function processAIGroupingAsync(userId, jobId, options) {
  const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
  
  try {
    // Update status to processing
    await jobRef.update({
      status: 'processing',
      progress: 10,
      updatedAt: FieldValue.serverTimestamp(),
      'stages.0.status': 'in_progress'
    });

    // Stage 1: Fetch contacts using the correct method
    await jobRef.update({
      progress: 25,
      'stages.0.status': 'completed',
      'stages.0.progress': 100,
      'stages.1.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    // Get contacts directly from Firestore
    const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
    
    if (!contactsDoc.exists) {
      await jobRef.update({
        status: 'completed',
        progress: 100,
        result: { groups: [], message: 'No contacts found' },
        updatedAt: FieldValue.serverTimestamp()
      });
      return;
    }

    const contactsData = contactsDoc.data();
    const contacts = contactsData.contacts || [];
    console.log(`Fetched ${contacts.length} contacts for user ${userId}`);

    if (contacts.length === 0) {
      await jobRef.update({
        status: 'completed',
        progress: 100,
        result: { groups: [], message: 'No contacts found' },
        updatedAt: FieldValue.serverTimestamp()
      });
      return;
    }

    // Stage 2: AI Analysis (with progress updates)
    await jobRef.update({
      progress: 40,
      'stages.1.progress': 30,
      updatedAt: FieldValue.serverTimestamp()
    });

    // Import the AI services (dynamic import to avoid loading delays)
    const { AutoGroupService } = await import('@/lib/services/serviceContact/server/autoGroupService');
    const { GeminiGroupingEnhancer } = await import('@/lib/services/serviceContact/server/geminiGroupingEnhancer');

    // FIXED: Process in smaller chunks with longer timeouts
    const CHUNK_SIZE = 30; // Reduced from 50 to 30
    const chunks = [];
    for (let i = 0; i < contacts.length; i += CHUNK_SIZE) {
      chunks.push(contacts.slice(i, i + CHUNK_SIZE));
    }

    const allGroups = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Update progress for each chunk
      const chunkProgress = 40 + (40 * (i + 1) / chunks.length);
      await jobRef.update({
        progress: chunkProgress,
        'stages.1.progress': (i + 1) / chunks.length * 100,
        currentChunk: i + 1,
        totalChunks: chunks.length,
        updatedAt: FieldValue.serverTimestamp()
      });

      try {
        if (GeminiGroupingEnhancer && typeof GeminiGroupingEnhancer.enhanceGrouping === 'function') {
          // FIXED: Increased timeout to 60 seconds and added better error handling
          const chunkResult = await Promise.race([
            GeminiGroupingEnhancer.enhanceGrouping(chunk, 'enterprise', userId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AI processing timeout for chunk')), 60000) // Increased from 15s to 60s
            )
          ]);

          if (chunkResult && chunkResult.enhancedGroups && chunkResult.enhancedGroups.length > 0) {
            allGroups.push(...chunkResult.enhancedGroups);
            console.log(`✅ Chunk ${i + 1}/${chunks.length} processed: ${chunkResult.enhancedGroups.length} groups`);
          } else {
            console.log(`⚠️ Chunk ${i + 1}/${chunks.length} processed but no groups generated`);
          }
        } else {
          console.log('GeminiGroupingEnhancer not available, falling back to basic grouping...');
          
          // FALLBACK: Use basic rule-based grouping from AutoGroupService
          if (options.groupByCompany) {
            const companyGroups = AutoGroupService.groupContactsByCompany(chunk, options.minGroupSize || 2);
            allGroups.push(...companyGroups);
          }
          
          if (options.groupByTime) {
            const timeGroups = AutoGroupService.generateTimeBasedGroups(chunk, options.minGroupSize || 2);
            allGroups.push(...timeGroups);
          }
        }
      } catch (chunkError) {
        console.error(`Error processing chunk ${i + 1}:`, chunkError);
        
        // Update job with chunk error info but continue processing
        await jobRef.update({
          [`chunkErrors.${i}`]: {
            error: chunkError.message,
            timestamp: FieldValue.serverTimestamp()
          },
          updatedAt: FieldValue.serverTimestamp()
        });
        
        // FALLBACK: Try basic grouping even if AI fails
        try {
          if (options.groupByCompany) {
            const companyGroups = AutoGroupService.groupContactsByCompany(chunk, options.minGroupSize || 2);
            allGroups.push(...companyGroups);
          }
        } catch (fallbackError) {
          console.error(`Fallback grouping also failed for chunk ${i + 1}:`, fallbackError);
        }
      }
    }

    // Stage 3: Group generation and deduplication
    await jobRef.update({
      progress: 85,
      'stages.1.status': 'completed',
      'stages.1.progress': 100,
      'stages.2.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    // Remove duplicates and limit results
    const uniqueGroups = Array.from(
      new Map(allGroups.map(group => [group.name, group])).values()
    );
    const limitedGroups = uniqueGroups.slice(0, options.maxGroups || 10);

    // Stage 4: Save results
    await jobRef.update({
      progress: 95,
      'stages.2.status': 'completed',
      'stages.2.progress': 100,
      'stages.3.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    });

    if (limitedGroups.length > 0) {
      await AutoGroupService.saveGeneratedGroups(userId, limitedGroups);
    }

    // Complete the job
    await jobRef.update({
      status: 'completed',
      progress: 100,
      'stages.3.status': 'completed',
      'stages.3.progress': 100,
      result: {
        groups: limitedGroups,
        totalGenerated: allGroups.length,
        totalUnique: uniqueGroups.length,
        totalSaved: limitedGroups.length
      },
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    console.log(`✅ AI group generation completed for user ${userId}: ${limitedGroups.length} groups`);

  } catch (error) {
    console.error(`❌ AI group generation failed for user ${userId}:`, error);
    
    await jobRef.update({
      status: 'failed',
      error: error.message,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }
}