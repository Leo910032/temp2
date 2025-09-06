// app/api/user/contacts/groups/route.js
// Enhanced with proper cache invalidation and debugging

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

    // ENHANCED: Check for force refresh parameter
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('force') === 'true';
    const clearCache = url.searchParams.get('clearCache') === 'true';
    const reason = url.searchParams.get('reason') || 'unknown';

    console.log('🔄 API: Fetch options:', { forceRefresh, clearCache, reason });

    // Get contact groups from service with force option
    const result = await ContactGroupService.getContactGroups(userId, {
      force: forceRefresh || clearCache,
      clearCache: clearCache
    });

    console.log('✅ API: Contact groups retrieved successfully:', {
      groupCount: result.groups?.length || 0,
      forced: forceRefresh || clearCache,
      reason
    });

    // ENHANCED: Set cache control headers based on request type
    const headers = new Headers();
    
    if (forceRefresh || clearCache) {
      // For forced requests, prevent caching
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
    } else {
      // For normal requests, allow short-term caching
      headers.set('Cache-Control', 'private, max-age=30');
    }
    
    // Add custom headers for debugging
    headers.set('X-Groups-Count', String(result.groups?.length || 0));
    headers.set('X-Force-Refresh', String(forceRefresh));
    headers.set('X-Clear-Cache', String(clearCache));
    headers.set('X-Fetch-Reason', reason);
    headers.set('X-Timestamp', new Date().toISOString());
    
    return NextResponse.json({
      success: true,
      ...result,
      // Add metadata for debugging
      _meta: {
        fetchedAt: new Date().toISOString(),
        forced: forceRefresh || clearCache,
        reason: reason,
        groupCount: result.groups?.length || 0
      }
    }, { headers });

  } catch (error) {
    console.error('❌ API Error getting contact groups:', error);

    // Enhanced error logging
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

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
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
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

    console.log('📝 API: Group action:', { action, groupName: group?.name });

    if (action !== 'create' || !group) {
      return NextResponse.json(
        { error: 'Invalid request format', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Create contact group
    const result = await ContactGroupService.createContactGroup(userId, group);

    console.log('✅ API: Contact group created successfully:', {
      groupId: result.group?.id,
      groupName: result.group?.name
    });

    // Set cache invalidation headers for create operations
    const headers = new Headers();
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('X-Cache-Invalidated', 'true');
    headers.set('X-Operation', 'create');
    headers.set('X-Timestamp', new Date().toISOString());
    
    return NextResponse.json({
      success: true,
      ...result,
      _meta: {
        operation: 'create',
        timestamp: new Date().toISOString()
      }
    }, { headers });

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
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}