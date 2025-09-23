
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/contacts/exchange/history/route.js
import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';

export async function GET(request) {
  /*try {
    console.log('📋 API: Getting exchange history');

    // Get user session for authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const filters = {
      status: searchParams.get('status'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')) : 0
    };

    console.log('🔍 API: Exchange history filters:', filters);

    // Get exchange history
    const result = await ExchangeService.getExchangeHistory(userId, filters);

    console.log('✅ Exchange history retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ API Error getting exchange history:', error);
*/
    return NextResponse.json(
      { 
        error: 'Failed to get exchange history',
        code: 'HISTORY_FETCH_FAILED'
      },
      { status: 500 }
    );
  }
