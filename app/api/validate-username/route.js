import { NextResponse } from 'next/server';
// ✅ Get the pre-initialized, server-safe Admin SDK instances
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// --- Rate Limiting (In-Memory for simplicity) ---
// For production, consider a more persistent solution like Redis.
const rateLimitMap = new Map();
setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((data, key) => {
        if (now - data.lastReset > 5 * 60 * 1000) {
            rateLimitMap.delete(key);
        }
    });
}, 5 * 60 * 1000);

function getRateLimitKey(request) {
    // Prioritize x-forwarded-for header (common in deployments like Vercel)
    const ip = request.headers.get('x-forwarded-for') ?? request.ip ?? '127.0.0.1';
    return `validate-username:${ip}`;
}

// --- Main API Handler ---
export async function POST(request) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // CRITICAL: A global try/catch block ensures you always return a JSON response,
    // preventing the HTML error page that causes "Unexpected token '<'" on the client.
    try {
        // --- 1. Rate Limiting ---
        const rateLimitKey = getRateLimitKey(request);
        const rateLimitData = rateLimitMap.get(rateLimitKey) || { count: 0, lastReset: Date.now() };
        if (Date.now() - rateLimitData.lastReset > 60000) { // 1 minute window
            rateLimitData.count = 0;
            rateLimitData.lastReset = Date.now();
        }
        if (rateLimitData.count >= 20) { // Max 20 requests per minute per IP
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }
        rateLimitData.count++;
        rateLimitMap.set(rateLimitKey, rateLimitData);

        // --- 2. Input Parsing & Validation ---
        const body = await request.json();
        const { username } = body;

        if (!username || typeof username !== 'string') {
            return NextResponse.json({ error: 'Username is required and must be a string' }, { status: 400 });
        }

        const cleanUsername = username.trim().toLowerCase();
        
        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
            return NextResponse.json({ error: 'Username must be between 3 and 30 characters' }, { status: 400 });
        }

        const validUsernameRegex = /^[a-z0-9_.-]+$/;
        if (!validUsernameRegex.test(cleanUsername)) {
            return NextResponse.json({ error: 'Username contains invalid characters' }, { status: 400 });
        }

        // --- 3. Database Query using ADMIN SDK ---
        // This is the core of the fix. We use `adminDb` which bypasses security rules.
        const dbStartTime = Date.now();
        const accountsRef = adminDb.collection("AccountData");
        const query = accountsRef.where("username", "==", cleanUsername).limit(1);
        
        // The Admin SDK uses `.get()` to execute a query
        const snapshot = await query.get();
        const exists = !snapshot.empty;
        const dbQueryTime = Date.now() - dbStartTime;

        // --- 4. Success Response ---
        const processingTime = Date.now() - startTime;
        console.log(`✅ [${requestId}] Username validation success for "${cleanUsername}". Exists: ${exists}. Time: ${processingTime}ms`);
        
        return NextResponse.json({ 
            exists,
            username: cleanUsername,
            serverProcessed: true,
            requestId,
            processingTimeMs: processingTime,
            dbQueryTimeMs: dbQueryTime,
        });

    } catch (error) {
        // --- 5. Global Error Handling ---
        console.error(`💥 [${requestId}] Internal Server Error in /api/validate-username:`, error);
        return NextResponse.json(
            { 
                error: 'An internal server error occurred during username validation.',
                serverProcessed: true,
                requestId,
            }, 
            { status: 500 }
        );
    }
}