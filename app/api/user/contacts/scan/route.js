// app/api/user/contacts/scan/route.js - FIXED API INTERFACE
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin'; 
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { AI_COST_ESTIMATES } from '@/lib/services/serviceContact/client/services/constants/contactConstants';

/**
 * POST /api/user/contacts/scan - Scan business card with cost tracking
 */
export async function POST(request) {
  const requestId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  
  try {
    console.log(`📇 [${requestId}] POST /api/user/contacts/scan - Processing business card scan`);

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    console.log(`👤 [${requestId}] Authenticated user: ${userId}`);

    // Parse request body
    const body = await request.json();
    const { 
      imageBase64, 
      side = 'front', 
      trackCost = true,
      metadata = {}
    } = body;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is required' }, { status: 400 });
    }

    // Validate image data
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      return NextResponse.json({ error: 'Invalid image data format' }, { status: 400 });
    }

    console.log(`🔍 [${requestId}] Processing ${side} side, trackCost: ${trackCost}`);
    console.log(`🔍 [${requestId}] Image data length: ${imageBase64.length} characters`);

    // Check cost and limits if tracking is enabled
    let costCheck = { canAfford: true };
    if (trackCost) {
      try {
        const estimatedCost = AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING; // Base estimate
        costCheck = await CostTrackingService.canAffordOperation(userId, estimatedCost, 1);
        
        console.log(`💰 [${requestId}] Cost check result:`, {
          canAfford: costCheck.canAfford,
          reason: costCheck.reason,
          estimatedCost
        });

        if (!costCheck.canAfford) {
          return NextResponse.json({ 
            error: `Cannot process scan: ${costCheck.reason}`,
            costInfo: {
              reason: costCheck.reason,
              remainingBudget: costCheck.remainingBudget,
              remainingRuns: costCheck.remainingRuns,
              estimatedCost
            }
          }, { status: 402 });
        }
      } catch (costError) {
        console.error(`❌ [${requestId}] Cost check failed:`, costError);
        // Continue with scan but log the error
      }
    }

    // Record API call cost (always billable regardless of success)
    const scanStartTime = Date.now();
    let apiCallCost = 0;

    try {
      // ✅ FIXED: Format images object correctly for the service
      const images = {
        [side]: imageBase64  // Create object with side as key and base64 as value
      };

      console.log(`📇 [${requestId}] Calling BusinessCardService.processEnhancedScan with:`);
      console.log(`📇 [${requestId}] - profileOwnerId: ${userId}`);
      console.log(`📇 [${requestId}] - images: ${Object.keys(images).join(', ')}`);
      console.log(`📇 [${requestId}] - requestId: ${requestId}`);

      // ✅ FIXED: Call service with correct parameters
      const result = await BusinessCardService.processEnhancedScan(userId, images, {
        language: 'en',
        requestId,
        isPublicScan: false,
        trackCost,
        metadata: {
          ...metadata,
          requestId,
          side,
          startTime: scanStartTime
        }
      });

      const scanEndTime = Date.now();
      const processingTime = scanEndTime - scanStartTime;

      console.log(`✅ [${requestId}] Service call completed after ${processingTime}ms`);
      console.log(`📇 [${requestId}] Result success: ${result.success}`);
      console.log(`📇 [${requestId}] Result fields: ${result.parsedFields?.length || 0}`);

      // Calculate actual API call cost based on processing
      apiCallCost = calculateActualScanCost(result, processingTime);

      console.log(`💰 [${requestId}] Calculated API call cost: $${apiCallCost.toFixed(6)}`);

      // Record API call cost (paid regardless of success)
      if (trackCost) {
        await CostTrackingService.recordSeparatedUsage(
          userId,
          apiCallCost,
          'gemini-1.5-flash',
          'business_card_scan',
          {
            requestId,
            side,
            processingTimeMs: processingTime,
            hasQRCode: result.metadata?.hasQRCode || false,
            fieldsDetected: result.parsedFields?.length || 0
          },
          'api_call' // This is an API call cost
        );
      }

      // Record successful run if scan was successful
      if (result.success && result.parsedFields?.length > 0) {
        if (trackCost) {
          await CostTrackingService.recordSeparatedUsage(
            userId,
            0, // No additional cost for successful run tracking
            'gemini-1.5-flash',
            'business_card_scan_success',
            {
              requestId,
              side,
              fieldsDetected: result.parsedFields.length,
              confidence: result.metadata?.confidence || 0
            },
            'successful_run' // This counts toward run limits
          );
        }

        console.log(`✅ [${requestId}] Business card processed successfully with ${result.parsedFields.length} fields`);
      } else {
        console.log(`⚠️ [${requestId}] Scan completed but with limited results`);
      }

      // Add cost information to response
      const responseData = {
        ...result,
        costInfo: trackCost ? {
          apiCallCost,
          trackingEnabled: true,
          side,
          processingTime: `${processingTime}ms`
        } : {
          trackingEnabled: false
        }
      };

      return NextResponse.json(responseData);

    } catch (processingError) {
      // Even if processing fails, we may have incurred API costs
      const scanEndTime = Date.now();
      const processingTime = scanEndTime - scanStartTime;
      
      // Estimate cost for failed API call
      apiCallCost = estimateFailedScanCost(processingTime);

      console.error(`❌ [${requestId}] Processing failed after ${processingTime}ms:`, processingError);

      // Record failed API call cost
      if (trackCost && apiCallCost > 0) {
        try {
          await CostTrackingService.recordSeparatedUsage(
            userId,
            apiCallCost,
            'gemini-1.5-flash',
            'business_card_scan_failed',
            {
              requestId,
              side,
              processingTimeMs: processingTime,
              errorType: processingError.name || 'unknown',
              errorMessage: processingError.message
            },
            'api_call' // Failed API calls still cost money
          );
        } catch (costRecordError) {
          console.error(`❌ [${requestId}] Failed to record cost for failed scan:`, costRecordError);
        }
      }

      throw processingError;
    }

  } catch (error) {
    console.error(`❌ [${requestId}] Error in POST /api/user/contacts/scan:`, error);

    // Check if the error is a Firebase Auth error
    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    let status = 500;
    let errorMessage = error.message || 'Failed to process business card';

    if (error.message?.includes('Invalid') || error.message?.includes('format')) {
      status = 400;
    } else if (error.message?.includes('subscription') || error.message?.includes('limit') || error.message?.includes('afford')) {
      status = 402;
    } else if (error.message?.includes('rate limit')) {
      status = 429;
    } else if (error.message?.includes('not found')) {
      status = 404;
    }

    return NextResponse.json({ 
      error: errorMessage, 
      success: false,
      requestId
    }, { status });
  }
}

