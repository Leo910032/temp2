// app/api/contacts/route.js
import { NextResponse } from 'next/server';
import { ContactService } from '@/lib/services/serviceContact/server/contactService';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    console.log('📋 API: Getting contacts');

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
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const filters = {
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 100,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')) : 0
    };

    console.log('🔍 API: Filters:', filters);

    // Get contacts from service
    const result = await ContactService.getUserContacts(userId, filters);

    console.log('✅ API: Contacts retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error getting contacts:', error);

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
        error: 'Failed to get contacts', 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    console.log('📝 API: Creating contact');

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
    const { action, contact } = body;

    if (action !== 'create' || !contact) {
      return NextResponse.json(
        { error: 'Invalid request format', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Create contact
    const result = await ContactService.createContact(userId, contact);

    console.log('✅ API: Contact created successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error creating contact:', error);

    if (error.message?.includes('Invalid contact data')) {
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
        error: 'Failed to create contact', 
        code: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}