import { NextResponse } from 'next/server';
import { createApiSession, SessionManager } from '@/lib/server/session';
import { PlacesService } from '@/lib/services/serviceContact/server/GroupService/placesService';
import { API_COSTS } from '@/lib/services/constants/apiCosts';

export async function POST(request) {
  try {
    // Authentication and session creation using the new architecture
    const session = await createApiSession(request);
    const sessionManager = new SessionManager(session);

    // Parse request body (includes: latitude, longitude, radius, keywords, sessionId)
    const body = await request.json();

    // Pre-flight budget check for Google Maps Nearby Search API
    const estimatedCost = API_COSTS.GOOGLE_MAPS.PLACES_NEARBY_SEARCH.PER_REQUEST;
    const affordabilityCheck = await sessionManager.canAffordOperation(
      estimatedCost,
      true, // Nearby Search counts as a billable API operation
      'ApiUsage'
    );

    if (!affordabilityCheck.allowed) {
      console.warn(`[API Venue Enrichment] User ${session.userId} cannot afford: ${affordabilityCheck.reason}`);
      return NextResponse.json(
        {
          success: false,
          error: affordabilityCheck.message || 'Monthly API limit reached',
          reason: affordabilityCheck.reason,
          budget: affordabilityCheck.budget,
          upgradeRequired: affordabilityCheck.upgradeRequired,
          nextTier: affordabilityCheck.nextTier
        },
        { status: 402 } // Payment Required
      );
    }

    console.log(`[API Venue Enrichment] Budget check passed - proceeding with venue search`);

    // Call the server-side PlacesService
    // The body automatically includes sessionId which will be used for cost tracking
    const result = await PlacesService.searchNearbyVenues(session.userId, body);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API Venue Enrichment Error]', error);

    // Handle authentication errors
    if (error.message === 'Authorization required' || error.message.includes('token')) {
      return NextResponse.json({
        error: 'Unauthorized',
        details: error.message
      }, { status: 401 });
    }

    // Handle other errors
    return NextResponse.json({
      error: 'Failed to search for nearby venues',
      details: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
