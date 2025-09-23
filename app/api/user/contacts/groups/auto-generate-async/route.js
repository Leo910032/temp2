/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

// app/api/user/contacts/groups/auto-generate-async/route.js
// Fixed version with Firestore-safe data handling

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { GeminiGroupingEnhancer } from '@/lib/services/serviceContact/server/geminiGroupingEnhancer';

// Helper function to clean data for Firestore (removes undefined values)
function cleanForFirestore(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanForFirestore(value);
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
}

export async function POST(request) {
  try {
    console.log('🚀 Starting async AI group generation with cost tracking...');

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

   const body = await request.json();
    const { options } = body; 

    console.log(`📊 [API] User ${userId} requesting AI generation with options:`, options);

    // Step 1: Get user's subscription level
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
    
    console.log(`👤 [API] User subscription level: ${subscriptionLevel}`);

    // Step 2: Estimate operation cost
    const costEstimate = GeminiGroupingEnhancer.estimateOperationCost(subscriptionLevel, options);
    console.log(`💰 [API] Estimated cost: $${costEstimate.estimatedCost.toFixed(6)}`);

    // Step 3: Check if user can afford this operation
    const affordabilityCheck = await CostTrackingService.canAffordOperation(
      userId, 
      costEstimate.estimatedCost,
      1
    );

    if (!affordabilityCheck.canAfford) {
      console.log(`❌ [API] User cannot afford operation: ${affordabilityCheck.reason}`);
      
      let errorMessage;
      let errorCode;
      
      if (affordabilityCheck.reason === 'budget_exceeded') {
        errorMessage = `Monthly AI budget exceeded. You've used $${affordabilityCheck.currentUsage.toFixed(4)} of your plan's budget. Please upgrade your plan or wait until next month.`;
        errorCode = 'BUDGET_EXCEEDED';
      } else if (affordabilityCheck.reason === 'runs_exceeded') {
        errorMessage = `Monthly AI runs limit exceeded. You've used ${affordabilityCheck.currentRuns} of your plan's monthly runs. Please upgrade your plan or wait until next month.`;
        errorCode = 'RUNS_EXCEEDED';
      } else {
        errorMessage = 'AI features not available on your current plan. Please upgrade to access AI-powered contact grouping.';
        errorCode = 'SUBSCRIPTION_REQUIRED';
      }
      
      return NextResponse.json({
        error: errorMessage,
        code: errorCode,
        details: {
          subscriptionLevel,
          estimatedCost: costEstimate.estimatedCost,
          remainingBudget: affordabilityCheck.remainingBudget,
          remainingRuns: affordabilityCheck.remainingRuns
        }
      }, { status: 402 }); // Payment Required
    }

    // Step 4: Check usage warnings (notify if close to limits)
    const usageWarnings = await CostTrackingService.checkUsageWarnings(userId);
    
    // Step 5: Create job with enhanced metadata - CLEANED FOR FIRESTORE
    const jobId = `ai_grouping_${userId}_${Date.now()}`;
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    
    // Prepare job data and clean it for Firestore
    const jobData = {
      id: jobId,
      userId,
      type: 'ai_group_generation',
      status: 'queued',
      progress: 0,
      options: options || {},
      subscriptionLevel,
      estimatedCost: costEstimate.estimatedCost || 0,
      modelToUse: costEstimate.model || 'gemini-1.5-flash',
      useDeepAnalysis: costEstimate.useDeepAnalysis || false, // FIXED: Default to false instead of undefined
      featuresCount: costEstimate.featuresCount || 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      estimatedDuration: costEstimate.useDeepAnalysis ? 180000 : 120000,
      stages: [
        { name: 'Fetching Contacts', status: 'pending', progress: 0 },
        { name: 'AI Analysis', status: 'pending', progress: 0 },
        { name: 'Cost Tracking', status: 'pending', progress: 0 },
        { name: 'Saving Results', status: 'pending', progress: 0 }
      ]
    };

    // Clean the data before saving to Firestore
    const cleanedJobData = cleanForFirestore(jobData);
    await jobRef.set(cleanedJobData);

    // Step 6: Start the background process (don't await)
    processAIGroupingWithCostTracking(userId, jobId, options, subscriptionLevel, costEstimate).catch(error => {
      console.error(`🔴 Background job ${jobId} failed catastrophically:`, error);
      jobRef.update(cleanForFirestore({
        status: 'failed',
        error: error.message || 'An unknown error occurred during background processing.',
        updatedAt: FieldValue.serverTimestamp()
      }));
    });

    // Step 7: Return immediate response with cost information
    const response = {
      success: true,
      jobId,
      message: 'AI group generation started in the background.',
      estimatedDuration: costEstimate.useDeepAnalysis ? 180000 : 120000,
      costEstimate: costEstimate.estimatedCost,
      model: costEstimate.model,
      featuresEnabled: costEstimate.featuresCount,
      subscriptionLevel
    };

    // Add usage warnings if any
    if (usageWarnings.warnings.length > 0) {
      response.warnings = usageWarnings.warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to start background job:', error);
    return NextResponse.json({
      error: 'Failed to start AI group generation',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Background worker function with integrated cost tracking
 */
async function processAIGroupingWithCostTracking(userId, jobId, options, subscriptionLevel, costEstimate) {
  const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
  let actualCost = 0;
  
  try {
    // Stage 1: Fetching Contacts
    await jobRef.update(cleanForFirestore({
      status: 'processing',
      progress: 5,
      'stages.0.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    }));

    const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
    if (!contactsDoc.exists) throw new Error('No contacts document found for user.');
    const contacts = contactsDoc.data().contacts || [];
    console.log(`[${jobId}] Fetched ${contacts.length} contacts for user ${userId}`);

    if (contacts.length < 5) {
        await jobRef.update(cleanForFirestore({
            status: 'completed',
            progress: 100,
            result: { groups: [], message: 'Not enough contacts to process.' },
            actualCost: 0,
            completedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        }));
        return;
    }

    await jobRef.update(cleanForFirestore({
      progress: 15,
      'stages.0.status': 'completed',
      'stages.0.progress': 100,
      'stages.1.status': 'in_progress',
      updatedAt: FieldValue.serverTimestamp()
    }));

    // Stage 2: AI Analysis with Cost Tracking
    console.log(`[${jobId}] Starting AI analysis with ${costEstimate.model} model (Deep Analysis: ${costEstimate.useDeepAnalysis})`);
    
    let allGroups = [];

    try {
        // The enhancer will now handle cost tracking internally
        const result = await Promise.race([
            GeminiGroupingEnhancer.enhanceGrouping(contacts, subscriptionLevel, userId, options || {}),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI processing took too long and timed out.')), 
                  costEstimate.useDeepAnalysis ? 180000 : 120000)
            )
        ]);
        
        if (result && result.enhancedGroups) {
            allGroups.push(...result.enhancedGroups);
            actualCost = result.totalCost || 0;
            console.log(`[${jobId}] ✅ AI processing complete: ${result.enhancedGroups.length} groups generated at $${actualCost.toFixed(6)}`);
        } else {
            console.log(`[${jobId}] ⚠️ AI processing complete but no groups were generated.`);
        }

    } catch (aiError) {
        console.error(`[${jobId}] Error during AI enhancement phase:`, aiError);
        
        // Check if it's a budget error
        if (aiError.message.includes('budget exceeded') || aiError.message.includes('runs exceeded')) {
          throw aiError; // Re-throw budget errors to fail the job properly
        }
        
        // Record other errors but don't stop the job
        await jobRef.update(cleanForFirestore({
            'stageErrors.ai_enhancement': {
                error: aiError.message,
                timestamp: FieldValue.serverTimestamp()
            }
        }));
    }

    // Stage 3: Cost Tracking Update
    await jobRef.update(cleanForFirestore({
      progress: 85,
      'stages.1.status': 'completed',
      'stages.1.progress': 100,
      'stages.2.status': 'in_progress',
      actualCost: actualCost,
      updatedAt: FieldValue.serverTimestamp()
    }));

    // Update usage tracking (this was already done by the enhancer, but update job record)
    const currentUsage = await CostTrackingService.getUserMonthlyUsage(userId);
    
    await jobRef.update(cleanForFirestore({
      'stages.2.status': 'completed',
      'stages.2.progress': 100,
      'stages.3.status': 'in_progress',
      userUsageAfter: {
        totalCost: currentUsage.usage.totalCost || 0,
        totalRuns: currentUsage.usage.totalRuns || 0,
        remainingBudget: currentUsage.remainingBudget || 0,
        percentageUsed: currentUsage.percentageUsed || 0
      },
      updatedAt: FieldValue.serverTimestamp()
    }));

    // Stage 4: Saving Results
    const uniqueGroups = Array.from(new Map(allGroups.map(group => [group.name.toLowerCase().trim(), group])).values());
    const limitedGroups = uniqueGroups.slice(0, (options && options.maxGroups) || 15);
    
    let savedCount = 0;
    if (limitedGroups.length > 0) {
        const { AutoGroupService } = await import('@/lib/services/serviceContact/server/autoGroupService');
        const saveResult = await AutoGroupService.saveGeneratedGroups(userId, limitedGroups);
        savedCount = saveResult.savedCount;
    }

    // Final Stage: Completing the Job
    await jobRef.update(cleanForFirestore({
      status: 'completed',
      progress: 100,
      'stages.3.status': 'completed',
      'stages.3.progress': 100,
      result: {
        groups: limitedGroups,
        totalGenerated: allGroups.length,
        totalUnique: uniqueGroups.length,
        totalSaved: savedCount,
        actualCost: actualCost,
        estimatedCost: costEstimate.estimatedCost,
        model: costEstimate.model,
        subscriptionLevel: subscriptionLevel,
        featuresUsed: costEstimate.featuresCount
      },
      actualCost: actualCost,
      costAccuracy: Math.abs(actualCost - costEstimate.estimatedCost) < 0.001 ? 'high' : 'medium',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }));

    console.log(`[${jobId}] ✅ AI group generation job fully completed for user ${userId}. Saved ${savedCount} new groups at actual cost ${actualCost.toFixed(6)}`);

  } catch (error) {
    console.error(`[${jobId}] ❌ AI group generation failed for user ${userId}:`, error);
    
    // Update job with failure info
    await jobRef.update(cleanForFirestore({
      status: 'failed',
      error: error.message,
      errorType: error.message.includes('budget') || error.message.includes('runs') ? 'budget_limit' : 'processing_error',
      actualCost: actualCost || 0,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }));
  }
}