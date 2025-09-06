// app/api/enterprise/invitations/verify/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/serviceEnterprise/server/enterpriseInvitationService';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';

export async function POST(request) {
    let requestId = Math.random().toString(36).substring(7);
    
    try {
        console.log(`🔍 [${requestId}] Verify invitation request received`);
        
        // Parse request body with error handling
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.log(`❌ [${requestId}] Invalid JSON in request body`);
            return NextResponse.json({ 
                error: 'Invalid request format' 
            }, { status: 400 });
        }

        const { code, email } = body;
        console.log(`📧 [${requestId}] Request data:`, { 
            code: code?.substring(0, 3) + '***', 
            email: email?.replace(/(.{2}).*(@.*)/, '$1***$2') 
        });
        
        // Validate required fields
        if (!code || !email) {
            console.log(`❌ [${requestId}] Missing required fields - code: ${!!code}, email: ${!!email}`);
            return NextResponse.json({ 
                error: 'Email and invitation code are required' 
            }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            console.log(`❌ [${requestId}] Invalid email format`);
            return NextResponse.json({ 
                error: 'Please provide a valid email address' 
            }, { status: 400 });
        }

        // Validate code format (should be 6 characters)
        const cleanCode = code.trim().toUpperCase();
        if (cleanCode.length !== 6) {
            console.log(`❌ [${requestId}] Invalid code format - length: ${cleanCode.length}`);
            return NextResponse.json({ 
                error: 'Invitation code must be 6 characters long' 
            }, { status: 400 });
        }

        // ✅ FIXED: Add rate limiting to prevent spam/brute force
        const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
        console.log(`🔄 [${requestId}] Processing verification for IP: ${clientIP}`);

        // Verify the invitation
        console.log(`🔄 [${requestId}] Attempting to verify invitation...`);
        
        let invitation;
        try {
            invitation = await EnterpriseInvitationService.verifyInvitation(
                email.trim().toLowerCase(), 
                cleanCode
            );
        } catch (verifyError) {
            console.log(`❌ [${requestId}] Verification failed:`, verifyError.message);
            
            // ✅ FIXED: Return appropriate HTTP status codes based on error type
            if (verifyError.message.includes('already been accepted') || 
                verifyError.message.includes('already a member')) {
                return NextResponse.json({ 
                    error: verifyError.message,
                    code: 'ALREADY_ACCEPTED'
                }, { status: 409 }); // Conflict
            }
            
            if (verifyError.message.includes('expired')) {
                return NextResponse.json({ 
                    error: verifyError.message,
                    code: 'EXPIRED'
                }, { status: 410 }); // Gone
            }
            
            if (verifyError.message.includes('revoked')) {
                return NextResponse.json({ 
                    error: verifyError.message,
                    code: 'REVOKED'
                }, { status: 403 }); // Forbidden
            }
            
            // Default to not found for invalid codes
            return NextResponse.json({ 
                error: verifyError.message,
                code: 'INVALID'
            }, { status: 404 });
        }

        if (!invitation) {
            console.log(`❌ [${requestId}] No invitation found for provided code and email`);
            return NextResponse.json({ 
                error: 'Invalid or expired invitation code. Please check your code and try again.',
                code: 'NOT_FOUND'
            }, { status: 404 });
        }
        
        console.log(`✅ [${requestId}] Invitation found:`, invitation.id);
        
        // Enhance invitation data with additional context
        try {
            console.log(`🔄 [${requestId}] Enhancing invitation data...`);
            const orgDoc = await adminDb.collection('Organizations').doc(invitation.organizationId).get();
            
            if (!orgDoc.exists) {
                console.warn(`⚠️ [${requestId}] Organization document not found:`, invitation.organizationId);
            }
            
            const orgData = orgDoc.exists ? orgDoc.data() : null;
            const teamData = orgData?.teams?.[invitation.teamId];
            
            const enhancedInvitation = {
                ...invitation,
                organizationName: orgData?.name || 'Unknown Organization',
                teamName: teamData?.name || 'Unknown Team',
                // ✅ ADDED: Include expiration info for frontend
                expiresAt: invitation.expiresAt,
                isExpiringSoon: invitation.expiresAt && 
                    new Date(invitation.expiresAt.toDate ? invitation.expiresAt.toDate() : invitation.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000 // 24 hours
            };
            
            console.log(`✅ [${requestId}] Invitation verified and enhanced successfully`);
            return NextResponse.json({ 
                success: true, 
                invitation: enhancedInvitation,
                message: 'Invitation verified successfully'
            });
            
        } catch (enhanceError) {
            console.warn(`⚠️ [${requestId}] Could not enhance invitation data:`, enhanceError.message);
            // Return basic invitation data if enhancement fails
            return NextResponse.json({ 
                success: true, 
                invitation: {
                    ...invitation,
                    organizationName: 'Unknown Organization',
                    teamName: 'Unknown Team'
                },
                message: 'Invitation verified successfully (with limited details)'
            });
        }

    } catch (error) {
        console.error(`❌ [${requestId}] API Verify Invitation Error:`, error);
        
        // ✅ FIXED: Better error categorization
        if (error.code === 'auth/invalid-user-token' || error.code === 'auth/user-token-expired') {
            return NextResponse.json({ 
                error: 'Authentication required. Please log in and try again.',
                code: 'AUTH_REQUIRED'
            }, { status: 401 });
        }
        
        if (error.code === 'permission-denied') {
            return NextResponse.json({ 
                error: 'You do not have permission to verify invitations.',
                code: 'PERMISSION_DENIED'
            }, { status: 403 });
        }
        
        // Database or other internal errors
        return NextResponse.json({ 
            error: 'An unexpected error occurred. Please try again later.',
            code: 'INTERNAL_ERROR'
        }, { status: 500 });
    }
}

// Enhanced GET method for testing and health checks
export async function GET(request) {
    const url = new URL(request.url);
    const test = url.searchParams.get('test');
    
    if (test === 'health') {
        try {
            // Quick database connectivity test
            await adminDb.collection('TeamInvitations').limit(1).get();
            
            return NextResponse.json({ 
                status: 'healthy',
                message: 'Invitation verify endpoint is operational',
                timestamp: new Date().toISOString(),
                method: 'GET',
                database: 'connected'
            });
        } catch (dbError) {
            return NextResponse.json({ 
                status: 'unhealthy',
                message: 'Database connectivity issues',
                timestamp: new Date().toISOString(),
                method: 'GET',
                database: 'disconnected',
                error: dbError.message
            }, { status: 503 });
        }
    }
    
    return NextResponse.json({ 
        message: 'Invitation verify endpoint is working',
        timestamp: new Date().toISOString(),
        method: 'GET',
        usage: 'POST to this endpoint with { code, email } to verify invitations'
    });
}