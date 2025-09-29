import { NextResponse } from 'next/server';
import { DisposableEmailService } from '@/lib/services/server/disposableEmailService';

export async function POST(request) {
    try {
        const { strict = false } = await request.json().catch(() => ({}));
        
        console.log('Refreshing disposable email domains cache...');
        await DisposableEmailService.refreshCache(strict);
        
        const stats = DisposableEmailService.getCacheStats();
        
        return NextResponse.json({
            success: true,
            message: 'Disposable email domains cache refreshed successfully',
            stats
        });
        
    } catch (error) {
        console.error('Failed to refresh disposable email cache:', error);
        
        return NextResponse.json(
            { 
                error: 'Failed to refresh cache',
                details: error.message 
            }, 
            { status: 500 }
        );
    }
}
