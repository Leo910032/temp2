import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { BusinessCardService } from '@/lib/services/serviceContact/server/businessCardService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

/**
 * Handles POST requests to scan a business card image.
 * This route is the secure entry point for the card scanning feature.
 */
export async function POST(request) {
    try {
        // 1. Authenticate and build the session object.
        // This single function handles token verification and fetches all necessary user data.
        const session = await createApiSession(request);

        // 2. Perform permission check at the API boundary.
        // We check if the user has EITHER the basic OR the enhanced scanner feature.
        // The server-side service will determine which specific logic to run.
        const hasScannerAccess = session.permissions[CONTACT_FEATURES.BASIC_CARD_SCANNER] || 
                                 session.permissions[CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER];

        if (!hasScannerAccess) {
            console.warn(`[API /scan] Permission denied for user ${session.userId}.`);
            return NextResponse.json(
                { success: false, error: 'This feature requires a Pro subscription or higher.' }, 
                { status: 403 } // 403 Forbidden is the correct code for permission errors.
            );
        }

        // 3. Parse and validate the request body.
        const body = await request.json();
        const { imageBase64, side } = body;

        if (!imageBase64 || typeof imageBase64 !== 'string' || !side || typeof side !== 'string') {
            console.warn(`[API /scan] Invalid request for user ${session.userId}. Missing imageBase64 or side.`);
            return NextResponse.json({ success: false, error: 'Invalid request body. Missing imageBase64 or side.' }, { status: 400 });
        }

        // 4. Delegate all complex business logic to the service layer.
        // The API route doesn't know *how* the scan is done, only that it needs to be done.
        console.log(`[API /scan] Initiating scan for user ${session.userId}, side: ${side}`);
        const result = await BusinessCardService.processScanRequest({
            imageBase64,
            side,
            session // Pass the entire session object
        });

        console.log(`[API /scan] Scan successful for user ${session.userId}.`);
        return NextResponse.json(result);

    } catch (error) {
        console.error("💥 API Error in POST /api/user/contacts/scan:", error);

        // Standardized error handling
        if (error.message.includes('Authorization') || error.message.includes('token') || error.message.includes('User account not found')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('Cannot afford scan')) {
            // This is a business rule failure, not a server error.
            return NextResponse.json({ success: false, error: error.message }, { status: 402 }); // 402 Payment Required
        }
        
        // For any other errors thrown by the service, return a generic server error.
        return NextResponse.json(
            { success: false, error: 'An internal server error occurred while scanning the card.' }, 
            { status: 500 }
        );
    }
}