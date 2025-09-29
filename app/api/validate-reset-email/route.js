// app/api/validate-reset-email/route.js
import { NextResponse } from 'next/server';
import { PasswordResetService } from '@/lib/services/server/passwordResetService';
import { 
    logSecurityEvent,
    logSuspiciousActivity, 
    checkSuspiciousActivity 
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

    console.log(`🔵 [${requestId}] Starting reset email validation from ${clientIP}`);

    try {
        // Check for suspicious activity
        const suspiciousCheck = await checkSuspiciousActivity(
            null,
            'PASSWORD_RESET_EMAIL_VALIDATION', 
            clientIP
        );

        if (suspiciousCheck.shouldBlock) {
            await logSecurityEvent({
                action: 'RESET_EMAIL_VALIDATION_BLOCKED',
                details: {
                    endpoint: '/api/validate-reset-email',
                    reason: suspiciousCheck.reason,
                    requestId
                },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Request blocked due to suspicious activity.',
                    requestId
                }, 
                { status: 429 }
            );
        }

        const body = await request.json();
        const { email } = body;

        if (!email) {
            return NextResponse.json(
                { 
                    error: 'Email is required',
                    requestId
                }, 
                { status: 400 }
            );
        }

        const result = await PasswordResetService.validateEmailForReset({
            email,
            ip: clientIP
        });

        const processingTime = Date.now() - startTime;

        // Log the validation attempt
        await logSecurityEvent({
            action: 'PASSWORD_RESET_EMAIL_VALIDATED',
            details: {
                email: email.substring(0, 3) + '***',
                exists: result.exists,
                endpoint: '/api/validate-reset-email',
                requestId
            },
            severity: 'LOW',
            ipAddress: clientIP,
            userAgent
        });

        console.log(`🟢 [${requestId}] Reset email validation completed: ${result.exists ? 'EXISTS' : 'NOT_FOUND'}`);

        return NextResponse.json({
            exists: result.exists,
            email: result.metadata.cleanEmail,
            requestId,
            processingTime
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`🔴 [${requestId}] Reset email validation error:`, error);

        await logSecurityEvent({
            action: 'PASSWORD_RESET_EMAIL_VALIDATION_ERROR',
            details: {
                error: error.message,
                endpoint: '/api/validate-reset-email',
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        if (error.message.includes('Too many requests')) {
            return NextResponse.json(
                { 
                    error: 'Too many requests. Please wait a moment.',
                    requestId,
                    processingTime
                }, 
                { status: 429 }
            );
        }

        return NextResponse.json(
            { 
                error: error.message || 'Email validation failed',
                requestId,
                processingTime
            }, 
            { status: 400 }
        );
    }
}

