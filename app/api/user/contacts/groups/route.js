// app/api/user/contacts/groups/route.js
import { NextResponse } from 'next/server';
import { ContactGroupService } from '@/lib/services/serviceContact/server/contactService';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    console.log('📁 API: Getting contact groups');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ API: No valid authorization header');
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const idToken = authHeader.replace('Bearer ', '');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.log('❌ API: Invalid token:', error.message);
      return NextResponse.json(
        { error: 'Invalid authentication token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log('👤 API: User ID:', userId);

    // Get contact groups from service
    const result = await ContactGroupService.getContactGroups(userId);

    console.log('✅ API: Contact groups retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error getting contact groups:', error);

    // Handle specific error types
    if (error.message?.includes('User not found')) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error.message?.includes('subscription') || error.message?.includes('plan')) {
      return NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 402 }
      );
    }

    // Generic server error
    return NextResponse.json(
      { 
        error: 'Failed to get contact groups', 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    console.log('📁 API: Creating contact group');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Extract and verify the token
    const idToken = authHeader.replace('Bearer ', '');
    
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token', code: 'INVALID_TOKEN' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { action, group } = body;

    if (action !== 'create' || !group) {
      return NextResponse.json(
        { error: 'Invalid request format', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Create contact group
    const result = await ContactGroupService.createContactGroup(userId, group);

    console.log('✅ API: Contact group created successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error creating contact group:', error);

    if (error.message?.includes('Invalid group data')) {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (error.message?.includes('limit') || error.message?.includes('subscription')) {
      return NextResponse.json(
        { error: error.message, code: 'SUBSCRIPTION_REQUIRED' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to create contact group', 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}