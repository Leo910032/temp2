/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/user/appearance/theme/route.js - REFACTORED to use AppearanceService
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { AppearanceService } from '@/lib/services/serviceAppearance/server/appearanceService.js';

/**
 * GET /api/user/appearance/theme
 * Fetch user's appearance settings
 */
export async function GET(request) {
    try {
        // Step A: Create session first (security gate)
        const session = await createApiSession(request);
        
        // Step C: Delegate all work to the service
        const appearanceData = await AppearanceService.getAppearance({ session });

        // Step D: Return response
        return NextResponse.json(appearanceData);

    } catch (error) {
        console.error('GET /api/user/appearance/theme error:', error);
        
        // Handle specific error types
        if (error.message.includes('Unauthorized') || error.message.includes('Invalid session')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('not found')) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}

/**
 * POST /api/user/appearance/theme
 * Update user's appearance settings - supports both individual actions and bulk updates
 * This consolidates the old /profile/text functionality
 */
export async function POST(request) {
    try {
        // Step A: Create session first (security gate)
        const session = await createApiSession(request);
        
        // Parse request body
        const body = await request.json();
        
        // Check if this is a bulk update (direct appearance data) or action-based update
        const isBulkUpdate = !body.action && !body.data;
        
        let dataToUpdate;
        
        if (isBulkUpdate) {
            // BULK UPDATE: Handle direct appearance data from the appearance page
            console.log('Processing bulk appearance update for user:', session.userId);
            dataToUpdate = body;
            
        } else {
            // ACTION-BASED UPDATE: Handle individual theme actions (for backward compatibility)
            const { action, data } = body;

            if (!action || !data) {
                return NextResponse.json({ error: 'Missing action or data' }, { status: 400 });
            }

            console.log(`Processing theme action: ${action} for user:`, session.userId);
            
            // Convert actions to data format
            dataToUpdate = this._convertActionToData(action, data);
            
            if (!dataToUpdate) {
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
            }
        }

        // Step C: Delegate all work to the service
        const result = await AppearanceService.updateAppearance({ 
            data: dataToUpdate, 
            session 
        });

        // Step D: Return response
        return NextResponse.json({
            success: true,
            message: result.message,
            updatedFields: result.updatedFields,
            updateType: isBulkUpdate ? 'bulk' : 'action'
        });

    } catch (error) {
        console.error('POST /api/user/appearance/theme error:', error);
        
        // Handle specific error types
        if (error.message.includes('Unauthorized') || error.message.includes('Invalid session')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('Validation errors')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes('No valid fields')) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        
        if (error.message.includes('Insufficient permissions')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    // Redirect to POST for consistency
    return POST(request);
}

/**
 * Helper function to convert legacy actions to data format
 * @private
 */
function _convertActionToData(action, data) {
    switch (action) {
        case 'updateTheme':
            return {
                selectedTheme: data.theme,
                themeFontColor: data.themeColor || '#000'
            };

        case 'updateBackground':
            return { backgroundType: data.type };

        case 'updateBackgroundColor':
            return { backgroundColor: data.color };

        case 'updateButton':
            return { btnType: data.btnType };

        case 'updateButtonColor':
            return { btnColor: data.color };

        case 'updateButtonFontColor':
            return { btnFontColor: data.color };

        case 'updateButtonShadowColor':
            return { btnShadowColor: data.color };

        case 'updateTextColor':
            return { themeTextColour: data.color };

        case 'updateGradientDirection':
            return { gradientDirection: data.direction };

        case 'updateFont':
            return { fontType: data.fontType };

        case 'updateChristmasAccessory':
            return { christmasAccessory: data.accessoryType };

        // Handle profile text actions (consolidated from /profile/text route)
        case 'updateDisplayName':
            return { displayName: data.displayName };

        case 'updateBio':
            return { bio: data.bio };

        default:
            return null;
    }
}