/**
 * GET /api/user/contacts/scan/cost-check - Check if user can afford scan
 */
export async function GET(request) {
  try {
    console.log('💰 GET /api/user/contacts/scan/cost-check - Checking scan affordability');

    // Authenticate user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const scanCount = parseInt(searchParams.get('count')) || 1;
    const action = searchParams.get('action') || 'cost-check';

    if (action === 'cost-check') {
      // Check affordability
      const estimatedCost = AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING * scanCount;
      const affordabilityCheck = await CostTrackingService.canAffordOperation(userId, estimatedCost, scanCount);

      console.log('✅ Cost check completed successfully');
      return NextResponse.json({
        ...affordabilityCheck,
        estimatedCost,
        scanCount
      });

    } else if (action === 'cost-estimate') {
      // Get cost estimate
      const estimatedCost = AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING * scanCount;
      
      return NextResponse.json({
        estimated: estimatedCost,
        currency: 'USD',
        scanCount,
        perScanCost: AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING
      });

    } else if (action === 'usage-stats') {
      // Get usage statistics
      const usage = await CostTrackingService.getUserMonthlyUsage(userId);
      
      return NextResponse.json({
        monthlyScans: usage.usage.totalRuns,
        monthlyCost: usage.usage.totalCost,
        remainingBudget: usage.remainingBudget,
        remainingRuns: usage.remainingRuns,
        subscriptionLevel: usage.subscriptionLevel,
        percentageUsed: usage.percentageUsed
      });

    } else {
      return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Error in cost check endpoint:', error);

    if (error.code && error.code.startsWith('auth/')) {
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
    }

    return NextResponse.json({ 
      error: error.message || 'Failed to check scan cost',
      success: false 
    }, { status: 500 });
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate actual scan cost based on results and processing time
 */
function calculateActualScanCost(result, processingTimeMs) {
  let baseCost = AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING;

  // Adjust cost based on processing complexity
  if (result.metadata?.hasQRCode) {
    baseCost *= 1.2; // QR processing adds cost
  }

  if (result.parsedFields?.length > 5) {
    baseCost *= 1.1; // More fields = more processing
  }

  // Factor in processing time (longer = more API usage)
  if (processingTimeMs > 10000) { // > 10 seconds
    baseCost *= 1.3;
  } else if (processingTimeMs > 5000) { // > 5 seconds
    baseCost *= 1.1;
  }

  return baseCost;
}

/**
 * Estimate cost for failed API calls
 */
function estimateFailedScanCost(processingTimeMs) {
  // Base cost for failed calls (usually lower since less processing occurred)
  let failedCost = AI_COST_ESTIMATES.STANDARD_COMPANY_MATCHING * 0.3;

  // If it failed quickly, almost no cost
  if (processingTimeMs < 1000) {
    failedCost *= 0.1;
  } else if (processingTimeMs < 3000) {
    failedCost *= 0.5;
  }

  return Math.max(failedCost, 0.0001); // Minimum cost of $0.0001
}