/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/user/links/route.js
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { LinksService } from '@/lib/services/server/serviceLinks/linksService.js';
import { rateLimit } from '@/lib/rateLimiter';

export async function GET(request) {
    try {
        const session = await createApiSession(request);

        if (!rateLimit(session.userId, 30, 60000)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }

        // The API route just calls the service, passing the session.
        const links = await LinksService.getUserLinks({ session });
        
        return NextResponse.json({ success: true, links });

    } catch (error) {
        console.error("💥 API Error in GET /api/user/links:", error.message);
        const status = error.message.includes('Authorization') || error.message.includes('token') ? 401 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}

export async function POST(request) {
    try {
        const session = await createApiSession(request);
        
        // CSRF/Rate limit checks stay at the API boundary.
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000'];
        if (!allowedOrigins.includes(origin)) {
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }
        if (!rateLimit(session.userId, 20, 60000)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }

        const body = await request.json();
        
        // The API route calls the service, passing the data and the session.
        const result = await LinksService.updateUserLinks({
            linksData: body.links,
            session: session
        });
        
        return NextResponse.json({ 
            success: true, 
            message: 'Links updated successfully.',
            count: result.count
        });

    } catch (error) {
        console.error("💥 API Error in POST /api/user/links:", error.message);
        const status = error.message.includes('Authorization') || error.message.includes('token') ? 401 : 400; // 400 for validation errors
        return NextResponse.json({ error: error.message }, { status });
    }
}