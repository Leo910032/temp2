/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/enterprise/organizations/route.js
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { hasEnterpriseAccess } from '@/lib/services/serviceEnterprise/client/enterpriseSubscriptionService.js';

// Rate limiting for organization operations
const rateLimitMap = new Map();

function getRateLimitKey(request, userId) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    return `org_ops:${userId}:${ip}`;
}

function isRateLimited(key) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10; // Max 10 org operations per minute
    
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, lastReset: now });
        return false;
    }
    
    const data = rateLimitMap.get(key);
    
    if (now - data.lastReset > windowMs) {
        data.count = 1;
        data.lastReset = now;
        return false;
    }
    
    if (data.count >= maxRequests) {
        return true;
    }
    
    data.count++;
    return false;
}

// Helper function to validate organization data
function validateOrganizationData(orgData) {
    const errors = [];
    
    if (!orgData.name || orgData.name.trim().length < 2) {
        errors.push('Organization name must be at least 2 characters');
    }
    
    if (!orgData.domain || !/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(orgData.domain)) {
        errors.push('Valid domain is required');
    }
    
    if (orgData.billing?.maxSeats && orgData.billing.maxSeats < 1) {
        errors.push('Maximum seats must be at least 1');
    }
    
    return errors;
}

// Helper function to check if user can manage organizations
async function canManageOrganizations(userId) {
    // Only admin users can create/delete organizations
    // Regular enterprise users can only update their own organization
    try {
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        const userData = userDoc.data();
        
        return userData?.isAdmin || userData?.enterprise?.organizationRole === 'owner';
    } catch (error) {
        console.error('Error checking organization management permissions:', error);
        return false;
    }
}

// ✅ GET - Get organization details
export async function GET(request) {
    try {
        console.log('🏢 GET /api/enterprise/organizations - Getting organization details');

        // Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Get organization ID from query params
        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get('orgId');

        if (!orgId) {
            return NextResponse.json({ 
                error: 'Organization ID is required' 
            }, { status: 400 });
        }

        // Check user's subscription and enterprise access
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        if (!hasEnterpriseAccess(userData.accountType)) {
            return NextResponse.json({
                error: 'Enterprise features require Business or Enterprise subscription',
                subscriptionRequired: true,
                currentPlan: userData.accountType,
                requiredPlan: 'business'
            }, { status: 403 });
        }

        // Verify user has access to this organization
        const userOrgId = userData.enterprise?.organizationId;
        if (userOrgId !== orgId && !userData.isAdmin) {
            return NextResponse.json({ 
                error: 'Access denied to this organization' 
            }, { status: 403 });
        }

        // Get organization data
        const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ 
                error: 'Organization not found' 
            }, { status: 404 });
        }

        const orgData = orgDoc.data();
        
        // Calculate organization statistics
        const stats = {
            totalMembers: 0,
            totalTeams: Object.keys(orgData.teams || {}).length,
            activeMembers: 0,
            pendingInvitations: 0
        };

        // Count members across all teams
        for (const team of Object.values(orgData.teams || {})) {
            stats.totalMembers += Object.keys(team.members || {}).length;
        }

        // Get pending invitations count
        const invitationsQuery = await adminDb.collection('TeamInvitations')
            .where('organizationId', '==', orgId)
            .where('status', '==', 'pending')
            .get();
        stats.pendingInvitations = invitationsQuery.size;

        console.log('✅ Organization details retrieved:', {
            orgId,
            orgName: orgData.name,
            totalTeams: stats.totalTeams,
            totalMembers: stats.totalMembers
        });

        return NextResponse.json({
            success: true,
            organization: {
                id: orgId,
                ...orgData,
                stats
            }
        });

    } catch (error) {
        console.error('❌ Error getting organization details:', error);
        return NextResponse.json({ 
            error: 'Failed to get organization details' 
        }, { status: 500 });
    }
}

