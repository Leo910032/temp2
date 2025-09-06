// app/api/admin/check/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function GET(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ isAdmin: false }, { status: 200 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
        const isAdmin = adminEmails.includes(decodedToken.email.toLowerCase());
        
        return NextResponse.json({ isAdmin });
    } catch (error) {
        return NextResponse.json({ isAdmin: false }, { status: 200 });
    }
}