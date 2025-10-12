import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { PlacesService } from '@/lib/services/serviceContact/server/placesService';

export async function POST(request) {
  try {
    // Authentication and session creation using the new architecture
    const session = await createApiSession(request);

    // Parse request body (includes: input, sessiontoken, sessionId)
    const body = await request.json();

    // Call the server-side PlacesService
    // The body automatically includes sessionId which will be used for cost tracking
    const result = await PlacesService.searchPlaces(session.userId, body);

    return NextResponse.json(result);

  } catch (error) {
    console.error('[API Autocomplete Error]', error);

    // Handle authentication errors
    if (error.message === 'Authorization required' || error.message.includes('token')) {
      return NextResponse.json({
        error: 'Unauthorized',
        details: error.message
      }, { status: 401 });
    }

    // Handle other errors
    return NextResponse.json({
      error: 'Failed to get autocomplete suggestions',
      details: error.message
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
