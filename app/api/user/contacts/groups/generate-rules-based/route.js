/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// //
// app/api/user/contacts/groups/generate-rules-based/route.js
// API endpoint for rules-based group generation (no AI, no cost tracking)

import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { RulesGroupService } from '@/lib/services/serviceContact/server/rulesGroupService';

export async function POST(request) {
  try {
    console.log('📋 Starting rules-based group generation API call...');

    // Authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get options from request body
    const body = await request.json();
    const options = body.options || {};

    console.log(`📋 [API] User ${userId} requesting rules-based generation with options:`, options);

    // Call the rules-based service (synchronous, no background job needed)
    const result = await RulesGroupService.generateRulesBasedGroups(userId, options);

    console.log(`📋 [API] Rules-based generation completed for user ${userId}:`, {
      groupsCreated: result.groups.length,
      processingTime: result.stats?.processingTimeMs
    });

    // Return immediate response (no background job)
    return NextResponse.json({
      success: true,
      groups: result.groups,
      stats: result.stats,
      message: `Created ${result.groups.length} rules-based groups`,
      type: 'rules_based'
    });

  } catch (error) {
    console.error('❌ [API] Rules-based group generation failed:', error);
    
    return NextResponse.json({
      error: 'Failed to generate rules-based groups',
      details: error.message,
      type: 'rules_based'
    }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: 'Rules-Based Group Generation API',
    description: 'Fast, synchronous contact grouping using rules-based logic only',
    features: [
      'Company grouping (by name and email domain)',
      'Time-based grouping (rapid submission detection)',
      'Location grouping (coordinate clustering)',
      'Event grouping (submission pattern analysis)'
    ],
    costs: 'Free - no API calls or AI processing',
    processingTime: '1-5 seconds',
    requirements: 'Pro+ subscription for basic groups',
    differences: {
      vs_ai_generation: {
        cost: 'Free vs Paid',
        speed: 'Immediate vs 30-180 seconds',
        quality: 'Rule-based vs AI-enhanced',
        requirements: 'Pro+ vs Premium+'
      }
    }
  });
}