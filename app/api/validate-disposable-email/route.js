// app/api/validate-disposable-email/route.js
import { NextResponse } from 'next/server';
import { DisposableEmailService } from '@/lib/services/server/disposableEmailService';
import { 
    logSecurityEvent,
    logSuspiciousActivity 
} from '@/lib/services/serviceEnterprise/server/enterpriseSecurityService';

function getClientIP(request) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    return realIP || cfConnectingIP || request.ip || '127.0.0.1';
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    console.log(`🔵 [${requestId}] Starting disposable email validation from ${clientIP}`);

    try {
        const body = await request.json();
        const { email, strict = false } = body;

        if (!email) {
            return NextResponse.json(
                { 
                    error: 'Email is required',
                    requestId
                }, 
                { status: 400 }
            );
        }

        console.log(`🔵 [${requestId}] Checking email: ${email.substring(0, 3)}*** (strict: ${strict})`);

        // Check if email uses disposable domain
        const result = await DisposableEmailService.isDisposableEmail(email, { strict });
        
        const processingTime = Date.now() - startTime;

        // Log disposable email detection
        if (result.isDisposable) {
            await logSuspiciousActivity(
                null, // No user ID
                'DISPOSABLE_EMAIL_DETECTED',
                {
                    domain: result.domain,
                    confidence: result.confidence,
                    strict: strict,
                    endpoint: '/api/validate-disposable-email',
                    requestId
                },
                clientIP,
                userAgent
            );
        }

        // Log the validation attempt
        await logSecurityEvent({
            action: 'DISPOSABLE_EMAIL_VALIDATED',
            details: {
                domain: result.domain,
                isDisposable: result.isDisposable,
                confidence: result.confidence,
                strict: strict,
                cacheSize: result.cacheSize,
                endpoint: '/api/validate-disposable-email',
                requestId
            },
            severity: result.isDisposable ? 'MEDIUM' : 'LOW',
            ipAddress: clientIP,
            userAgent
        });

        console.log(`🟢 [${requestId}] Disposable email check completed: ${result.isDisposable ? 'DISPOSABLE' : 'LEGITIMATE'}`);
        console.log(`   - Domain: ${result.domain}`);
        console.log(`   - Confidence: ${result.confidence}`);
        console.log(`   - Processing time: ${processingTime}ms`);

        return NextResponse.json({
            isDisposable: result.isDisposable,
            domain: result.domain,
            confidence: result.confidence,
            cacheStats: {
                size: result.cacheSize,
                age: result.cacheAge
            },
            requestId,
            processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`🔴 [${requestId}] Disposable email validation error:`, error);

        // Log the error
        await logSecurityEvent({
            action: 'DISPOSABLE_EMAIL_VALIDATION_ERROR',
            details: {
                error: error.message,
                endpoint: '/api/validate-disposable-email',
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        // Handle specific error types
        let statusCode = 500;
        let errorMessage = 'Failed to validate email against disposable domains';

        if (error.message.includes('Invalid email format')) {
            statusCode = 400;
            errorMessage = 'Invalid email format provided';
        } else if (error.message.includes('Valid email address is required')) {
            statusCode = 400;
            errorMessage = 'Valid email address is required';
        }

        return NextResponse.json(
            { 
                error: errorMessage,
                requestId,
                processingTime
            }, 
            { status: statusCode }
        );
    }
}

// GET endpoint for cache statistics
export async function GET() {
    try {
        const stats = DisposableEmailService.getCacheStats();
        
        return NextResponse.json({
            message: 'Disposable email validation service is operational',
            cacheStats: stats,
            endpoints: {
                validate: 'POST /api/validate-disposable-email',
                refresh: 'POST /api/validate-disposable-email/refresh'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        return NextResponse.json(
            { 
                error: 'Service temporarily unavailable',
                timestamp: new Date().toISOString()
            }, 
            { status: 503 }
        );
    }
}
