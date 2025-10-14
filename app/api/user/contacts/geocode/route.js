// app/api/user/contacts/geocode/route.js
// Reverse geocoding endpoint - converts coordinates to address

import { NextResponse } from 'next/server';
import { createOptimizedPlacesApiClient } from '@/lib/services/placesApiClient';

/**
 * PUBLIC endpoint for reverse geocoding
 * Converts latitude/longitude to human-readable address
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = parseFloat(searchParams.get('lat'));
    const longitude = parseFloat(searchParams.get('lng'));

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

    // Check for API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('❌ Google Maps API key not configured');
      return NextResponse.json({
        error: 'Geocoding service not configured'
      }, { status: 500 });
    }

    // Create client and perform reverse geocoding
    const placesClient = createOptimizedPlacesApiClient(apiKey);
    const addressData = await placesClient.reverseGeocode(latitude, longitude);

    console.log(`✅ Geocoding API: Found address for ${latitude}, ${longitude}`);

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