// ✅ POST - Create new organization (admin only)
export async function POST(request) {
    try {
        console.log('🏢 POST /api/enterprise/organizations - Creating organization');

        // Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Rate limiting
        const rateLimitKey = getRateLimitKey(request, userId);
        if (isRateLimited(rateLimitKey)) {
            return NextResponse.json({ 
                error: 'Too many organization operations. Please wait.' 
            }, { status: 429 });
        }

        // Check if user can create organizations (admin only)
        if (!await canManageOrganizations(userId)) {
            return NextResponse.json({ 
                error: 'Only administrators can create organizations' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { name, domain, subscriptionLevel = 'business', billing = {}, settings = {} } = body;

        // Validate organization data
        const validationErrors = validateOrganizationData({ name, domain, billing });
        if (validationErrors.length > 0) {
            return NextResponse.json({ 
                error: 'Validation failed',
                details: validationErrors 
            }, { status: 400 });
        }

        // Check if domain already exists
        const existingOrgQuery = await adminDb.collection('Organizations')
            .where('domain', '==', domain.toLowerCase())
            .limit(1)
            .get();

        if (!existingOrgQuery.empty) {
            return NextResponse.json({ 
                error: 'An organization with this domain already exists' 
            }, { status: 409 });
        }

        // Generate organization ID
        const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create organization document
        const organizationData = {
            name: name.trim(),
            domain: domain.toLowerCase(),
            subscriptionLevel,
            createdAt: FieldValue.serverTimestamp(),
            billing: {
                maxSeats: billing.maxSeats || 10,
                currentSeats: 0,
                subscriptionId: billing.subscriptionId || null,
                billingEmail: billing.billingEmail || ''
            },
            settings: {
                dataRetentionDays: settings.dataRetentionDays || 365,
                allowEmployeeDataExport: settings.allowEmployeeDataExport || false,
                requireManagerApprovalForSharing: settings.requireManagerApprovalForSharing || true,
                allowCrossTeamSharing: settings.allowCrossTeamSharing || false,
                auditLogRetentionDays: settings.auditLogRetentionDays || 730
            },
            industry: body.industry || 'technology',
            country: body.country || 'US',
            verificationStatus: 'pending',
            verifiedBy: null,
            verifiedAt: null,
            teams: {} // Will be populated when teams are created
        };

        await adminDb.collection('Organizations').doc(orgId).set(organizationData);

        console.log('✅ Organization created:', {
            orgId,
            name: organizationData.name,
            domain: organizationData.domain,
            createdBy: userId
        });

        return NextResponse.json({
            success: true,
            organizationId: orgId,
            organization: {
                id: orgId,
                ...organizationData,
                createdAt: new Date().toISOString() // Convert for JSON
            },
            message: 'Organization created successfully'
        });

    } catch (error) {
        console.error('❌ Error creating organization:', error);
        return NextResponse.json({ 
            error: 'Failed to create organization' 
        }, { status: 500 });
    }
}

// ✅ PUT - Update organization settings
export async function PUT(request) {
    try {
        console.log('🏢 PUT /api/enterprise/organizations - Updating organization');

        // Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Rate limiting
        const rateLimitKey = getRateLimitKey(request, userId);
        if (isRateLimited(rateLimitKey)) {
            return NextResponse.json({ 
                error: 'Too many organization operations. Please wait.' 
            }, { status: 429 });
        }

        const body = await request.json();
        const { organizationId, updates } = body;

        if (!organizationId) {
            return NextResponse.json({ 
                error: 'Organization ID is required' 
            }, { status: 400 });
        }

        // Check user permissions
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userData = userDoc.data();
        const userOrgId = userData.enterprise?.organizationId;
        const userRole = userData.enterprise?.organizationRole;

        // User must be owner/manager of the organization or admin
        if (userOrgId !== organizationId && !userData.isAdmin) {
            return NextResponse.json({ 
                error: 'Access denied to this organization' 
            }, { status: 403 });
        }

        if (!['owner', 'manager'].includes(userRole) && !userData.isAdmin) {
            return NextResponse.json({ 
                error: 'Insufficient permissions to update organization' 
            }, { status: 403 });
        }

        // Get existing organization
        const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ 
                error: 'Organization not found' 
            }, { status: 404 });
        }

        // Validate updates
        const allowedFields = ['name', 'settings', 'billing', 'industry', 'country'];
        const sanitizedUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                sanitizedUpdates[key] = value;
            }
        }

        // Special validation for critical fields
        if (sanitizedUpdates.name && sanitizedUpdates.name.trim().length < 2) {
            return NextResponse.json({ 
                error: 'Organization name must be at least 2 characters' 
            }, { status: 400 });
        }

        // Add last modified timestamp
        sanitizedUpdates.lastModified = FieldValue.serverTimestamp();

        // Update organization
        await adminDb.collection('Organizations').doc(organizationId).update(sanitizedUpdates);

        console.log('✅ Organization updated:', {
            organizationId,
            updatedFields: Object.keys(sanitizedUpdates),
            updatedBy: userId
        });

        return NextResponse.json({
            success: true,
            message: 'Organization updated successfully',
            updatedFields: Object.keys(sanitizedUpdates)
        });

    } catch (error) {
        console.error('❌ Error updating organization:', error);
        return NextResponse.json({ 
            error: 'Failed to update organization' 
        }, { status: 500 });
    }
}

