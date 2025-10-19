// app/api/user/contacts/geocode/route.js
// Reverse geocoding endpoint - converts coordinates to address
// PUBLIC endpoint for displaying locations on public profiles
// Costs are tracked against the profile owner (userId parameter)

import { NextResponse } from 'next/server';
import { createOptimizedPlacesApiClient } from '@/lib/services/placesApiClient';
import { CostTrackingService } from '@/lib/services/serviceContact/server/costTrackingService';
import { API_COSTS } from '@/lib/services/constants/apiCosts';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * PUBLIC endpoint for reverse geocoding
 * Converts latitude/longitude to human-readable address
 * Used for displaying locations on public profiles
 *
 * Query params:
 * - lat: latitude
 * - lng: longitude
 * - userId: (optional) profile owner ID for cost tracking
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('lat'));
    const longitude = parseFloat(searchParams.get('lng'));
    const userId = searchParams.get('userId'); // Profile owner to charge

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({
        error: 'Invalid coordinates. Provide lat and lng parameters.'
      }, { status: 400 });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({
        error: 'Coordinates out of valid range.'
      }, { status: 400 });
    }

    // If userId provided, check affordability for the profile owner
    if (userId) {
      const estimatedCost = API_COSTS.GOOGLE_MAPS.GEOCODING.PER_REQUEST;
      const affordabilityCheck = await CostTrackingService.canAffordOperation(
        userId,
        estimatedCost,
        1 // Requires 1 billable run
      );

      if (!affordabilityCheck.canAfford) {
        console.warn(`[API Geocoding] User ${userId} cannot afford geocoding: ${affordabilityCheck.reason}`);
        return NextResponse.json(
          {
            success: false,
            error: 'Profile owner has reached their monthly API limit',
            reason: affordabilityCheck.reason
          },
          { status: 402 } // Payment Required
        );
      }

      console.log(`[API Geocoding] Budget check passed for user ${userId}`);
    }

    // Check for API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ Google Maps API key not configured');
      return NextResponse.json({
        error: 'Geocoding service not configured'
      }, { status: 500 });
    }

    // Perform reverse geocoding
    const placesClient = createOptimizedPlacesApiClient(apiKey);
    const addressData = await placesClient.reverseGeocode(latitude, longitude);

    console.log(`✅ Geocoding API: Found address for ${latitude}, ${longitude}`);

    // Record usage if userId provided
    if (userId) {
      const actualCost = API_COSTS.GOOGLE_MAPS.GEOCODING.PER_REQUEST;

      await CostTrackingService.recordUsage({
        userId,
        usageType: 'ApiUsage',
        feature: 'google_maps_geocoding',
        cost: actualCost,
        isBillableRun: true, // Counts toward monthly API limits
        provider: 'google_maps',
        metadata: {
          latitude,
          longitude,
          addressFound: !!addressData,
          isPublicProfile: true,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`💰 [Geocoding] Tracked usage: $${actualCost} for user ${userId}`);
    } else {
      console.log(`⚠️ [Geocoding] No userId provided - cost not tracked`);
    }

    return NextResponse.json({
      success: true,
      address: addressData,
      coordinates: {
        latitude,
        longitude
      }
    });

  } catch (error) {
    console.error('❌ Geocoding API error:', error);

    // Handle specific error types
    if (error.message?.includes('quota')) {
      return NextResponse.json({
        error: 'Geocoding service quota exceeded. Please try again later.',
        code: 'QUOTA_EXCEEDED'
      }, { status: 429 });
    }

    if (error.message?.includes('No address found')) {
      return NextResponse.json({
        error: 'No address found for these coordinates.',
        code: 'NO_ADDRESS_FOUND'
      }, { status: 404 });
    }

    return NextResponse.json({
      error: 'Failed to get address for location',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
