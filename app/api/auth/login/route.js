import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/server/authService';
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
    const requestId = `login-${Math.random().toString(36).substring(2, 9)}`;
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    
    let usernameForLogging = 'unknown';

    try {
        console.log(`🔵 [${requestId}] Starting login request from ${clientIP}`);
        
        const { username, password } = await request.json();
        usernameForLogging = username || 'unknown';

        if (!username || !password) {
            await logSuspiciousActivity(null, 'INCOMPLETE_LOGIN_DATA', { requestId }, clientIP, userAgent);
            return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
        }

        const suspiciousCheck = await checkSuspiciousActivity(null, 'LOGIN_ATTEMPT', clientIP);
        if (suspiciousCheck.shouldBlock) {
            await logSecurityEvent({
                action: 'LOGIN_BLOCKED',
                details: { reason: suspiciousCheck.reason, username: usernameForLogging, requestId },
                severity: 'HIGH', ipAddress: clientIP, userAgent
            });
            return NextResponse.json({ error: 'Login temporarily blocked. Please try again later.' }, { status: 429 });
        }

        // ✅ UPDATED: Call the new secure login method
        const result = await AuthService.loginWithPassword({
            usernameOrEmail: username,
            password: password, // Pass the password for verification
            ip: clientIP,
            userAgent
        });

        const processingTime = Date.now() - startTime;

        await logSecurityEvent({
            userId: result.user.uid,
            action: 'LOGIN_SUCCESS',
            details: { username: result.user.username, processingTime, requestId },
            severity: 'LOW', ipAddress: clientIP, userAgent
        });

        console.log(`🟢 [${requestId}] Login successful for user ${result.user.uid}`);

        return NextResponse.json({
            customToken: result.customToken,
            user: result.user
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`🔴 [${requestId}] Login error for user "${usernameForLogging}":`, error.message);

        // This will now catch the "Invalid credentials" error from our new service method
        await logSecurityEvent({
            action: 'LOGIN_FAILURE',
            details: {
                username: usernameForLogging,
                error: error.message,
                processingTime,
                requestId
            },
            severity: 'MEDIUM',
            ipAddress: clientIP,
            userAgent
        });

        return NextResponse.json({ 
            error: 'Invalid username or password.' // Generic message for security
        }, { status: 401 });
    }
}
