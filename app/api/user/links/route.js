//app/api/user/links/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';

// --- Enhanced Validation Function (Server-Side) ---
function validateAndSanitizeLinksArray(links) {
    if (!Array.isArray(links)) {
        throw new Error("Input must be an array.");
    }
    if (links.length > 50) {
        throw new Error("Cannot have more than 50 links.");
    }

    const seenIds = new Set();
    const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i; // Stricter URL regex

    for (const link of links) {
        // --- Structural Validation ---
        if (typeof link !== 'object' || link === null) throw new Error("Invalid link item found.");
        if (typeof link.id !== 'string' || typeof link.title !== 'string' || typeof link.isActive !== 'boolean' || typeof link.type !== 'number') {
            throw new Error(`Invalid link object structure for ID: ${link.id}`);
        }

        // --- Uniqueness and Content Validation ---
        if (seenIds.has(link.id)) throw new Error(`Duplicate link ID found: ${link.id}`);
        seenIds.add(link.id);

        if (link.type === 1) { // Type 1 is a standard link with a URL
            if (!link.url || typeof link.url !== 'string') throw new Error("URL is required for standard links.");
            if (link.url.length > 2048) throw new Error("URL exceeds maximum length of 2048 characters.");
            if (!urlRegex.test(link.url)) throw new Error(`Invalid URL format for link titled: "${link.title}"`);
        }
        
        // --- Sanitization ---
        if (link.title.length > 100) throw new Error("Link title exceeds maximum length of 100 characters.");
        // Basic sanitization: remove script tags to prevent stored XSS
        link.title = link.title.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    
    return links; // Return the validated and sanitized array
}

// ✅ NEW: GET endpoint to fetch user's links
export async function GET(request) {
    try {
        console.log('📥 GET /api/user/links - Fetching user links');

        // --- 1. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        // --- 2. Rate Limiting ---
        if (!rateLimit(uid, 30, 60000)) { // 30 requests per minute for reads
            return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 3. Fetch User Links ---
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            console.log('❌ User document not found for UID:', uid);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const links = userData.links || [];

        console.log('✅ Links fetched successfully:', links.length, 'links');
        
        return NextResponse.json({ 
            success: true, 
            links,
            count: links.length 
        });

    } catch (error) {
        console.error("💥 API Error in GET /api/user/links:", error.message);
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

// ✅ EXISTING: POST endpoint to update user's links
export async function POST(request) {
    try {
        console.log('📤 POST /api/user/links - Updating user links');

        // --- 1. CSRF Protection: Verify Origin Header ---
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000'];
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }

        // --- 2. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        // --- 3. Rate Limiting ---
        // Allow 20 link updates per user per minute.
        if (!rateLimit(uid, 20, 60000)) {
            return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 4. Data Parsing and Enhanced Validation ---
        const body = await request.json();
        console.log('📝 Validating', body.links?.length || 0, 'links');
        
        const validatedLinks = validateAndSanitizeLinksArray(body.links);

        // --- 5. Secure Database Update ---
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        await userDocRef.update({ links: validatedLinks });
        
        console.log('✅ Links updated successfully:', validatedLinks.length, 'links');
        
        return NextResponse.json({ 
            success: true, 
            message: 'Links updated successfully.',
            count: validatedLinks.length 
        });

    } catch (error) {
        console.error("💥 API Error in POST /api/user/links:", error.message);
        
        // Return specific validation errors or a generic server error
        if (error.message.includes("Input must be an array") || error.message.includes("Invalid link")) {
             return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}