// app/api/auth/signup/route.js
import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/server/authService';
import { 
    logSecurityEvent,
    logSuspiciousActivity, 
    checkSuspiciousActivity 
} from '@/lib/services/serviceEnterprise/server/enterpriseSecurityService';

/**
 * Helper function to extract IP address from request
 */
function getClientIP(request) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    return realIP || cfConnectingIP || request.ip || '127.0.0.1';
}

/**
 * Simple rate limiting for signup attempts
 */
const rateLimitMap = new Map();

function checkRateLimit(ip) {
    const key = `signup:${ip}`;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 3; // Max 3 signup attempts per minute
    
    const requestData = rateLimitMap.get(key) || { count: 0, lastReset: now };
    
    if (now - requestData.lastReset > windowMs) {
        requestData.count = 0;
        requestData.lastReset = now;
    }
    
    if (requestData.count >= maxRequests) {
        return false; // Rate limited
    }
    
    requestData.count++;
    rateLimitMap.set(key, requestData);
    return true;
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    console.log(`🟢 [${requestId}] Starting signup request from ${clientIP}`);

    try {
        // Check for suspicious activity patterns before processing
        const suspiciousCheck = await checkSuspiciousActivity(
            null, // No user ID yet
            'ACCOUNT_CREATION', 
            clientIP
        );

        if (suspiciousCheck.shouldBlock) {
            console.log(`🔴 [${requestId}] Signup blocked due to suspicious activity: ${suspiciousCheck.reason}`);
            
            await logSecurityEvent({
                action: 'SIGNUP_BLOCKED',
                details: {
                    endpoint: '/api/auth/signup',
                    reason: suspiciousCheck.reason,
                    requestId
                },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Account creation temporarily blocked. Please try again later.',
                    code: 'BLOCKED_SUSPICIOUS_ACTIVITY',
                    requestId
                }, 
                { status: 429 }
            );
        }

        // Rate limiting check
        if (!checkRateLimit(clientIP)) {
            console.log(`🔴 [${requestId}] Rate limit exceeded for IP: ${clientIP}`);
            
            await logSecurityEvent({
                action: 'SIGNUP_RATE_LIMITED',
                details: {
                    endpoint: '/api/auth/signup',
                    requestId
                },
                severity: 'MEDIUM',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Too many signup attempts. Please wait a moment.',
                    code: 'RATE_LIMITED',
                    requestId
                }, 
                { status: 429 }
            );
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            console.log(`🔴 [${requestId}] Invalid JSON in request body`);
            
            await logSuspiciousActivity({
                activity: 'INVALID_SIGNUP_REQUEST',
                details: {
                    error: 'Invalid JSON',
                    endpoint: '/api/auth/signup',
                    requestId
                },
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Invalid request format',
                    code: 'INVALID_JSON',
                    requestId
                }, 
                { status: 400 }
            );
        }

        const { username, email, password } = body;

        // Validate required fields
        if (!username || !email || !password) {
            console.log(`🔴 [${requestId}] Missing required fields`);
            
            await logSuspiciousActivity({
                activity: 'INCOMPLETE_SIGNUP_DATA',
                details: {
                    missingFields: {
                        username: !username,
                        email: !email,
                        password: !password
                    },
                    endpoint: '/api/auth/signup',
                    requestId
                },
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Username, email, and password are required',
                    code: 'MISSING_FIELDS',
                    requestId
                }, 
                { status: 400 }
            );
        }

        console.log(`🟢 [${requestId}] Processing signup for: ${email}`);

        // Log warning for suspicious activity (but don't block)
        if (suspiciousCheck.isSuspicious) {
            await logSuspiciousActivity({
                activity: 'FREQUENT_SIGNUP_ATTEMPTS',
                details: {
                    reason: suspiciousCheck.reason,
                    endpoint: '/api/auth/signup',
                    email: email.substring(0, 3) + '***', // Partial email for privacy
                    requestId
                },
                ipAddress: clientIP,
                userAgent
            });
        }

        // Delegate all business logic to the AuthService
        const result = await AuthService.createStandardUser({
            username: username.trim(),
            email: email.trim(),
            password
        });

        const processingTime = Date.now() - startTime;

        // Log successful account creation
        await logSecurityEvent({
            userId: result.uid,
            action: 'ACCOUNT_CREATED',
            details: {
                username: result.user.username,
                email: result.user.email,
                accountType: result.user.accountType,
                processingTime,
                endpoint: '/api/auth/signup',
                requestId
            },
            severity: 'LOW',
            ipAddress: clientIP,
            userAgent
        });

        console.log(`🟢 [${requestId}] Signup successful:`);
        console.log(`   - UID: ${result.uid}`);
        console.log(`   - Username: ${result.user.username}`);
        console.log(`   - Email: ${result.user.email}`);
        console.log(`   - Processing time: ${processingTime}ms`);

        return NextResponse.json({
            success: true,
            customToken: result.customToken,
            uid: result.uid,
            user: {
                uid: result.uid,
                email: result.user.email,
                username: result.user.username,
                displayName: result.user.displayName,
                emailVerified: result.user.emailVerified
            },
            message: 'Account created successfully',
            processingTime,
            requestId
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        console.error(`🔴 [${requestId}] Signup error:`, error);

        // Log the error for security monitoring
        await logSecurityEvent({
            action: 'SIGNUP_ERROR',
            details: {
                error: error.message,
                stack: error.stack?.substring(0, 500),
                processingTime,
                endpoint: '/api/auth/signup',
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        // Handle specific error types with appropriate status codes
        let errorMessage = 'Failed to create account';
        let errorCode = 'SERVER_ERROR';
        let statusCode = 500;

        if (error.message.includes('Username is already taken')) {
            errorMessage = 'Username is already taken';
            errorCode = 'USERNAME_EXISTS';
            statusCode = 400; // Bad Request
        } else if (error.message.includes('Too many requests')) {
            errorMessage = 'Too many requests. Please wait a moment.';
            errorCode = 'RATE_LIMITED';
            statusCode = 429; // Too Many Requests
        } else if (error.code === 'auth/email-already-exists') {
            errorMessage = 'An account with this email already exists';
            errorCode = 'EMAIL_EXISTS';
            statusCode = 409; // Conflict
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
            errorCode = 'INVALID_EMAIL';
            statusCode = 400; // Bad Request
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password is too weak';
            errorCode = 'WEAK_PASSWORD';
            statusCode = 400; // Bad Request
        }

        // Log specific error types for pattern analysis
        if (statusCode === 409) {
            await logSuspiciousActivity({
                activity: 'DUPLICATE_ACCOUNT_ATTEMPT',
                details: {
                    errorCode,
                    endpoint: '/api/auth/signup',
                    requestId
                },
                ipAddress: clientIP,
                userAgent
            });
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
            endpoint: '/api/auth/signup',
            requiredBody: { 
                username: 'string', 
                email: 'string', 
                password: 'string' 
            },
            rateLimits: { 
                maxAttempts: 3, 
                windowMs: 60000 
            },
            timestamp: new Date().toISOString()
        }, 
        { status: 405 }
    );
}

export async function PUT() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: 'Method not allowed. Use POST.' }, 
        { status: 405 }
    );
}