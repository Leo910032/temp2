//UPDATED
// app/api/user/contacts/groups/auto-generate/route.js
import { NextResponse } from 'next/server';
import { ContactGroupService } from '@/lib/services/serviceContact/server/contactService';
import { adminAuth } from '@/lib/firebaseAdmin';
import { AutoGroupService } from '@/lib/services/serviceContact/server/autoGroupService';

export async function POST(request) {
  // ✅ FIX: Declare startTime and userId at the top of the function's scope.
  const startTime = Date.now();
  let userId = 'unknown'; // Use 'let' so it can be reassigned inside the try block.

  try {
    console.log('🤖 API: Auto-generating contact groups');

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    userId = decodedToken.uid; // Assign the actual userId

    const body = await request.json();
    const { options } = body;
    console.log(`🤖 [API Route] Received request to generate auto-groups for user: ${userId}`);

    const result = await AutoGroupService.generateAutoGroups(userId, options);
    
    const duration = Date.now() - startTime;
    console.log(`✅ [API Route] Successfully generated ${result.groups?.length || 0} groups in ${duration}ms.`);

    // This console.log is a bit redundant with the one above, but it's fine to keep.
    console.log('✅ API: Auto groups generated successfully', {
      userId,
      groupsCreated: result.groups?.length || 0
    });

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error generating auto groups:', error);
    
    // ✅ FIX: This now works because startTime is in scope.
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
    message: 'Auto-Generate Contact Groups API',
    version: '1.0',
    description: 'Automatically creates contact groups based on various criteria',
    features: [
      'Company-based grouping',
      'Location-based grouping (Premium)',
      'Time-based grouping',
      'Event-based grouping (Premium)'
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
          groupByCompany: 'boolean (default: true)',
          groupByLocation: 'boolean (default: false)',
          groupByTime: 'boolean (default: true)',
          groupByEvents: 'boolean (default: false)',
          minGroupSize: 'number (default: 2)',
          maxGroups: 'number (default: 10)'
        }
      }
    },
    subscriptionRequirements: {
      basic: ['groupByCompany', 'groupByTime'],
      premium: ['groupByLocation', 'groupByEvents']
    }
  });
}