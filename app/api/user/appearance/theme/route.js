// app/api/user/appearance/theme/route.js - FIXED with CV support

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
 * Helper function to validate color format
 */
function isValidColor(color) {
    if (!color || typeof color !== 'string') return false;
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
}

/**
 * GET /api/user/appearance/theme
 * Fetch user's appearance settings
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
        
        // ✅ FIXED: Include CV document and all essential fields
        const appearanceData = {
            // User profile fields
            username: userData.username || '',
            displayName: userData.displayName || '',
            bio: userData.bio || '',
            profilePhoto: userData.profilePhoto || '',
            
            // Appearance settings
            selectedTheme: userData.selectedTheme || 'Lake White',
            themeFontColor: userData.themeFontColor || '#000',
            themeTextColour: userData.themeTextColour || '#000',
            backgroundType: userData.backgroundType || 'Flat Colour',
            backgroundColor: userData.backgroundColor || '#e8edf5',
            backgroundImage: userData.backgroundImage || '',
            backgroundVideo: userData.backgroundVideo || '',
            gradientDirection: userData.gradientDirection || 0,
            btnType: userData.btnType || 0,
            btnColor: userData.btnColor || '#fff',
            btnFontColor: userData.btnFontColor || '#000',
            btnShadowColor: userData.btnShadowColor || '#000',
            fontType: userData.fontType || 0,
            
            // ✅ CRITICAL FIX: Include CV document
            cvDocument: userData.cvDocument || null
        };

        console.log('✅ API: Returning appearance data with username:', {
            hasUsername: !!appearanceData.username,
            username: appearanceData.username,
            hasDisplayName: !!appearanceData.displayName,
            hasCvDocument: !!appearanceData.cvDocument // ✅ Log CV document presence
        });

        return NextResponse.json(appearanceData);

    } catch (error) {
        console.error('Error fetching appearance data:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/user/appearance/theme
 * Update user's appearance settings - supports both individual actions and bulk updates
 */
export async function POST(request) {
    try {
        const { isValid, uid, error } = await verifyUserToken(request);
        if (!isValid) {
            return NextResponse.json({ error: `Unauthorized: ${error}` }, { status: 401 });
        }

        const body = await request.json();
        
        // Check if this is a bulk update (direct appearance data) or action-based update
        const isBulkUpdate = !body.action && !body.data;
        
        const userDocRef = adminDb.collection('AccountData').doc(uid);
        let updateData = {};

        if (isBulkUpdate) {
            // ✅ BULK UPDATE: Handle direct appearance data from the appearance page
            console.log('Processing bulk appearance update for user:', uid);
            
            // ✅ FIXED: Include cvDocument in allowed fields
            const allowedFields = [
                'username', 'displayName', 'bio', 'profilePhoto', // User profile fields
                'selectedTheme', 'themeFontColor', 'themeTextColour', 
                'backgroundType', 'backgroundColor', 'backgroundImage', 
                'backgroundVideo', 'gradientDirection', 'btnType', 
                'btnColor', 'btnFontColor', 'btnShadowColor', 'fontType',
                'cvDocument' // ✅ CRITICAL: Allow CV document updates
            ];
            
            updateData = {};
            for (const [key, value] of Object.entries(body)) {
                if (allowedFields.includes(key)) {
                    // Validate colors if they're color fields
                    if (['backgroundColor', 'btnColor', 'btnFontColor', 'btnShadowColor', 'themeFontColor', 'themeTextColour'].includes(key)) {
                        if (value && !isValidColor(value)) {
                            console.warn(`Invalid color format for ${key}: ${value}`);
                            continue; // Skip invalid colors
                        }
                    }
                    updateData[key] = value;
                }
            }

            if (Object.keys(updateData).length === 0) {
                return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
            }

        } else {
            // ✅ ACTION-BASED UPDATE: Handle individual theme actions (for backward compatibility)
            const { action, data } = body;

            if (!action || !data) {
                return NextResponse.json({ error: 'Missing action or data' }, { status: 400 });
            }

            console.log(`Processing theme action: ${action} for user:`, uid);

            // Handle different actions
            switch (action) {
                case 'updateTheme':
                    updateData = {
                        selectedTheme: data.theme,
                        themeFontColor: data.themeColor || '#000'
                    };
                    break;

                case 'updateBackground':
                    updateData = { backgroundType: data.type };
                    break;

                case 'updateBackgroundColor':
                    if (!isValidColor(data.color)) {
                        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
                    }
                    updateData = { backgroundColor: data.color };
                    break;

                case 'updateButton':
                    updateData = { btnType: data.btnType };
                    break;

                case 'updateButtonColor':
                    if (!isValidColor(data.color)) {
                        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
                    }
                    updateData = { btnColor: data.color };
                    break;

                case 'updateButtonFontColor':
                    if (!isValidColor(data.color)) {
                        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
                    }
                    updateData = { btnFontColor: data.color };
                    break;

                case 'updateButtonShadowColor':
                    if (!isValidColor(data.color)) {
                        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
                    }
                    updateData = { btnShadowColor: data.color };
                    break;

                case 'updateTextColor':
                    if (!isValidColor(data.color)) {
                        return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
                    }
                    updateData = { themeTextColour: data.color };
                    break;

                case 'updateGradientDirection':
                    updateData = { gradientDirection: data.direction };
                    break;

                case 'updateFont':
                    updateData = { fontType: data.fontType };
                    break;

                case 'updateChristmasAccessory':
                    updateData = { selectedTheme: data.accessoryType };
                    break;

                default:
                    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
            }
        }

        // Update the document
        await userDocRef.update(updateData);

        const responseMessage = isBulkUpdate ? 
            'Appearance updated successfully' : 
            'Theme updated successfully';

        return NextResponse.json({ 
            success: true, 
            message: responseMessage,
            updatedFields: Object.keys(updateData),
            updateType: isBulkUpdate ? 'bulk' : 'action'
        });

    } catch (error) {
        console.error('Error updating appearance:', error);
        
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

/**
 * PUT /api/user/appearance/theme
 * Batch update multiple appearance settings (alternative endpoint)
 */
export async function PUT(request) {
    // Just redirect to POST for consistency
    return POST(request);
}