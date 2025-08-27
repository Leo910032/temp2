// app/api/user/settings/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

/**
 * Verify Firebase Auth token and get user info
 */
async function verifyUserToken(request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return { isValid: false, error: 'No authorization header' };
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        return {
            isValid: true,
            uid: decodedToken.uid,
            email: decodedToken.email
        };
    } catch (error) {
        return { isValid: false, error: error.message };
    }
}

/**
 * GET /api/user/settings
 * Fetch user's settings data
 */
export async function GET(request) {
    try {
        const { isValid, uid, error } = await verifyUserToken(request);
        if (!isValid) {
            return NextResponse.json({ error: `Unauthorized: ${error}` }, { status: 401 });
        }

        const userDoc = await adminDb.collection('AccountData').doc(uid).get();
        
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        
        // Return only settings-related data
        const settingsData = {
            socials: userData.socials || [],
            socialPosition: userData.socialPosition || 0,
            supportBanner: userData.supportBanner || 0,
            supportBannerStatus: userData.supportBannerStatus || false,
            sensitiveStatus: userData.sensitiveStatus || false,
            sensitivetype: userData.sensitivetype || 3,
            metaData: userData.metaData || { title: '', description: '' },
        };

        return NextResponse.json(settingsData);

    } catch (error) {
        console.error('Error fetching settings data:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/user/settings
 * Update user's settings - supports both individual actions and bulk updates
 */
export async function POST(request) {
    try {
        const { isValid, uid, error } = await verifyUserToken(request);
        if (!isValid) {
            return NextResponse.json({ error: `Unauthorized: ${error}` }, { status: 401 });
        }

        const body = await request.json();
        
        // Check if this is a bulk update or action-based update
        const isBulkUpdate = !body.action && !body.data;
        
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        let updateData = {};

        if (isBulkUpdate) {
            // ✅ BULK UPDATE: Handle direct settings data
            console.log('Processing bulk settings update for user:', uid);
            
            // Filter out non-settings fields and only allow settings-related updates
            const allowedFields = [
                'socials', 'socialPosition', 'supportBanner', 'supportBannerStatus',
                'sensitiveStatus', 'sensitivetype', 'metaData'
            ];
            
            updateData = {};
            for (const [key, value] of Object.entries(body)) {
                if (allowedFields.includes(key)) {
                    updateData[key] = value;
                }
            }

            if (Object.keys(updateData).length === 0) {
                return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
            }

        } else {
            // ✅ ACTION-BASED UPDATE: Handle individual setting actions
            const { action, data } = body;

            if (!action || !data) {
                return NextResponse.json({ error: 'Missing action or data' }, { status: 400 });
            }

            console.log(`Processing settings action: ${action} for user:`, uid);

            // Handle different actions
            switch (action) {
                case 'updateSocials':
                    if (!Array.isArray(data.socials)) {
                        return NextResponse.json({ error: 'Socials must be an array' }, { status: 400 });
                    }
                    updateData = { socials: data.socials };
                    break;

                case 'updateSocialPosition':
                    if (typeof data.position !== 'number') {
                        return NextResponse.json({ error: 'Position must be a number' }, { status: 400 });
                    }
                    updateData = { socialPosition: data.position };
                    break;

                case 'updateSupportBanner':
                    updateData = {};
                    if (data.supportBanner !== undefined) {
                        updateData.supportBanner = data.supportBanner;
                    }
                    if (data.supportBannerStatus !== undefined) {
                        updateData.supportBannerStatus = data.supportBannerStatus;
                    }
                    break;

                case 'updateSensitiveStatus':
                    updateData = { sensitiveStatus: !!data.status };
                    break;

                case 'updateSensitiveType':
                    if (typeof data.type !== 'number') {
                        return NextResponse.json({ error: 'Sensitive type must be a number' }, { status: 400 });
                    }
                    updateData = { sensitivetype: data.type };
                    break;

                case 'updateMetaData':
                    if (typeof data.title !== 'string' || typeof data.description !== 'string') {
                        return NextResponse.json({ error: 'Title and description must be strings' }, { status: 400 });
                    }
                    updateData = { 
                        metaData: {
                            title: data.title.trim(),
                            description: data.description.trim()
                        }
                    };
                    break;

                default:
                    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
            }
        }

        // Update the document
        await userDocRef.update(updateData);

        const responseMessage = isBulkUpdate ? 
            'Settings updated successfully' : 
            'Setting updated successfully';

        return NextResponse.json({ 
            success: true, 
            message: responseMessage,
            updatedFields: Object.keys(updateData),
            updateType: isBulkUpdate ? 'bulk' : 'action'
        });

    } catch (error) {
        console.error('Error updating settings:', error);
        
        // Handle specific Firestore errors
        if (error.code === 'not-found') {
            return NextResponse.json({ error: 'User document not found' }, { status: 404 });
        }
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}