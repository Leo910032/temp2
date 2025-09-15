/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/user/appearance/upload/route.js - REFACTORED to use AppearanceService
import { NextResponse } from 'next/server';
import { createApiSession } from '@/lib/server/session';
import { AppearanceService } from '@/lib/services/serviceAppearance/server/appearanceService.js';
import { APPEARANCE_FEATURES } from '@/lib/services/constants'; // <-- Import constants
/**
 * Handle file uploads for profile images, background images, videos, and CV documents
 * POST /api/user/appearance/upload
 */
export async function POST(request) {
    try {
        // Step A: Create session first (security gate)
        const session = await createApiSession(request);
    // ✅ ADD an explicit permission check at the API boundary.
        // Even though the service also checks, this is best practice.
        if (!session.permissions[APPEARANCE_FEATURES.CAN_UPLOAD_FILES]) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        // Step B: Parse FormData
        const formData = await request.formData();
        const file = formData.get('file');
        const uploadType = formData.get('uploadType');

        // Basic validation
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!uploadType || !['profile', 'backgroundImage', 'backgroundVideo', 'cv'].includes(uploadType)) {
            return NextResponse.json({ error: 'Invalid upload type' }, { status: 400 });
        }

        // Step C: Delegate all work to the service
        const result = await AppearanceService.uploadFile({
            file,
            uploadType,
            session
        });

        // Step D: Return response
        return NextResponse.json(result);

    } catch (error) {
        console.error('POST /api/user/appearance/upload error:', error);
        
        // Handle specific error types
        if (error.message.includes('Unauthorized') || error.message.includes('Invalid session')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('Invalid upload type') || 
            error.message.includes('File too large') || 
            error.message.includes('Invalid file type')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes('Insufficient permissions')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({
            error: 'Upload failed due to a server error.',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}

/**
 * Delete uploaded files
 * DELETE /api/user/appearance/upload
 */
export async function DELETE(request) {
    try {
        // Step A: Create session first (security gate)
        const session = await createApiSession(request);

        // Parse request body
        const { deleteType } = await request.json();

        // Basic validation
        if (!deleteType || !['profile', 'backgroundImage', 'backgroundVideo', 'cv'].includes(deleteType)) {
            return NextResponse.json({ error: 'Invalid delete type' }, { status: 400 });
        }

        // Step C: Delegate all work to the service
        const result = await AppearanceService.deleteFile({
            deleteType,
            session
        });

        // Step D: Return response
        return NextResponse.json(result);

    } catch (error) {
        console.error('DELETE /api/user/appearance/upload error:', error);
        
        // Handle specific error types
        if (error.message.includes('Unauthorized') || error.message.includes('Invalid session')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        if (error.message.includes('Invalid delete type')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes('Insufficient permissions')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ 
            error: 'Delete failed',
            ...(process.env.NODE_ENV === 'development' && { details: error.message })
        }, { status: 500 });
    }
}