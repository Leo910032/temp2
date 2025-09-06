// app/api/profile/text/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Update profile text fields (displayName, bio)
 * POST /api/profile/text
 */
export async function POST(request) {
    try {
        // 1. Verify authentication
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // 2. Parse and validate request body
        const body = await request.json();
        const { action, data } = body;

        if (!action || !data) {
            return NextResponse.json({ error: 'Missing action or data' }, { status: 400 });
        }

        const docRef = adminDb.collection('AccountData').doc(userId);
        let updateData = {};

        // 3. Handle different text update actions
        switch (action) {
            case 'updateDisplayName':
                // Validate display name
                if (typeof data.displayName !== 'string') {
                    return NextResponse.json({ error: 'Display name must be a string' }, { status: 400 });
                }
                
                if (data.displayName.length > 100) {
                    return NextResponse.json({ error: 'Display name too long (max 100 characters)' }, { status: 400 });
                }

                // Basic content filtering (you can add more sophisticated filtering)
                const sanitizedDisplayName = data.displayName.trim();
                updateData = { displayName: sanitizedDisplayName };
                break;

            case 'updateBio':
                // Validate bio
                if (typeof data.bio !== 'string') {
                    return NextResponse.json({ error: 'Bio must be a string' }, { status: 400 });
                }
                
                if (data.bio.length > 500) {
                    return NextResponse.json({ error: 'Bio too long (max 500 characters)' }, { status: 400 });
                }

                const sanitizedBio = data.bio.trim();
                updateData = { bio: sanitizedBio };
                break;

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // 4. Update Firestore
        await docRef.update(updateData);

        return NextResponse.json({ 
            success: true, 
            message: 'Profile updated successfully',
            updatedFields: Object.keys(updateData)
        });

    } catch (error) {
        console.error('Profile text update error:', error);
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }

        if (error.code === 'not-found') {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}