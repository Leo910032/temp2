// app/api/validate-username/route.js
import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/server/authService';
import { adminAuth } from '@/lib/firebaseAdmin';
import { 
    logAuthAttempt, 
    logSuspiciousActivity, 
    checkSuspiciousActivity,
    logSecurityEvent 
} from '@/lib/services/serviceEnterprise/server/enterpriseSecurityService';

/**
 * Helper function to extract IP address from request
 */
function getClientIP(request) {
    // Check various headers for the real client IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
    
    if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, get the first one
        return forwardedFor.split(',')[0].trim();
    }
    
    return realIP || cfConnectingIP || request.ip || '127.0.0.1';
}

/**
 * Helper function to verify Firebase ID token
 */
async function verifyAuthToken(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { isAuthenticated: false, user: null };
        }

        const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        
        return { 
            isAuthenticated: true, 
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                emailVerified: decodedToken.email_verified
            }
        };
    } catch (error) {
        console.log('Token verification failed:', error.message);
        return { isAuthenticated: false, user: null };
    }
}

export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';

    console.log(`🔵 [${requestId}] Starting username validation request from ${clientIP}`);

    try {
        // Verify authentication status
        const { isAuthenticated, user } = await verifyAuthToken(request);
        console.log(`🔵 [${requestId}] Authentication status: ${isAuthenticated ? 'authenticated' : 'anonymous'}`);
        
        const userId = user?.uid || null;
        const organizationId = user?.organizationId || null; // Assuming org ID might be in token claims
        
        if (isAuthenticated) {
            console.log(`🔵 [${requestId}] Authenticated user: ${user.uid} (${user.email})`);
        }

        // Check for suspicious activity patterns before processing
        const suspiciousCheck = await checkSuspiciousActivity(
            userId, 
            'USERNAME_VALIDATION', 
            clientIP, 
            organizationId
        );

        if (suspiciousCheck.shouldBlock) {
            console.log(`🔴 [${requestId}] Request blocked due to suspicious activity: ${suspiciousCheck.reason}`);
            
            await logSecurityEvent({
                userId,
                organizationId,
                action: 'REQUEST_BLOCKED',
                details: {
                    endpoint: '/api/validate-username',
                    reason: suspiciousCheck.reason,
                    ipAddress: clientIP,
                    userAgent,
                    requestId
                },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Request blocked due to suspicious activity. Please try again later.',
                    serverProcessed: true,
                    requestId
                }, 
                { status: 429 }
            );
        }

        // Log warning for suspicious but not blocked activity
        if (suspiciousCheck.isSuspicious) {
            console.log(`⚠️ [${requestId}] Suspicious activity detected: ${suspiciousCheck.reason}`);
            


// CORRECT (fix):
await logSuspiciousActivity(
    userId,
    'FREQUENT_USERNAME_VALIDATION',
    {
        reason: suspiciousCheck.reason,
        endpoint: '/api/validate-username',
        requestId
    },
    clientIP,
    userAgent
);
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (error) {
            console.log(`🔴 [${requestId}] Invalid JSON in request body`);
            
            // Log potential attack attempt
            await logSecurityEvent({
                userId,
                organizationId,
                action: 'INVALID_REQUEST_FORMAT',
                details: {
                    endpoint: '/api/validate-username',
                    error: 'Invalid JSON',
                    requestId
                },
                severity: 'MEDIUM',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Invalid JSON in request body',
                    serverProcessed: true,
                    requestId
                }, 
                { status: 400 }
            );
        }

        const { username } = body;

        if (!username) {
            console.log(`🔴 [${requestId}] Missing username in request`);
            
        // CORRECT:
await logSuspiciousActivity(
    userId,
    'EMPTY_USERNAME_REQUEST',
    {
        endpoint: '/api/validate-username',
        requestId
    },
    clientIP,
    userAgent
);
            return NextResponse.json(
                { 
                    error: 'Username is required',
                    serverProcessed: true,
                    requestId
                }, 
                { status: 400 }
            );
        }

        console.log(`🔵 [${requestId}] Validating username: "${username}"`);

        // Call the AuthService to validate username
        const dbStartTime = Date.now();
        let result;
        let validationSuccess = true;
        let validationError = null;

     // In your existing code, replace the AuthService call section with this:
try {
    result = await AuthService.validateUsername({
        username,
        ip: clientIP,
        isAuthenticated
    });
} catch (error) {
    validationSuccess = false;
    validationError = error;
    
    // Handle validation errors gracefully - DON'T re-throw
    console.log(`🔴 [${requestId}] Username validation failed: ${error.message}`);
    
    // Log validation failures for security monitoring
    await logSecurityEvent({
        userId,
        action: 'USERNAME_VALIDATION_FAILURE',
        details: {
            username: username.substring(0, 10) + '...', // Partial username for privacy
            error: error.message,
            endpoint: '/api/validate-username',
            requestId
        },
        severity: error.message.includes('Too many requests') ? 'HIGH' : 'MEDIUM',
        ipAddress: clientIP,
        userAgent
    });

    // Handle specific error types and return appropriate responses
    const processingTime = Date.now() - startTime;
    
    if (error.message.includes('Too many requests')) {
        return NextResponse.json(
            { 
                error: 'Too many requests. Please wait a moment before trying again.',
                serverProcessed: true,
                requestId,
                processingTime
            }, 
            { status: 429 }
        );
    }
    
    if (error.message.includes('Username must be between') || 
        error.message.includes('invalid characters')) {
        
        // Log potential injection attempts or malformed usernames
        await logSuspiciousActivity(
            null,
            'INVALID_USERNAME_FORMAT',
            {
                error: error.message,
                endpoint: '/api/validate-username',
                requestId
            },
            clientIP,
            userAgent
        );
        
        return NextResponse.json(
            { 
                error: error.message,
                serverProcessed: true,
                requestId,
                processingTime
            }, 
            { status: 400 }
        );
    }
    
    // For any other validation errors
    return NextResponse.json(
        { 
            error: error.message || 'Username validation failed',
            serverProcessed: true,
            requestId,
            processingTime
        }, 
        { status: 400 }
    );
}

// Only proceed with success logic if no error occurred
const dbQueryTime = Date.now() - dbStartTime;
const processingTime = Date.now() - startTime;

// Replace the problematic section in your API route with this:

// Log successful validation attempt
await logSecurityEvent({
    userId,
    action: 'USERNAME_VALIDATION_SUCCESS',
    details: {
        username: (result.metadata?.cleanUsername || username).substring(0, 10) + '...', // Safe access with fallback
        exists: result.exists,
        processingTime,
        dbQueryTime: result.metadata?.dbQueryTime || dbQueryTime,
        endpoint: '/api/validate-username',
        requestId
    },
    severity: 'LOW',
    ipAddress: clientIP,
    userAgent
});

console.log(`🟢 [${requestId}] Username validation completed:`);
console.log(`   - Username: "${result.metadata?.cleanUsername || username}"`);
console.log(`   - Exists: ${result.exists}`);
console.log(`   - DB Query Time: ${result.metadata?.dbQueryTime || dbQueryTime}ms`);
console.log(`   - Total Processing Time: ${processingTime}ms`);
console.log(`   - Rate Limit: ${result.metadata?.rateLimit?.maxRequests || 'N/A'} requests/${result.metadata?.rateLimit?.windowMs || 'N/A'}ms`);

// Return successful response
return NextResponse.json({
    exists: result.exists,
    username: result.metadata?.cleanUsername || username.trim().toLowerCase(),
    authenticated: isAuthenticated,
    user: isAuthenticated ? { uid: user.uid } : null,
    rateLimit: result.metadata?.rateLimit || { maxRequests: 30, windowMs: 60000 },
    serverProcessed: true,
    requestId,
    processingTime,
    dbQueryTime: result.metadata?.dbQueryTime || dbQueryTime
});

console.log(`🟢 [${requestId}] Username validation completed:`);
console.log(`   - Username: "${result.metadata.cleanUsername}"`);
console.log(`   - Exists: ${result.exists}`);
console.log(`   - DB Query Time: ${dbQueryTime}ms`);
console.log(`   - Total Processing Time: ${processingTime}ms`);
console.log(`   - Rate Limit: ${result.metadata.rateLimit.maxRequests} requests/${result.metadata.rateLimit.windowMs}ms`);

// Return successful response
return NextResponse.json({
    exists: result.exists,
    username: result.metadata.cleanUsername,
    authenticated: isAuthenticated,
    user: isAuthenticated ? { uid: user.uid } : null,
    rateLimit: result.metadata.rateLimit,
    serverProcessed: true,
    requestId,
    processingTime,
    dbQueryTime: result.metadata.dbQueryTime
});

    } catch (error) {
        const processingTime = Date.now() - startTime;
        
        console.error(`🔴 [${requestId}] Error in username validation:`, error);

        // Handle specific error types with appropriate logging
        if (error.message.includes('Too many requests')) {
            console.log(`🔴 [${requestId}] Rate limit exceeded`);
            
            // Log rate limit violations for security monitoring
            await logSecurityEvent({
                userId: null, // May not have user context
                action: 'RATE_LIMIT_EXCEEDED',
                details: {
                    endpoint: '/api/validate-username',
                    requestId,
                    processingTime
                },
                severity: 'HIGH',
                ipAddress: clientIP,
                userAgent
            });

            return NextResponse.json(
                { 
                    error: 'Too many requests. Please wait a moment before trying again.',
                    serverProcessed: true,
                    requestId,
                    processingTime
                }, 
                { status: 429 }
            );
        }

        if (error.message.includes('Username must be between') || 
            error.message.includes('invalid characters')) {
            console.log(`🔴 [${requestId}] Invalid username format: ${error.message}`);
            
            // Log potential injection attempts or malformed usernames
            // CORRECT:
await logSuspiciousActivity(
    null,
    'INVALID_USERNAME_FORMAT',
    {
        error: error.message,
        endpoint: '/api/validate-username',
        requestId
    },
    clientIP,
    userAgent
);
            return NextResponse.json(
                { 
                    error: error.message,
                    serverProcessed: true,
                    requestId,
                    processingTime
                }, 
                { status: 400 }
            );
        }

        // Generic server error - log as critical security event
        console.error(`🔴 [${requestId}] Internal server error:`, error);
        
        await logSecurityEvent({
            userId: null,
            action: 'INTERNAL_SERVER_ERROR',
            details: {
                endpoint: '/api/validate-username',
                error: error.message,
                stack: error.stack?.substring(0, 500), // Limited stack trace
                requestId,
                processingTime
            },
            severity: 'CRITICAL',
            ipAddress: clientIP,
            userAgent
        });

        return NextResponse.json(
            { 
                error: 'An internal server error occurred during username validation.',
                serverProcessed: true,
                requestId,
                processingTime
            }, 
            { status: 500 }
        );
    }
}

// Optional: Add GET method for health check
export async function GET() {
    return NextResponse.json({
        message: 'Username validation API is operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
}