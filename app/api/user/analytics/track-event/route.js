// app/api/user/analytics/track-event/route.js
/**
 * New Analytics Tracking API Route
 *
 * Handles all analytics events with improved rate limiting
 * and fingerprinting to prevent abuse while being convention-friendly.
 */

import { NextResponse } from 'next/server';
import { TrackAnalyticsService } from '@/lib/services/serviceUser/server/services/trackAnalyticsService';
import { applyAnalyticsRateLimit } from '@/lib/rateLimiter';
import {
    ANALYTICS_EVENT_TYPES,
    RATE_LIMIT_CONFIG,
    ANALYTICS_ERRORS
} from '@/lib/services/serviceUser/constants/analyticsConstants';

/**
 * POST /api/user/analytics/track-event
 * Track analytics events (views, clicks, time on profile)
 */
export async function POST(request) {
    console.log('📊 Analytics API: POST request received');

    try {
        // Parse request body
        const body = await request.json();
        console.log('📊 Analytics API: Body parsed:', JSON.stringify(body).substring(0, 200));

        const {
            userId,
            username,
            eventType,
            linkData,
            sessionData,
            duration,
            timestamp
        } = body;

        console.log(`📊 Analytics API: Received ${eventType} event for user ${userId}`, {
            hasLinkData: !!linkData,
            linkId: linkData?.linkId,
            hasSessionData: !!sessionData
        });

        // --- 1. VALIDATION ---
        if (!userId || !eventType) {
            console.warn('⚠️ Analytics API: Missing required fields');
            return NextResponse.json(
                { error: ANALYTICS_ERRORS.MISSING_REQUIRED_DATA },
                { status: 400 }
            );
        }

        if (!Object.values(ANALYTICS_EVENT_TYPES).includes(eventType)) {
            console.warn('⚠️ Analytics API: Invalid event type:', eventType);
            return NextResponse.json(
                { error: ANALYTICS_ERRORS.INVALID_EVENT_TYPE },
                { status: 400 }
            );
        }

        // Validate event-specific data
        if (eventType === ANALYTICS_EVENT_TYPES.CLICK && !linkData?.linkId) {
            return NextResponse.json(
                { error: 'Link data is required for click events' },
                { status: 400 }
            );
        }

        if (eventType === ANALYTICS_EVENT_TYPES.TIME_ON_PROFILE && !duration) {
            return NextResponse.json(
                { error: 'Duration is required for time tracking events' },
                { status: 400 }
            );
        }

        // --- 2. RATE LIMITING with Fingerprinting ---
        const rateLimitConfig = RATE_LIMIT_CONFIG[eventType.toUpperCase()] || RATE_LIMIT_CONFIG.VIEW;
        const rateLimitResult = applyAnalyticsRateLimit(request, eventType, rateLimitConfig, userId);

        if (!rateLimitResult.allowed) {
            console.warn(`🚨 Analytics API: Rate limit exceeded for ${eventType}`, {
                retryAfter: rateLimitResult.retryAfter
            });

            return NextResponse.json(
                {
                    error: ANALYTICS_ERRORS.RATE_LIMIT_EXCEEDED,
                    retryAfter: rateLimitResult.retryAfter,
                    resetTime: rateLimitResult.resetTime
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': rateLimitResult.retryAfter.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
                    }
                }
            );
        }

        // Add rate limit headers to response
        const responseHeaders = {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        };

        // --- 3. PROCESS EVENT based on type ---
        let result;

        switch (eventType) {
            case ANALYTICS_EVENT_TYPES.VIEW:
                result = await TrackAnalyticsService.trackView({
                    userId,
                    username,
                    sessionData
                });
                break;

            case ANALYTICS_EVENT_TYPES.CLICK:
                result = await TrackAnalyticsService.trackClick({
                    userId,
                    linkData,
                    sessionData
                });
                break;

            case ANALYTICS_EVENT_TYPES.TIME_ON_PROFILE:
                result = await TrackAnalyticsService.trackTimeOnProfile({
                    userId,
                    duration,
                    sessionData
                });
                break;

            default:
                return NextResponse.json(
                    { error: 'Event type not supported yet' },
                    { status: 400 }
                );
        }

        console.log(`✅ Analytics API: Successfully tracked ${eventType} event`);

        return NextResponse.json(
            {
                success: true,
                message: result.message,
                eventType,
                timestamp: new Date().toISOString()
            },
            { headers: responseHeaders }
        );

    } catch (error) {
        console.error('❌ Analytics API: Error processing event:', error);
        console.error('❌ Error stack:', error.stack);

        // Don't expose internal errors to clients
        return NextResponse.json(
            {
                error: 'Failed to track event',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/user/analytics/track-event
 * Health check endpoint
 */
export async function GET(request) {
    return NextResponse.json({
        status: 'ok',
        service: 'Analytics Tracking API',
        version: '2.0',
        supportedEvents: Object.values(ANALYTICS_EVENT_TYPES),
        timestamp: new Date().toISOString()
    });
}
