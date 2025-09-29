// ===================================================================

// app/api/auth/forgot-password/route.js
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

    console.log(`🔵 [${requestId}] Starting password reset request from ${clientIP}`);

    try {
        // Check for suspicious activity
        const suspiciousCheck = await checkSuspiciousActivity(
            null,
            'PASSWORD_RESET_REQUEST', 
            clientIP
        );

        if (suspiciousCheck.shouldBlock) {
            await logSecurityEvent({
                action: 'PASSWORD_RESET_BLOCKED',
                details: {
                    endpoint: '/api/auth/forgot-password',
                    reason: suspiciousCheck.reason,
                    requestId
                },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Password reset temporarily blocked. Please try again later.',
                    code: 'BLOCKED_SUSPICIOUS_ACTIVITY',
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
                    code: 'MISSING_EMAIL',
                    requestId
                }, 
                { status: 400 }
            );
        }

        console.log(`🔵 [${requestId}] Processing password reset for: ${email.substring(0, 3)}***`);

        // Log warning for suspicious activity (but don't block)
        if (suspiciousCheck.isSuspicious) {
            await logSuspiciousActivity(
                null,
                'FREQUENT_PASSWORD_RESET_ATTEMPTS',
                {
                    reason: suspiciousCheck.reason,
                    endpoint: '/api/auth/forgot-password',
                    email: email.substring(0, 3) + '***',
                    requestId
                },
                clientIP,
                userAgent
            );
        }

        // Initiate password reset
        const result = await PasswordResetService.initiatePasswordReset({
            email: email.trim(),
            ip: clientIP,
            userAgent
        });

        const processingTime = Date.now() - startTime;

        // Log successful password reset initiation
        await logSecurityEvent({
            action: 'PASSWORD_RESET_INITIATED',
            details: {
                email: email.substring(0, 3) + '***',
                resetId: result.resetId,
                processingTime,
                endpoint: '/api/auth/forgot-password',
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        console.log(`🟢 [${requestId}] Password reset initiated successfully:`);
        console.log(`   - Email: ${email.substring(0, 3)}***`);
        console.log(`   - Reset ID: ${result.resetId}`);
        console.log(`   - Processing time: ${processingTime}ms`);

        return NextResponse.json({
            success: true,
            message: result.message,
            resetId: result.resetId,
            // Remove resetLink in production
            resetLink: result.resetLink,
            processingTime,
            requestId
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        console.error(`🔴 [${requestId}] Password reset error:`, error);

        // Log the error
        await logSecurityEvent({
            action: 'PASSWORD_RESET_ERROR',
            details: {
                error: error.message,
                stack: error.stack?.substring(0, 500),
                processingTime,
                endpoint: '/api/auth/forgot-password',
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        // Handle specific error types
        let errorMessage = 'Failed to process password reset request';
        let errorCode = 'SERVER_ERROR';
        let statusCode = 500;

        if (error.message.includes('No account found')) {
            errorMessage = 'No account found with this email address';
            errorCode = 'EMAIL_NOT_FOUND';
            statusCode = 404;
        } else if (error.message.includes('Too many password reset attempts')) {
            errorMessage = 'Too many password reset attempts. Please try again later.';
            errorCode = 'RATE_LIMITED';
            statusCode = 429;
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Too many requests. Please wait a moment.';
            errorCode = 'RATE_LIMITED';
            statusCode = 429;
        } else if (error.message.includes('Invalid email')) {
            errorMessage = 'Please enter a valid email address';
            errorCode = 'INVALID_EMAIL';
            statusCode = 400;
        }

        return NextResponse.json(
            { 
                error: errorMessage,
                code: errorCode,
                requestId,
                processingTime
            }, 
            { status: statusCode }
        );
    }
}

// Handle other HTTP methods
export async function GET() {
    return NextResponse.json(
        { 
            error: 'Method not allowed. Use POST.',
            endpoint: '/api/auth/forgot-password',
            requiredBody: { 
                email: 'string'
            },
            rateLimits: { 
                maxAttempts: 3, 
                windowMs: 3600000 // 1 hour
            },
            timestamp: new Date().toISOString()
        }, 
        { status: 405 }
    );
}
