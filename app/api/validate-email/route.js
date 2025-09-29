import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/server/authService';
import { adminAuth } from '@/lib/firebaseAdmin';
import { 
    logSecurityEvent,
    logSuspiciousActivity,
    checkSuspiciousActivity 
} from '@/lib/services/serviceEnterprise/server/enterpriseSecurityService'; // Assuming you have this service

/**
 * Helper function to extract the real client IP address from the request headers.
 */
function getClientIP(request) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
    
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    return realIP || cfConnectingIP || request.ip || '127.0.0.1';
}

/**
 * Helper function to verify the Firebase ID token from the Authorization header.
 */
async function verifyAuthToken(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { isAuthenticated: false, user: null };
        }
        const idToken = authHeader.substring(7);
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        return { 
            isAuthenticated: true, 
            user: { uid: decodedToken.uid, email: decodedToken.email }
        };
    } catch (error) {
        // This is not an error, just an unauthenticated session.
        return { isAuthenticated: false, user: null };
    }
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = `email-${Math.random().toString(36).substring(2, 9)}`;
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    console.log(`🔵 [${requestId}] Starting email validation request from ${clientIP}`);

    // Main try block for handling unexpected server errors
    try {
        // Step 1: Verify authentication status
        const { isAuthenticated, user } = await verifyAuthToken(request);
        const userId = user?.uid || null;

        // Step 2: Proactively check for suspicious activity patterns
        const suspiciousCheck = await checkSuspiciousActivity(userId, 'EMAIL_VALIDATION', clientIP);
        if (suspiciousCheck.shouldBlock) {
            console.log(`🔴 [${requestId}] Request blocked due to suspicious activity: ${suspiciousCheck.reason}`);
            await logSecurityEvent({
                userId,
                action: 'REQUEST_BLOCKED',
                details: { endpoint: '/api/validate-email', reason: suspiciousCheck.reason, requestId },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });
            return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
        }
        if (suspiciousCheck.isSuspicious) {
            console.log(`⚠️ [${requestId}] Suspicious activity detected: ${suspiciousCheck.reason}`);
            await logSuspiciousActivity(userId, 'FREQUENT_EMAIL_VALIDATION', { reason: suspiciousCheck.reason, requestId }, clientIP, userAgent);
        }

        // Step 3: Securely parse the request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            console.log(`🔴 [${requestId}] Invalid JSON in request body`);
            await logSecurityEvent({
                userId, action: 'INVALID_REQUEST_FORMAT',
                details: { endpoint: '/api/validate-email', error: 'Invalid JSON', requestId },
                severity: 'MEDIUM', ipAddress: clientIP, userAgent
            });
            return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
        }
        const { email } = body;

        // Step 4: Validate the input
        if (!email || typeof email !== 'string') {
            console.log(`🔴 [${requestId}] Missing or invalid email in request`);
            await logSuspiciousActivity(userId, 'EMPTY_EMAIL_REQUEST', { requestId }, clientIP, userAgent);
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        console.log(`🔵 [${requestId}] Validating email: "${email.substring(0, 3)}...${email.substring(email.indexOf('@'))}"`);

        // Step 5: Call the AuthService within a dedicated try block to handle expected validation failures
        try {
            const result = await AuthService.validateEmail({ email, ip: clientIP });

            // **CRITICAL**: Log if a disposable email is detected
            if (result.isDisposable) {
                console.log(`⚠️ [${requestId}] Disposable email detected: ${email}`);
                await logSuspiciousActivity(
                    userId,
                    'DISPOSABLE_EMAIL_ATTEMPT',
                    { email: email, endpoint: '/api/validate-email', requestId },
                    clientIP,
                    userAgent
                );
            }

            const processingTime = Date.now() - startTime;
            console.log(`🟢 [${requestId}] Email validation successful. Disposable: ${result.isDisposable}, Exists: ${result.exists}`);
            
            // Log successful validation for audit purposes
            await logSecurityEvent({
                userId, action: 'EMAIL_VALIDATION_SUCCESS',
                details: { email, result, processingTime, requestId },
                severity: 'LOW', ipAddress: clientIP, userAgent
            });

            return NextResponse.json({ ...result, serverProcessed: true, requestId, processingTime });

        } catch (validationError) {
            // This block catches errors thrown by AuthService (e.g., rate limiting)
            console.log(`🔴 [${requestId}] Email validation failed: ${validationError.message}`);
            
            const isRateLimitError = validationError.message.includes('Too many requests');
            await logSecurityEvent({
                userId, action: 'EMAIL_VALIDATION_FAILURE',
                details: { email, error: validationError.message, requestId },
                severity: isRateLimitError ? 'HIGH' : 'MEDIUM',
                ipAddress: clientIP, userAgent
            });

            return NextResponse.json(
                { 
                    error: isRateLimitError ? 'Too many requests. Please wait a moment.' : 'Email validation failed',
                    serverProcessed: true,
                    requestId
                },
                { status: isRateLimitError ? 429 : 400 }
            );
        }

    } catch (error) {
        // This is the final safety net for unexpected server errors
        const processingTime = Date.now() - startTime;
        console.error(`💥 [${requestId}] CRITICAL ERROR in email validation:`, error);

        await logSecurityEvent({
            userId: null,
            action: 'INTERNAL_SERVER_ERROR',
            details: {
                endpoint: '/api/validate-email',
                error: error.message,
                stack: error.stack?.substring(0, 500),
                requestId,
                processingTime
            },
            severity: 'CRITICAL',
            ipAddress: clientIP,
            userAgent
        });

        return NextResponse.json(
            { 
                error: 'An internal server error occurred.',
                serverProcessed: true,
                requestId
            }, 
            { status: 500 }
        );
    }
}
