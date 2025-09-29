// app/api/user/contacts/scan/route.js
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

/**
 * Handles POST requests to scan a business card image.
 * Supports both single-side and double-side scanning.
 */
export async function POST(request) {
    try {
        const session = await createApiSession(request);

        const hasScannerAccess = session.permissions[CONTACT_FEATURES.BASIC_CARD_SCANNER] || 
                                 session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER];

        if (!hasScannerAccess) {
            console.warn(`[API /scan] Permission denied for user ${session.userId}.`);
            return NextResponse.json(
                { success: false, error: 'This feature requires a Pro subscription or higher.' }, 
                { status: 403 }
            );
        }

        const body = await request.json();
        const { imageBase64, side, frontImage, backImage, scanMode } = body;

        let result;

        // Handle double-sided scan (both images sent together)
        if (scanMode === 'double' && frontImage && backImage) {
            console.log(`[API /scan] Processing DOUBLE-SIDED scan for user ${session.userId}`);
            
            if (typeof frontImage !== 'string' || typeof backImage !== 'string') {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Invalid image data. Both frontImage and backImage must be base64 strings.' 
                }, { status: 400 });
            }

            result = await BusinessCardService.processBothSides({
                frontImage,
                backImage,
                session
            });
        } 
        // Handle single-side scan (backward compatibility)
        else if (imageBase64 && side) {
            console.log(`[API /scan] Processing SINGLE-SIDED scan for user ${session.userId}, side: ${side}`);
            
            if (typeof imageBase64 !== 'string' || typeof side !== 'string') {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Invalid request body. Missing imageBase64 or side.' 
                }, { status: 400 });
            }

            result = await BusinessCardService.processScanRequest({
                imageBase64,
                side,
                session
            });
        } 
        else {
            return NextResponse.json({ 
                success: false, 
                error: 'Invalid request. Provide either (imageBase64 + side) or (frontImage + backImage + scanMode).' 
            }, { status: 400 });
        }

        console.log(`[API /scan] Scan successful for user ${session.userId}.`);
        return NextResponse.json(result);

    } catch (error) {
        console.error("💥 API Error in POST /api/user/contacts/scan:", error);

        if (error.message.includes('Authorization') || error.message.includes('token') || error.message.includes('User account not found')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('PLAN_LIMIT_EXCEEDED') || error.message.includes('Cannot afford scan')) {
            return NextResponse.json({ success: false, error: error.message }, { status: 402 });
        }
        
        return NextResponse.json(
            { success: false, error: 'An internal server error occurred while scanning the card.' }, 
            { status: 500 }
        );
    }
}