// ✅ DELETE - Delete organization (admin only)
export async function DELETE(request) {
    try {
        console.log('🏢 DELETE /api/enterprise/organizations - Deleting organization');

        // Authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Rate limiting
        const rateLimitKey = getRateLimitKey(request, userId);
        if (isRateLimited(rateLimitKey)) {
            return NextResponse.json({ 
                error: 'Too many organization operations. Please wait.' 
            }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('orgId');

        if (!organizationId) {
            return NextResponse.json({ 
                error: 'Organization ID is required' 
            }, { status: 400 });
        }

        // Check if user can delete organizations (admin only)
        if (!await canManageOrganizations(userId)) {
            return NextResponse.json({ 
                error: 'Only administrators can delete organizations' 
            }, { status: 403 });
        }

        // Get organization to verify it exists
        const orgDoc = await adminDb.collection('Organizations').doc(organizationId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ 
                error: 'Organization not found' 
            }, { status: 404 });
        }

        const orgData = orgDoc.data();

        // Check if organization has members (safety check)
        let totalMembers = 0;
        for (const team of Object.values(orgData.teams || {})) {
            totalMembers += Object.keys(team.members || {}).length;
        }

        if (totalMembers > 0) {
            return NextResponse.json({ 
                error: 'Cannot delete organization with active members. Remove all members first.' 
            }, { status: 400 });
        }

        // Delete related data in a batch
        const batch = adminDb.batch();

        // Delete organization document
        batch.delete(adminDb.collection('Organizations').doc(organizationId));

        // Delete pending invitations
        const invitationsQuery = await adminDb.collection('TeamInvitations')
            .where('organizationId', '==', organizationId)
            .get();

        invitationsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Execute batch delete
        await batch.commit();

        // Update users who were part of this organization
        const usersQuery = await adminDb.collection('AccountData')
            .where('enterprise.organizationId', '==', organizationId)
            .get();

        const userUpdatePromises = usersQuery.docs.map(userDoc => {
            return userDoc.ref.update({
                'enterprise.organizationId': null,
                'enterprise.organizationRole': 'employee',
                'enterprise.teams': {}
            });
        });

        await Promise.all(userUpdatePromises);

        console.log('✅ Organization deleted:', {
            organizationId,
            orgName: orgData.name,
            deletedBy: userId,
            invitationsDeleted: invitationsQuery.size,
            usersUpdated: usersQuery.size
        });

        return NextResponse.json({
            success: true,
            message: 'Organization deleted successfully',
            details: {
                invitationsDeleted: invitationsQuery.size,
                usersUpdated: usersQuery.size
            }
        });

    } catch (error) {
        console.error('❌ Error deleting organization:', error);
        return NextResponse.json({ 
            error: 'Failed to delete organization' 
        }, { status: 500 });
    }
}