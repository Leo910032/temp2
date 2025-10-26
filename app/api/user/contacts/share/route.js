// app/api/user/contacts/share/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimiter';

// --- Validation Functions ---
function validateShareRequest(shareData) {
    if (!shareData || typeof shareData !== 'object') {
        throw new Error("Invalid share request data");
    }

    if (!shareData.contactIds || !Array.isArray(shareData.contactIds) || shareData.contactIds.length === 0) {
        throw new Error("Contact IDs array is required and must not be empty");
    }

    if (shareData.contactIds.length > 50) {
        throw new Error("Cannot share more than 50 contacts at once");
    }

    // Validate target members
    if (shareData.targetMembers !== 'all' && 
        (!Array.isArray(shareData.targetMembers) || shareData.targetMembers.length === 0)) {
        throw new Error("Target members must be 'all' or a non-empty array of user IDs");
    }

    return {
        contactIds: shareData.contactIds.filter(id => typeof id === 'string' && id.trim().length > 0),
        targetMembers: shareData.targetMembers,
        message: shareData.message ? shareData.message.trim() : ''
    };
}

// --- Helper Functions ---
async function getUserTeamInfo(userId) {
    const userDoc = await adminDb.collection('AccountData').doc(userId).get();
    
    if (!userDoc.exists) {
        throw new Error('User not found');
    }

    const userData = userDoc.data();
    if (!userData.teamId) {
        throw new Error('User is not in a team');
    }

    // Get team settings
    const teamDoc = await adminDb.collection('Teams').doc(userData.teamId).get();
    
    if (!teamDoc.exists) {
        throw new Error('Team not found');
    }

    const teamData = teamDoc.data();
    if (!teamData.settings?.allowContactSharing) {
        throw new Error('Contact sharing is not enabled for this team');
    }

    return { userData, teamData };
}

async function getTeamMembers(teamId, excludeUserId = null) {
    const membersSnapshot = await adminDb.collection('AccountData')
        .where('teamId', '==', teamId)
        .get();

    return membersSnapshot.docs
        .filter(doc => doc.id !== excludeUserId)
        .map(doc => ({
            userId: doc.id,
            ...doc.data()
        }));
}

async function getUserContacts(userId) {
    const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
    
    if (!contactsDoc.exists) {
        throw new Error('No contacts found');
    }

    return contactsDoc.data().contacts || [];
}

