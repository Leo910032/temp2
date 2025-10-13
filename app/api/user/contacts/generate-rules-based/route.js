// app/api/user/contacts/generate-rules-based/route.js
// Thin API endpoint for rules-based group generation (no AI, no cost tracking)

import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { RulesGroupService } from '@/lib/services/serviceContact/server/GroupService/rulesGroupService';
import { rateLimit, generateFingerprint } from '@/lib/rateLimiter';
import { CONTACT_FEATURES } from '@/lib/services/constants';

export const dynamic = 'force-dynamic';

// Rate limiting configuration for rules-based group generation
// More generous limits since this is free and fast (no AI/API costs)
const RATE_LIMIT_CONFIG = {
  maxRequests: 10,        // 10 requests per window
  windowMs: 60 * 60 * 1000, // 1 hour window
  burstAllowance: 3       // Allow burst of 3 extra during events
};

// Custom error classes for better error handling
class AuthenticationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

class PermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermissionError';
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

/**
 * POST endpoint for generating rules-based groups
 * This is a thin layer that only handles authentication and routing
 */
export async function POST(request) {
  console.log('📋 POST /api/user/contacts/generate-rules-based - Request received');

  try {
    // 1. Apply rate limiting with fingerprinting
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionId = request.headers.get('cookie')?.split(';').find(c => c.trim().startsWith('session='))?.split('=')[1];

    const fingerprint = generateFingerprint({
      ip,
      userAgent,
      sessionId,
      salt: 'rules_group_generation'
    });

    const rateLimitResult = rateLimit(fingerprint, {
      ...RATE_LIMIT_CONFIG,
      metadata: {
        eventType: 'rules_group_generation',
        ip,
        userAgent
      }
    });

    if (!rateLimitResult.allowed) {
      console.log(`🚫 Rate limit exceeded for ${ip}`);
      return NextResponse.json({
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter
      }, {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
        }
      });
    }

    // 2. Authenticate and build the session object (handles all permission checks)
    console.log('🔐 Creating API session...');
    const session = await createApiSession(request);
    console.log('✅ Session created for user:', session.userId);

    // 3. Verify user has RULES_BASED_GROUPS feature access (server-side validation)
    if (!session.permissions[CONTACT_FEATURES.RULES_BASED_GROUPS]) {
      console.log(`🚫 User ${session.userId} lacks RULES_BASED_GROUPS permission`);
      throw new PermissionError(
        `Rules-based group generation requires Pro subscription or higher. Current plan: ${session.subscriptionLevel}`
      );
    }
    console.log('✅ User has RULES_BASED_GROUPS permission');

    // 4. Parse request body
    let options = {};
    try {
      const body = await request.json();
      options = body?.options || {};
      console.log('📋 Rules-based generation options:', options);
    } catch (parseError) {
      throw new ValidationError('Invalid JSON in request body');
    }

    // 5. Call the server service to execute business logic
    console.log('📋 Calling RulesGroupService.generateRulesBasedGroups...');
    const result = await RulesGroupService.generateRulesBasedGroups(
      session.userId,
      options,
      session
    );

    if (!result || !result.success) {
      return NextResponse.json({
        error: 'Rules-based generation failed',
        code: 'GENERATION_FAILED'
      }, { status: 500 });
    }

    console.log(`✅ Rules-based generation completed for user ${session.userId}:`, {
      groupsCreated: result.groups?.length || 0,
      processingTime: result.stats?.processingTimeMs
    });

    // 6. Return immediate response with rate limit headers
    return NextResponse.json({
      success: true,
      groups: result.groups || [],
      stats: result.stats || {},
      message: `Created ${result.groups?.length || 0} rules-based groups`
    }, {
      headers: {
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
      }
    });

  } catch (error) {
    console.error('❌ API Error in POST /api/user/contacts/generate-rules-based:', error);
    console.error('❌ Error stack:', error.stack);

    // Handle custom error classes
    if (error instanceof AuthenticationError) {
      return NextResponse.json({
        error: error.message,
        code: 'UNAUTHORIZED'
      }, { status: error.statusCode });
    }

    if (error instanceof PermissionError) {
      return NextResponse.json({
        error: error.message,
        code: 'PERMISSION_DENIED'
      }, { status: error.statusCode });
    }

    if (error instanceof NotFoundError) {
      return NextResponse.json({
        error: error.message,
        code: 'NOT_FOUND'
      }, { status: error.statusCode });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({
        error: error.message,
        code: 'VALIDATION_ERROR'
      }, { status: error.statusCode });
    }

    // Handle authentication errors by string matching (for backwards compatibility)
    if (error.message.includes('Authorization') || error.message.includes('token') || error.message.includes('User account not found')) {
      console.log('🚫 Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Handle permission errors
    if (error.message.includes('subscription') || error.message.includes('permission')) {
      return NextResponse.json({
        error: 'Subscription upgrade required for rules-based group generation',
        code: 'SUBSCRIPTION_REQUIRED'
      }, { status: 403 });
    }

    // Handle no contacts error
    if (error.message.includes('not found') || error.message.includes('No contacts')) {
      return NextResponse.json({
        error: 'No contacts found for group generation',
        code: 'NO_CONTACTS_FOUND'
      }, { status: 404 });
    }

    // Generic error
    return NextResponse.json({
      error: 'Failed to generate rules-based groups',
      details: error.message,
      code: 'GENERATION_FAILED'
    }, { status: 500 });
  }
}

/**
 * GET endpoint for API information
 */
export async function GET(request) {
  try {
    console.log('📋 GET /api/user/contacts/generate-rules-based - Info endpoint');

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
      },
      endpoints: {
        POST: 'Generate rules-based groups',
        GET: 'Get API information'
      }
    });
  } catch (error) {
    console.error('❌ Error in GET /api/user/contacts/generate-rules-based:', error);

    return NextResponse.json({
      error: 'Failed to get API information',
      code: 'INFO_FAILED'
    }, { status: 500 });
  }
}
