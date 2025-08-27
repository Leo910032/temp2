// app/api/user/invitations/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function GET(request) {
    const requestId = `user-invites-${Math.random().toString(36).substring(7)}`;
    
    try {
        console.log(`[${requestId}] 🔍 Fetching pending invitations for current user.`);
        
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userEmail = decodedToken.email;

        if (!userEmail) {
            return NextResponse.json({ error: 'User email not found in token' }, { status: 400 });
        }

        console.log(`[${requestId}] 📧 User email: ${userEmail}`);

        // Query for pending invitations matching the user's email
        const invitationsSnapshot = await adminDb.collection('TeamInvitations')
            .where('invitedEmail', '==', userEmail.toLowerCase())
            .where('status', '==', 'pending')
            .get();

        if (invitationsSnapshot.empty) {
            console.log(`[${requestId}] ✅ No pending invitations found.`);
            return NextResponse.json([]); // Return empty array if none found
        }
        
        const invitations = invitationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // --- Data Enhancement ---
        // To make the banner user-friendly, let's add organization and team names.
        
        // Get unique organization IDs from all invitations
        const organizationIds = [...new Set(invitations.map(inv => inv.organizationId))];
        
        // Fetch all organization documents in a single batch
        const orgDocsPromises = organizationIds.map(id => adminDb.collection('Organizations').doc(id).get());
        const orgDocs = await Promise.all(orgDocsPromises);

        const organizationsMap = new Map();
        orgDocs.forEach(doc => {
            if (doc.exists) {
                organizationsMap.set(doc.id, doc.data());
            }
        });

        // Enhance each invitation with the org and team name
        const enhancedInvitations = invitations.map(invitation => {
            const organization = organizationsMap.get(invitation.organizationId);
            const team = organization?.teams?.[invitation.teamId];

            return {
                id: invitation.id,
                teamName: team?.name || 'an unknown team',
                organizationName: organization?.name || 'an organization',
                invitedBy: invitation.invitedBy, // You might want to fetch inviter's name later
                role: invitation.role,
                expiresAt: invitation.expiresAt,
            };
        });

        console.log(`[${requestId}] ✅ Found and enhanced ${enhancedInvitations.length} invitation(s).`);
        return NextResponse.json(enhancedInvitations);

    } catch (error) {
        console.error(`[${requestId}] 💥 Error fetching user invitations:`, error);
        if (error.code?.startsWith('auth/')) {
            return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to fetch invitations.' }, { status: 500 });
    }
}
