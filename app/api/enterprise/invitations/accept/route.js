// app/api/enterprise/invitations/accept/route.js
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { EnterpriseInvitationService } from '@/lib/services/serviceEnterprise/server/enterpriseInvitationService';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';

export async function POST(request) {
    let requestId = Math.random().toString(36).substring(7);
    
    try {
        console.log(`🔄 [${requestId}] Accept invitation request received`);
        
        // Get and verify authentication token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log(`❌ [${requestId}] Missing or invalid authorization header`);
            return NextResponse.json({ 
                error: 'Authentication required. Please log in and try again.',
                code: 'AUTH_REQUIRED'
            }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
            console.log(`✅ [${requestId}] Token verified for user:`, decodedToken.uid);
        } catch (authError) {
            console.log(`❌ [${requestId}] Token verification failed:`, authError.message);
            return NextResponse.json({ 
                error: 'Invalid authentication token. Please log in again.',
                code: 'INVALID_TOKEN'
            }, { status: 401 });
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (parseError) {
            console.log(`❌ [${requestId}] Invalid JSON in request body`);
            return NextResponse.json({ 
                error: 'Invalid request format' 
            }, { status: 400 });
        }

        const { action, invitationId } = body;
        
        console.log(`📧 [${requestId}] Request data:`, { 
            action, 
            invitationId: invitationId?.substring(0, 8) + '***',
            userId: decodedToken.uid
        });
        
        // Validate required fields
        if (!action || !invitationId) {
            console.log(`❌ [${requestId}] Missing required fields - action: ${!!action}, invitationId: ${!!invitationId}`);
            return NextResponse.json({ 
                error: 'Action and invitation ID are required' 
            }, { status: 400 });
        }

        // Validate action
        if (action !== 'accept') {
            console.log(`❌ [${requestId}] Invalid action:`, action);
            return NextResponse.json({ 
                error: 'Invalid action. Only "accept" is supported.' 
            }, { status: 400 });
        }

        // ✅ FIXED: Verify invitation exists and belongs to this user before accepting
        console.log(`🔄 [${requestId}] Retrieving invitation details...`);
        const invitation = await EnterpriseInvitationService.getInvitationById(invitationId);
        
        if (!invitation) {
            console.log(`❌ [${requestId}] Invitation not found:`, invitationId);
            return NextResponse.json({ 
                error: 'Invitation not found or has been removed.',
                code: 'NOT_FOUND'
            }, { status: 404 });
        }

        // Verify the invitation email matches the authenticated user's email
        if (invitation.invitedEmail !== decodedToken.email?.toLowerCase()) {
            console.log(`❌ [${requestId}] Email mismatch - invited: ${invitation.invitedEmail}, user: ${decodedToken.email}`);
            return NextResponse.json({ 
                error: 'This invitation was not sent to your email address.',
                code: 'EMAIL_MISMATCH'
            }, { status: 403 });
        }

        // Accept the invitation
        console.log(`🔄 [${requestId}] Attempting to accept invitation...`);
        
        try {
            const result = await EnterpriseInvitationService.acceptInvitation(
                decodedToken.uid, 
                invitationId
            );
            
            console.log(`✅ [${requestId}] Invitation accepted successfully`, {
                teamId: result.teamId,
                organizationId: result.organizationId
            });
            
            return NextResponse.json({ 
                success: true,
                message: 'Welcome to the team! You have successfully joined.',
                teamId: result.teamId,
                organizationId: result.organizationId
            });
            
        } catch (acceptError) {
            console.log(`❌ [${requestId}] Accept invitation failed:`, acceptError.message);
            
            // ✅ FIXED: Handle specific acceptance errors
            if (acceptError.message.includes('already been accepted') || 
                acceptError.message.includes('already a member')) {
                return NextResponse.json({ 
                    error: acceptError.message,
                    code: 'ALREADY_MEMBER'
                }, { status: 409 }); // Conflict
            }
            
            if (acceptError.message.includes('expired')) {
                return NextResponse.json({ 
                    error: acceptError.message,
                    code: 'EXPIRED'
                }, { status: 410 }); // Gone
            }
            
            if (acceptError.message.includes('not found')) {
                return NextResponse.json({ 
                    error: acceptError.message,
                    code: 'NOT_FOUND'
                }, { status: 404 });
            }
            
            // Generic acceptance error
            return NextResponse.json({ 
                error: acceptError.message || 'Failed to accept invitation. Please try again.',
                code: 'ACCEPT_FAILED'
            }, { status: 500 });
        }

    } catch (error) {
        console.error(`❌ [${requestId}] API Accept Invitation Error:`, error);
        
        // ✅ FIXED: Better error categorization
        if (error.code === 'auth/invalid-user-token' || error.code === 'auth/user-token-expired') {
            return NextResponse.json({ 
                error: 'Authentication expired. Please log in again.',
                code: 'AUTH_EXPIRED'
            }, { status: 401 });
        }
        
        if (error.code === 'permission-denied') {
            return NextResponse.json({ 
                error: 'You do not have permission to accept invitations.',
                code: 'PERMISSION_DENIED'
            }, { status: 403 });
        }
        
        if (error.code === 'unavailable' || error.message.includes('deadline')) {
            return NextResponse.json({ 
                error: 'Service temporarily unavailable. Please try again in a moment.',
                code: 'SERVICE_UNAVAILABLE'
            }, { status: 503 });
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
            // Quick auth service test
            const testToken = request.headers.get('Authorization')?.split('Bearer ')[1];
            if (testToken) {
                await adminAuth.verifyIdToken(testToken);
                return NextResponse.json({ 
                    status: 'healthy',
                    message: 'Accept invitation endpoint is operational',
                    timestamp: new Date().toISOString(),
                    method: 'GET',
                    auth: 'connected',
                    user: 'authenticated'
                });
            } else {
                return NextResponse.json({ 
                    status: 'healthy',
                    message: 'Accept invitation endpoint is operational (no auth test)',
                    timestamp: new Date().toISOString(),
                    method: 'GET',
                    auth: 'available'
                });
            }
        } catch (authError) {
            return NextResponse.json({ 
                status: 'unhealthy',
                message: 'Authentication service issues',
                timestamp: new Date().toISOString(),
                method: 'GET',
                auth: 'disconnected',
                error: authError.message
            }, { status: 503 });
        }
    }
    
    return NextResponse.json({ 
        message: 'Accept invitation endpoint is working',
        timestamp: new Date().toISOString(),
        method: 'GET',
        usage: 'POST to this endpoint with { action: "accept", invitationId } and Bearer token to accept invitations'
    });
}