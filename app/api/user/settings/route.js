/**
 * THIS FILE HAS BEEN REFACTORED
 */
// app/api/user/settings/route.js
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { SettingsService } from '@/lib/services/serviceSetting/server/settingsService.js';
import { rateLimit } from '@/lib/rateLimiter';
import { revalidateUserPage } from '@/lib/server/revalidation';

export async function GET(request) {
    try {
        const session = await createApiSession(request);

        if (!rateLimit(session.userId, 30, 60000)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }

        const settings = await SettingsService.getUserSettings({ session });
        
        return NextResponse.json(settings);

    } catch (error) {
        console.error("💥 API Error in GET /api/user/settings:", error.message);
        
        if (error.message.includes('not found')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        
        const status = error.message.includes('Authorization') || error.message.includes('token') ? 401 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}

export async function POST(request) {
    try {
        const session = await createApiSession(request);
        
        // CSRF/Rate limit checks
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000', 'http://localhost:3001'];
        if (!allowedOrigins.includes(origin)) {
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }
        
        if (!rateLimit(session.userId, 20, 60000)) {
            return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
        }

        const body = await request.json();
        
        const result = await SettingsService.updateUserSettings({
            settingsData: body,
            session: session
        });

        // Trigger on-demand revalidation of the user's public page
        const username = session.userData?.username;
        if (username) {
            await revalidateUserPage(username);
        }

        const message = result.isBulkUpdate ?
            'Settings updated successfully' :
            'Setting updated successfully';

        return NextResponse.json({
            success: true,
            message,
            updatedFields: result.updatedFields,
            updateType: result.updateType
        });

    } catch (error) {
        console.error("💥 API Error in POST /api/user/settings:", error.message);
        
        if (error.message.includes('not found')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        
        const status = error.message.includes('Authorization') || error.message.includes('token') ? 401 : 400;
        return NextResponse.json({ error: error.message }, { status });
    }
}