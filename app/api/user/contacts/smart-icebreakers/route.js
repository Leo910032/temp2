// app/api/user/contacts/smart-icebreakers/route.js
// API endpoint for generating smart icebreakers with real-time web search

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { SmartIcebreakerService } from '@/lib/services/serviceContact/server/smartIcebreakerService';

export async function POST(request) {
  const requestId = `smart_icebreaker_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`🚀 [SmartIcebreakerAPI] [${requestId}] Starting smart icebreaker request`);
  
  try {
    // 1. Authenticate the user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] Missing authorization header`);
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`👤 [SmartIcebreakerAPI] [${requestId}] User authenticated: ${userId}`);

    // 2. Parse request body
    const { 
      contactId,
      strategicQuestions,
      options = {}
    } = await request.json();
    
    console.log(`📝 [SmartIcebreakerAPI] [${requestId}] Request params:`, {
      contactId,
      questionsCount: strategicQuestions?.length,
      options
    });

    if (!contactId) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] Missing contactId`);
      return NextResponse.json({ 
        error: 'Contact ID is required' 
      }, { status: 400 });
    }

    if (!strategicQuestions || !Array.isArray(strategicQuestions)) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] Invalid strategic questions`);
      return NextResponse.json({ 
        error: 'Strategic questions array is required' 
      }, { status: 400 });
    }

    // 3. Get user's subscription
    console.log(`👤 [SmartIcebreakerAPI] [${requestId}] Fetching user subscription...`);
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] User not found in database`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const subscriptionLevel = userData.accountType?.toLowerCase() || 'base';
    console.log(`👤 [SmartIcebreakerAPI] [${requestId}] Subscription level: ${subscriptionLevel}`);

    // 4. Check subscription level
    if (!SmartIcebreakerService.canUseSmartIcebreakers(subscriptionLevel)) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] Insufficient subscription level`);
      return NextResponse.json({ 
        error: 'Smart icebreaker generation requires Business subscription or higher',
        requiredFeature: 'BUSINESS_SMART_ICEBREAKERS'
      }, { status: 403 });
    }

    // 5. Set up options with defaults
    const enhancedOptions = {
      trackCosts: options.trackCosts !== false, // Default to true
      searchProvider: options.searchProvider || 'serpapi',
      maxSearches: Math.min(options.maxSearches || 3, 5), // Cap at 5 searches
      subscriptionLevel,
      ...options
    };

    console.log(`⚙️ [SmartIcebreakerAPI] [${requestId}] Enhanced options:`, enhancedOptions);

    // 6. Generate smart icebreakers
    console.log(`🎯 [SmartIcebreakerAPI] [${requestId}] Starting icebreaker generation...`);
    const result = await SmartIcebreakerService.generateSmartIcebreakers(
      userId,
      contactId,
      strategicQuestions,
      enhancedOptions
    );

    console.log(`✅ [SmartIcebreakerAPI] [${requestId}] Icebreakers generated successfully:`, {
      icebreakersCount: result.icebreakers?.length || 0,
      totalCost: result.costs?.total || 0,
      searchCosts: result.costs?.searches || 0,
      llmCosts: result.costs?.llm || 0
    });

    // 7. Prepare response
    const responseData = {
      success: true,
      contactId,
      icebreakers: result.icebreakers,
      costs: result.costs,
      metadata: {
        ...result.metadata,
        requestId,
        timestamp: new Date().toISOString()
      },
      searchSummary: {
        questionsProcessed: result.searchResults?.length || 0,
        successfulSearches: result.searchResults?.filter(sr => !sr.error).length || 0,
        failedSearches: result.searchResults?.filter(sr => sr.error).length || 0
      }
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error(`❌ [SmartIcebreakerAPI] [${requestId}] API error:`, {
      message: error.message,
      stack: error.stack
    });
    
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json({ error: 'Authentication expired. Please sign in again.' }, { status: 401 });
    }

    if (error.message?.includes('not available')) {
      return NextResponse.json({ 
        error: error.message,
        requestId 
      }, { status: 403 });
    }

    return NextResponse.json({ 
      error: 'Smart icebreaker generation failed',
      details: error.message,
      requestId 
    }, { status: 500 });
  }
}

export async function GET(request) {
  const requestId = `icebreaker_stats_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  console.log(`📊 [SmartIcebreakerAPI] [${requestId}] Getting usage statistics`);
  
  try {
    // 1. Authenticate the user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`❌ [SmartIcebreakerAPI] [${requestId}] Missing authorization header`);
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`👤 [SmartIcebreakerAPI] [${requestId}] User authenticated: ${userId}`);

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '30d';

    console.log(`📊 [SmartIcebreakerAPI] [${requestId}] Getting stats for timeframe: ${timeframe}`);

    // 3. Get usage statistics
    const stats = await SmartIcebreakerService.getUsageStats(userId, timeframe);

    console.log(`✅ [SmartIcebreakerAPI] [${requestId}] Stats retrieved:`, {
      totalGenerations: stats.totalGenerations,
      totalCost: stats.totalCost,
      timeframe: stats.timeframe
    });

    return NextResponse.json({
      success: true,
      stats,
      metadata: {
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`❌ [SmartIcebreakerAPI] [${requestId}] Stats error:`, {
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({ 
      error: 'Failed to get usage statistics',
      requestId 
    }, { status: 500 });
  }
}