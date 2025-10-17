import { QueryEnhancementService } from '@/lib/services/serviceContact/server/queryEnhancementService';

export async function POST(req) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return Response.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    console.log(`📝 [TEST] Testing query enhancement for: "${query}"`);
    
    const result = await QueryEnhancementService.enhanceQuery(query, {
      userId: 'test-user',
      sessionId: 'test-session'
    });
    
    console.log(`✅ [TEST] Enhancement complete:`, result);
    
    return Response.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('❌ [TEST] Query enhancement test failed:', error);
    return Response.json(
      { 
        success: false,
        error: error.message,
        stack: error.stack 
      },
      { status: 500 }
    );
  }
}
