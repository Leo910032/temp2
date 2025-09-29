// app/api/auth/reset-password/route.js
import { NextResponse } from 'next/server';
import { PasswordResetService } from '@/lib/services/server/passwordResetService';

export async function POST(request) {
    try {
        const { token, email, newPassword } = await request.json();

        if (!token || !email || !newPassword) {
            return NextResponse.json(
                { error: 'Missing required fields' }, 
                { status: 400 }
            );
        }

        const result = await PasswordResetService.completePasswordReset(token, email, newPassword);
        
        return NextResponse.json(result);

    } catch (error) {
        console.error('Password reset completion error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to reset password' }, 
            { status: 500 }
        );
    }
}
