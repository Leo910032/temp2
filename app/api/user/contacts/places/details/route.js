// app/api/user/contacts/places/details/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { PlacesService } from '@/lib/services/serviceContact/server/placesService';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();

    const result = await PlacesService.getPlaceDetails(userId, body);

    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[API Details Error]', error);
    return NextResponse.json({ 
        error: 'Failed to get place details', 
        details: error.message
    }, { status: 500 });
  }
}