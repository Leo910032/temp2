// app/api/contacts/exchange/stats/[userId]/route.js
import { NextResponse } from 'next/server';
import { ExchangeService } from '@/lib/services/serviceContact/server/exchangeService';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/authOptions';

export async function GET(request, { params }) {
  try {
    console.log('📊 API: Getting exchange stats');

    // Get user session for authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { userId } = params;

    // Verify user can access these stats (either their own or admin)
    if (session.user.id !== userId) {
      // TODO: Add admin check if needed
      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get exchange statistics
    const stats = await ExchangeService.getExchangeStats(userId);

    console.log('✅ Exchange stats retrieved successfully');
    
    return NextResponse.json({
      success: true,
      ...stats
    });

  } catch (error) {
    console.error('❌ API Error getting exchange stats:', error);

    return NextResponse.json(
      { 
        error: 'Failed to get exchange statistics',
        code: 'STATS_FETCH_FAILED'
      },
      { status: 500 }
    );
  }
}
