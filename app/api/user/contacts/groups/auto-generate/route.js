// app/api/user/contacts/groups/auto-generate/route.js
// UPDATED to use the new enhanced AutoGroupService that recreates old functionality

import { NextResponse } from 'next/server';
import { AutoGroupService } from '@/lib/services/serviceContact/server/autoGroupService';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request) {
  const startTime = Date.now();
  let userId = 'unknown';

  try {
    console.log('🤖 API: Auto-generating contact groups with ENHANCED logic');

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    userId = decodedToken.uid;

    const body = await request.json();
    const { options } = body;
    console.log(`🤖 [API Route] Received request to generate auto-groups for user: ${userId}`);

    // Use the ENHANCED AutoGroupService that recreates old functionality
    const result = await AutoGroupService.generateAutoGroups(userId, {
      ...options,
      // Ensure time-based grouping is enabled by default (like old system)
      groupByTime: options.groupByTime !== false,
      groupByCompany: options.groupByCompany !== false
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ [API Route] Successfully generated ${result.groups?.length || 0} groups in ${duration}ms.`);

    console.log('✅ API: Auto groups generated successfully', {
      userId,
      groupsCreated: result.groups?.length || 0
    });

    return NextResponse.json({
      success: true,
      groupsCreated: result.groups?.length || 0,
      newGroups: result.groups || [],
      ...result
    });

  } catch (error) {
    console.error('❌ API Error generating auto groups:', error);
    
    const duration = Date.now() - startTime;
    console.error(`❌ [API Route] Error after ${duration}ms for user ${userId}:`, error.message);

    if (error.message?.includes('subscription') || error.message?.includes('feature')) {
      return NextResponse.json({
        error: error.message,
        code: 'SUBSCRIPTION_REQUIRED'
      }, { status: 402 });
    }

    if (error.message?.includes('No contacts')) {
      return NextResponse.json({
        error: error.message,
        code: 'NO_CONTACTS'
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to generate auto groups',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

export async function GET(request) {
  return NextResponse.json({
    message: 'Enhanced Auto-Generate Contact Groups API',
    version: '2.0',
    description: 'Automatically creates contact groups using advanced email domain analysis and time-based grouping like the original system',
    features: [
      'Advanced company-based grouping with email domain analysis',
      'Time-based grouping for event contacts',
      'Location-based grouping (Premium)',
      'Intelligent merging of company name and email domain groups'
    ],
    usage: {
      method: 'POST',
      endpoint: '/api/user/contacts/groups/auto-generate',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <firebase-auth-token>'
      },
      body: {
        options: {
          groupByCompany: 'boolean (default: true) - Uses advanced email domain analysis',
          groupByTime: 'boolean (default: true) - Groups contacts added in same time window',
          groupByLocation: 'boolean (default: false)',
          groupByEvents: 'boolean (default: false)',
          minGroupSize: 'number (default: 2)',
          maxGroups: 'number (default: 10)'
        }
      }
    },
    subscriptionRequirements: {
      basic: ['groupByCompany', 'groupByTime'],
      premium: ['groupByLocation', 'groupByEvents']
    },
    enhancements: {
      emailDomainAnalysis: 'Groups contacts by business email domains (excludes gmail, yahoo, etc)',
      intelligentMerging: 'Combines company name groups with email domain groups',
      timeBased: 'Creates groups like "6/24/2025 Event" for contacts added in same time window',
      subscriptionAware: 'Respects user subscription level and feature access'
    }
  });
}