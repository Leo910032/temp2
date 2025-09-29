// app/api/auth/validate-reset-token/route.js
import { NextResponse } from 'next/server';
import { PasswordResetService } from '@/lib/services/server/passwordResetService';

export async function POST(request) {
    try {
        const { token, email } = await request.json();

        if (!token || !email) {
            return NextResponse.json(
                { valid: false, reason: 'Missing token or email' }, 
                { status: 400 }
            );
        }

        const result = await PasswordResetService.validateCustomResetToken(token, email);
        
        return NextResponse.json(result);

    } catch (error) {
        console.error('Token validation error:', error);
        return NextResponse.json(
            { valid: false, reason: 'Token validation failed' }, 
            { status: 500 }
        );
    }
}
