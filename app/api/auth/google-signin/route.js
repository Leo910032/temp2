// app/api/auth/google-signin/route.js
import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/server/authService';
import { adminAuth } from '@/lib/firebaseAdmin';

export async function POST(request) {
    const startTime = Date.now();
    const requestId = `google-signin-${Math.random().toString(36).substring(2, 9)}`;
    
    try {
        console.log(`🟡 [${requestId}] Starting Google Sign-In server processing`);
        
        // Get the Authorization header
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
        }
        
        const idToken = authHeader.replace('Bearer ', '');
        
        // Verify the Firebase ID token
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error(`🔴 [${requestId}] Invalid ID token:`, error);
            return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
        }
        
        // Get user data from request body
        const userData = await request.json();
        
        // Verify the token UID matches the provided user data
        if (decodedToken.uid !== userData.uid) {
            console.error(`🔴 [${requestId}] Token UID mismatch`);
            return NextResponse.json({ error: 'Token UID mismatch' }, { status: 401 });
        }
        
        console.log(`🟡 [${requestId}] Verified user: ${userData.email} (${userData.uid})`);
        
        // Call the server-side method to find/create user
        const result = await AuthService.findOrCreateUserForGoogleSignIn({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            emailVerified: userData.emailVerified
        });
        
        const processingTime = Date.now() - startTime;
        
        console.log(`🟢 [${requestId}] Google Sign-In server processing completed in ${processingTime}ms`);
        
        return NextResponse.json({
            success: true,
            customToken: result.customToken,
            user: result.user,
            processingTime,
            requestId
        });
        
    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error(`🔴 [${requestId}] Google Sign-In server error:`, error);
        
        return NextResponse.json({
            error: error.message || 'Internal server error',
            processingTime,
            requestId
        }, { status: 500 });
    }
}