async function shareContactsWithMember(contacts, memberId, sharedBy) {
    try {
        const memberContactsRef = adminDb.collection('Contacts').doc(memberId);
        const memberContactsDoc = await memberContactsRef.get();
        
        let existingContacts = [];
        if (memberContactsDoc.exists) {
            existingContacts = memberContactsDoc.data().contacts || [];
        }

        // Prepare shared contacts
        const sharedContacts = contacts.map(contact => {
            const sharedContact = {
                id: `shared_${contact.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                originalId: contact.id,
                name: contact.name || '',
                email: contact.email || '',
                status: 'new',
                submittedAt: contact.submittedAt || new Date().toISOString(),
                isSharedContact: true,
                canEdit: false,
                sharedBy: {
                    userId: sharedBy.userId,
                    displayName: sharedBy.displayName || sharedBy.username || '',
                    username: sharedBy.username || '',
                    email: sharedBy.email || ''
                },
                sharedAt: new Date().toISOString()
            };

            // Add optional fields if they exist
            if (contact.phone) sharedContact.phone = contact.phone;
            if (contact.company) sharedContact.company = contact.company;
            if (contact.message) sharedContact.message = contact.message;
            if (contact.location) sharedContact.location = contact.location;
            if (contact.details) sharedContact.details = contact.details;

            return sharedContact;
        });

        // Filter out duplicates (by email)
        const newSharedContacts = sharedContacts.filter(sharedContact => 
            !existingContacts.some(existing => 
                existing.email === sharedContact.email && existing.isSharedContact
            )
        );

        if (newSharedContacts.length > 0) {
            const allContacts = [...existingContacts, ...newSharedContacts];
            
            await memberContactsRef.set({
                contacts: allContacts,
                lastUpdated: new Date().toISOString()
            });
        }

        return {
            memberId,
            contactsShared: newSharedContacts.length,
            duplicatesSkipped: sharedContacts.length - newSharedContacts.length
        };

    } catch (error) {
        console.error(`Failed to share contacts with member ${memberId}:`, error);
        return {
            memberId,
            contactsShared: 0,
            error: error.message
        };
    }
}

async function logTeamActivity(teamId, userId, activityType, details = {}) {
    try {
        const activityRef = adminDb.collection('TeamActivity').doc();
        await activityRef.set({
            teamId,
            userId,
            activityType,
            details,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Failed to log team activity:', error);
        // Don't throw - activity logging shouldn't break main operations
    }
}

// ✅ POST endpoint to share contacts with team members
export async function POST(request) {
    try {
        console.log('📤 POST /api/user/contacts/share - Sharing contacts with team');

        // --- 1. CSRF Protection ---
        const origin = request.headers.get('origin');
        const allowedOrigins = [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_BASE_URL, 'http://localhost:3000', 'http://localhost:3001'];
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 CSRF Warning: Request from invalid origin: ${origin}`);
            return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
        }

        // --- 2. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        // --- 3. Rate Limiting ---
        if (!rateLimit(uid, 5, 60000)) { // 5 share operations per minute
            return NextResponse.json({ error: 'Too many share requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 4. Validate Request Body ---
        const body = await request.json();
        const validatedShareData = validateShareRequest(body);

        // --- 5. Get User and Team Information ---
        const { userData, teamData } = await getUserTeamInfo(uid);

        // --- 6. Check Sharing Permissions ---
        const isManager = userData.isTeamManager || uid === teamData.managerId;
        const isMemberWithPermission = userData.teamRole === 'member' && teamData.settings?.allowMemberInvites === true;
        
        if (!isManager && !isMemberWithPermission) {
            return NextResponse.json({ 
                error: 'You do not have permission to share contacts with team members' 
            }, { status: 403 });
        }

        // --- 7. Get User's Contacts ---
        const userContacts = await getUserContacts(uid);
        
        // Filter contacts to share
        const contactsToShare = userContacts.filter(contact => 
            validatedShareData.contactIds.includes(contact.id) && !contact.isSharedContact
        );

        if (contactsToShare.length === 0) {
            return NextResponse.json({ 
                error: 'No valid contacts found to share' 
            }, { status: 400 });
        }

        // --- 8. Get Target Team Members ---
        let targetMembers = [];
        if (validatedShareData.targetMembers === 'all') {
            targetMembers = await getTeamMembers(teamData.teamId, uid);
        } else {
            const allMembers = await getTeamMembers(teamData.teamId, uid);
            targetMembers = allMembers.filter(member => 
                validatedShareData.targetMembers.includes(member.userId)
            );
        }

        if (targetMembers.length === 0) {
            return NextResponse.json({ 
                error: 'No valid team members found to share with' 
            }, { status: 400 });
        }

        // --- 9. Share Contacts with Each Member ---
        console.log(`📋 Sharing ${contactsToShare.length} contacts with ${targetMembers.length} members`);

        const sharePromises = targetMembers.map(member => 
            shareContactsWithMember(contactsToShare, member.userId, userData)
        );

        const shareResults = await Promise.all(sharePromises);

        // --- 10. Calculate Results ---
        const successfulShares = shareResults.filter(result => result.contactsShared > 0);
        const totalContactsShared = shareResults.reduce((sum, result) => sum + result.contactsShared, 0);
        const totalDuplicatesSkipped = shareResults.reduce((sum, result) => sum + (result.duplicatesSkipped || 0), 0);

        // --- 11. Log Team Activity ---
        await logTeamActivity(teamData.teamId, uid, 'contacts_shared', {
            contactCount: contactsToShare.length,
            membersSharedWith: successfulShares.length,
            totalContactsShared,
            targetMode: validatedShareData.targetMembers === 'all' ? 'all' : 'specific',
            sharedBy: userData.displayName || userData.username
        });

        // --- 12. Return Results ---
        console.log('✅ Contact sharing completed:', {
            contactsToShare: contactsToShare.length,
            membersTargeted: targetMembers.length,
            successfulShares: successfulShares.length,
            totalContactsShared,
            duplicatesSkipped: totalDuplicatesSkipped
        });

        return NextResponse.json({
            success: true,
            message: 'Contacts shared successfully',
            results: {
                contactsRequested: validatedShareData.contactIds.length,
                contactsFound: contactsToShare.length,
                membersTargeted: targetMembers.length,
                successfulShares: successfulShares.length,
                totalContactsShared,
                duplicatesSkipped: totalDuplicatesSkipped,
                shareResults: shareResults.map(result => ({
                    memberId: result.memberId,
                    contactsShared: result.contactsShared,
                    duplicatesSkipped: result.duplicatesSkipped || 0,
                    success: result.contactsShared > 0,
                    error: result.error || null
                }))
            }
        });

    } catch (error) {
        console.error("💥 API Error in POST /api/user/contacts/share:", error.message);
        
        if (error.message.includes("not found") || 
            error.message.includes("not in a team") || 
            error.message.includes("not enabled")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        
        if (error.message.includes("permission")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

// ✅ GET endpoint to check sharing permissions and get team members
export async function GET(request) {
    try {
        console.log('📥 GET /api/user/contacts/share - Getting sharing info');

        // --- 1. Authentication ---
        const authHeader = request.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const { uid } = decodedToken;

        // --- 2. Rate Limiting ---
        if (!rateLimit(uid, 30, 60000)) { // 30 requests per minute
            return NextResponse.json({ error: 'Too many requests. Please try again in a moment.' }, { status: 429 });
        }

        // --- 3. Get User and Team Information ---
        try {
            const { userData, teamData } = await getUserTeamInfo(uid);

            // --- 4. Check Permissions ---
            const isManager = userData.isTeamManager || uid === teamData.managerId;
            const isMemberWithPermission = userData.teamRole === 'member' && teamData.settings?.allowMemberInvites === true;
            const canShare = isManager || isMemberWithPermission;

            // --- 5. Get Team Members ---
            let teamMembers = [];
            if (canShare) {
                const members = await getTeamMembers(teamData.teamId, uid);
                teamMembers = members.map(member => ({
                    userId: member.userId,
                    username: member.username,
                    displayName: member.displayName,
                    email: member.email,
                    teamRole: member.teamRole,
                    profilePhoto: member.profilePhoto
                }));
            }

            console.log('✅ Sharing info retrieved:', {
                canShare,
                teamMembers: teamMembers.length,
                userRole: userData.teamRole
            });

            return NextResponse.json({
                success: true,
                canShare,
                permissions: {
                    isManager,
                    isMemberWithPermission,
                    allowContactSharing: teamData.settings?.allowContactSharing || false,
                    allowMemberInvites: teamData.settings?.allowMemberInvites || false
                },
                team: {
                    teamId: teamData.teamId,
                    teamName: teamData.teamName,
                    memberCount: teamMembers.length + 1 // +1 for current user
                },
                teamMembers,
                userRole: userData.teamRole || 'member'
            });

        } catch (teamError) {
            // User is not in a team or team doesn't allow contact sharing
            console.log('ℹ️ User not in team or sharing disabled:', teamError.message);
            
            return NextResponse.json({
                success: true,
                canShare: false,
                permissions: {
                    isManager: false,
                    isMemberWithPermission: false,
                    allowContactSharing: false,
                    allowMemberInvites: false
                },
                team: null,
                teamMembers: [],
                userRole: null,
                reason: teamError.message
            });
        }

    } catch (error) {
        console.error("💥 API Error in GET /api/user/contacts/share:", error.message);
        
        if (error.code === 'auth/id-token-expired') {
            return NextResponse.json({ error: 'Token expired' }, { status: 401 });
        }
        
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}