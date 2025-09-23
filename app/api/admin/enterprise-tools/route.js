/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/api/admin/enterprise-tools/route.js - UPDATED VERSION
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@/lib/services/serviceEnterprise/server/enterprisePermissionService';
import { EnterpriseTeamService } from '@/lib/services/serviceEnterprise/server/enterpriseTeamService';
import { EnterpriseInvitationService } from '@/lib/services/serviceEnterprise/server/enterpriseInvitationService';
import { 
    ORGANIZATION_ROLES, 
    TEAM_ROLES, 
    DEFAULT_PERMISSIONS_BY_ROLE 
}from '@/lib/services/constants';

// ✅ UPDATED: Generate 6-character usernames without spaces
function generateRandomUser(role = 'manager') {
    const randomId = Math.random().toString(36).substring(2, 8); // 6 characters
    const password = Math.random().toString(36).substring(2, 12); // 10 character password
    
    // Create a 6-character username based on role
    const rolePrefix = role.substring(0, 3).toLowerCase(); // 'man', 'emp', etc.
    const randomSuffix = Math.random().toString(36).substring(2, 5); // 3 more chars
    const username = rolePrefix + randomSuffix; // Total 6 characters
    
    return { 
        email: `${username}@test.yourapp.com`, 
        password: password, 
        username: username,
        displayName: username.charAt(0).toUpperCase() + username.slice(1)
    };
}

// ✅ UPDATED: Create cleaner organization names
function generateOrgName(ownerUsername) {
    const companyTypes = ['Corp', 'Inc', 'LLC', 'Ltd', 'Co'];
    const randomType = companyTypes[Math.floor(Math.random() * companyTypes.length)];
    return `${ownerUsername.charAt(0).toUpperCase() + ownerUsername.slice(1)} ${randomType}`;
}

async function runPhase1HappyPathTest() {
    const logs = [];
    const created = { userIds: [], orgIds: [], inviteIds: [] };
    
    const logAndPush = (step, status, details = "") => {
        logs.push({ step, status, details });
    };

    try {
        logAndPush("Setup: Create Test Manager & Org", "running");
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({ 
            email: managerData.email, 
            password: managerData.password, 
            displayName: managerData.displayName 
        });
        created.userIds.push(manager.uid);
        
        const orgId = `org_${managerData.username}_${Date.now()}`;
        const orgName = generateOrgName(managerData.username);
        
        // ✅ NEW: Create organization with proper structure
        await adminDb.collection('Organizations').doc(orgId).set({ 
            name: orgName,
            domain: `${managerData.username}.test`,
            teams: {},
            createdAt: new Date().toISOString(),
            isTestOrganization: true,
            billing: {
                maxSeats: 50,
                currentSeats: 1
            },
            settings: {
                allowEmployeeDataExport: true,
                requireManagerApprovalForSharing: false,
                allowCrossTeamSharing: true
            }
        });
        created.orgIds.push(orgId);
        
        // ✅ NEW: Create user with proper permission structure - must be assigned to a team
        const managerTeamPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
        const adminTeamId = `team_admin_${Date.now()}`;
        
        // Update organization to include the admin team
        await adminDb.collection('Organizations').doc(orgId).update({
            [`teams.${adminTeamId}`]: {
                name: "Admin Team",
                description: "Administrative team for organization management",
                managerId: manager.uid,
                teamLeads: [],
                members: {
                    [manager.uid]: {
                        role: TEAM_ROLES.MANAGER,
                        joinedAt: new Date().toISOString(),
                        invitedBy: manager.uid,
                        permissions: managerTeamPermissions
                    }
                },
                settings: {},
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            }
        });
        
        await adminDb.collection('AccountData').doc(manager.uid).set({ 
            username: managerData.username,
            displayName: managerData.displayName, 
            email: managerData.email, 
            isTestAccount: true,
            accountType: 'business', // Give enterprise access
            enterprise: { 
                organizationId: orgId, 
                organizationRole: ORGANIZATION_ROLES.MANAGER, // Organization role (mapping only)
                teams: {
                    [adminTeamId]: {
                        role: TEAM_ROLES.MANAGER, // CRITICAL: Team role for permissions
                        joinedAt: new Date().toISOString(),
                        permissions: managerTeamPermissions
                    }
                }
            },
            createdAt: new Date().toISOString()
        });
        logAndPush("Setup: Create Test Manager & Org", "success", `Manager: ${managerData.username} (${manager.uid})`);
        
        logAndPush("Manager Action: Create Team", "running");
        const team = await EnterpriseTeamService.createTeam(manager.uid, orgId, { 
            name: `${managerData.username} Team`,
            description: "Test team for validation"
        });
        logAndPush("Manager Action: Create Team", "success", `Team ID: ${team.id}`);

        logAndPush("Manager Action: Invite Employee", "running");
        const employeeData = generateRandomUser('employee');
        const invitation = await EnterpriseInvitationService.createInvitation(
            manager.uid, orgId, team.id, employeeData.email, TEAM_ROLES.EMPLOYEE
        );
        created.inviteIds.push(invitation.id);
        logAndPush("Manager Action: Invite Employee", "success", `Invited: ${employeeData.username}`);

        return { success: true, logs };
        
    } catch (error) {
        const lastLogIndex = logs.findIndex(log => log.status === "running");
        if(lastLogIndex !== -1) {
            logs[lastLogIndex] = { ...logs[lastLogIndex], status: "error", details: error.message };
        } else {
            logAndPush("General Test Failure", "error", error.message);
        }
        return { success: false, logs };
    } finally {
        // Automatic Cleanup
        logAndPush("Cleanup: Deleting all test resources", "running");
        await Promise.all([
            ...created.userIds.map(uid => adminAuth.deleteUser(uid).catch(() => {})),
            ...created.userIds.map(uid => adminDb.collection('AccountData').doc(uid).delete().catch(() => {})),
            ...created.orgIds.map(oid => adminDb.collection('Organizations').doc(oid).delete().catch(() => {})),
            ...created.inviteIds.map(iid => adminDb.collection('TeamInvitations').doc(iid).delete().catch(() => {})),
        ]);
        logAndPush("Cleanup: Deleting all test resources", "success", `Cleaned up ${created.userIds.length} users, ${created.orgIds.length} orgs.`);
    }
}

async function runPhase1ComprehensiveTestSuite() {
    const logs = [];
    const created = { userIds: [], orgIds: [], inviteIds: [] };

    const logAndPush = (step, status, details = "") => {
        logs.push({ step, status, details });
    };

    try {
        // STEP 1: Setup - Create Manager, Employee, and Org
        logAndPush("Setup: Create Test Manager & Org", "running");
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({ 
            email: managerData.email, 
            password: managerData.password, 
            displayName: managerData.displayName 
        });
        created.userIds.push(manager.uid);
        
        const orgId = `org_${managerData.username}_${Date.now()}`;
        const orgName = generateOrgName(managerData.username);
        
        await adminDb.collection('Organizations').doc(orgId).set({ 
            name: orgName,
            domain: `${managerData.username}.test`,
            teams: {},
            createdAt: new Date().toISOString(),
            isTestOrganization: true,
            billing: {
                maxSeats: 50,
                currentSeats: 1
            },
            settings: {
                allowEmployeeDataExport: true,
                requireManagerApprovalForSharing: false,
                allowCrossTeamSharing: true
            }
        });
        created.orgIds.push(orgId);
        
        // Create manager with admin team assignment
        const managerTeamPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
        const adminTeamId = `team_admin_${Date.now()}`;
        
        // Update organization to include the admin team
        await adminDb.collection('Organizations').doc(orgId).update({
            [`teams.${adminTeamId}`]: {
                name: "Admin Team", 
                description: "Administrative team for organization management",
                managerId: manager.uid,
                teamLeads: [],
                members: {
                    [manager.uid]: {
                        role: TEAM_ROLES.MANAGER,
                        joinedAt: new Date().toISOString(),
                        invitedBy: manager.uid,
                        permissions: managerTeamPermissions
                    }
                },
                settings: {},
                createdAt: new Date().toISOString(),
                lastModified: new Date().toISOString()
            }
        });
        
        await adminDb.collection('AccountData').doc(manager.uid).set({ 
            username: managerData.username,
            displayName: managerData.displayName, 
            email: managerData.email, 
            isTestAccount: true,
            accountType: 'business',
            enterprise: { 
                organizationId: orgId, 
                organizationRole: ORGANIZATION_ROLES.MANAGER,
                teams: {
                    [adminTeamId]: {
                        role: TEAM_ROLES.MANAGER, // Team role grants permissions
                        joinedAt: new Date().toISOString(),
                        permissions: managerTeamPermissions
                    }
                }
            },
            createdAt: new Date().toISOString()
        });
        logAndPush("Setup: Create Test Manager & Org", "success", `Manager: ${managerData.username}`);

        logAndPush("Setup: Create Test Employee in Org", "running");
        const employeeData = generateRandomUser('employee');
        const employee = await adminAuth.createUser({ 
            email: employeeData.email, 
            password: employeeData.password, 
            displayName: employeeData.displayName 
        });
        created.userIds.push(employee.uid);
        
        // ✅ UPDATED: Employee with proper org role
        await adminDb.collection('AccountData').doc(employee.uid).set({ 
            username: employeeData.username,
            displayName: employeeData.displayName, 
            email: employeeData.email, 
            isTestAccount: true,
            accountType: 'business',
            enterprise: { 
                organizationId: orgId, 
                organizationRole: ORGANIZATION_ROLES.EMPLOYEE,
                teams: {}
            },
            createdAt: new Date().toISOString()
        });
        logAndPush("Setup: Create Test Employee in Org", "success", `Employee: ${employeeData.username}`);

        // STEP 2: Positive Test - Manager Creates a Team
        logAndPush("Positive Test: Manager can create a team", "running");
        const team = await EnterpriseTeamService.createTeam(manager.uid, orgId, { 
            name: `${managerData.username} Test Team`,
            description: "Test team for validation"
        });
        const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
        if (!orgDoc.data().teams[team.id]) throw new Error("Team not found in org document.");
        
        // ✅ NEW: Verify manager has proper team permissions
        const userContext = await EnterprisePermissionService.getUserContext(manager.uid);
        const teamPermissions = EnterprisePermissionService.getTeamPermissionSummary(userContext, team.id);
        
        if (!teamPermissions.isManager) {
            throw new Error("Manager should have manager permissions in the team");
        }
        
        logAndPush("Positive Test: Manager can create a team", "success", `Team created with proper permissions`);

        // STEP 3: Negative Test - Employee CANNOT Create a Team
        logAndPush("Negative Test: Employee cannot create a team", "running");
        try {
            const employeeContext = await EnterprisePermissionService.getUserContext(employee.uid);
            if (EnterprisePermissionService.isOrgAdmin(employeeContext)) {
                throw new Error("Security Fail: Employee was incorrectly identified as an Org Admin.");
            }
            
            // ✅ NEW: Test specific permission
            if (EnterprisePermissionService.canCreateTeams(employeeContext)) {
                throw new Error("Security Fail: Employee should not be able to create teams.");
            }
            
            logAndPush("Negative Test: Employee cannot create a team", "success", "Permission check correctly blocked non-admin.");
        } catch (error) {
            throw new Error(`Test logic error during employee permission check: ${error.message}`);
        }

        // STEP 4: Negative Test - Invalid Data
        logAndPush("Negative Test: Cannot create team with no name", "running");
        try {
            await EnterpriseTeamService.createTeam(manager.uid, orgId, { name: " " });
            throw new Error("Validation Fail: Team was created with an invalid name.");
        } catch (error) {
            logAndPush("Negative Test: Cannot create team with no name", "success", "API correctly rejected invalid data.");
        }

        // STEP 5: Edge Case Test - Duplicate Invitation
        logAndPush("Edge Case: Cannot send duplicate invitations", "running");
        const inviteeData = generateRandomUser('invitee');
        const firstInvite = await EnterpriseInvitationService.createInvitation(
            manager.uid, orgId, team.id, inviteeData.email, TEAM_ROLES.EMPLOYEE
        );
        created.inviteIds.push(firstInvite.id);
        
        try {
            await EnterpriseInvitationService.createInvitation(
                manager.uid, orgId, team.id, inviteeData.email, TEAM_ROLES.EMPLOYEE
            );
            throw new Error("Duplicate Check Fail: A second invitation was created for the same email.");
        } catch (error) {
            if (error.message.includes("Pending invitation already exists")) {
                logAndPush("Edge Case: Cannot send duplicate invitations", "success", "API correctly blocked duplicate invite.");
            } else {
                throw error;
            }
        }

        // ✅ NEW: Step 6 - Test Permission System
        logAndPush("Permission Test: Verify manager can invite members", "running");
        const canInvite = EnterprisePermissionService.canInviteMembers(userContext, team.id);
        if (!canInvite) {
            throw new Error("Permission Fail: Manager should be able to invite members.");
        }
        logAndPush("Permission Test: Verify manager can invite members", "success", "Manager has correct invite permissions.");

        return { success: true, logs };

    } catch (error) {
        const lastLogIndex = logs.findIndex(log => log.status === "running");
        if(lastLogIndex !== -1) {
            logs[lastLogIndex] = { ...logs[lastLogIndex], status: "error", details: error.message };
        } else {
            logAndPush("General Test Failure", "error", error.message);
        }
        return { success: false, logs };
    } finally {
        // STEP 7: Automatic Cleanup
        logAndPush("Cleanup: Deleting all test resources", "running");
        await Promise.all([
            ...created.userIds.map(uid => adminAuth.deleteUser(uid).catch(() => {})),
            ...created.userIds.map(uid => adminDb.collection('AccountData').doc(uid).delete().catch(() => {})),
            ...created.orgIds.map(oid => adminDb.collection('Organizations').doc(oid).delete().catch(() => {})),
            ...created.inviteIds.map(iid => adminDb.collection('TeamInvitations').doc(iid).delete().catch(() => {})),
        ]);
        logAndPush("Cleanup: Deleting all test resources", "success", `Cleaned up ${created.userIds.length} users, ${created.orgIds.length} orgs.`);
    }
}

async function getAllEnterpriseData() {
    try {
        const [orgSnapshot, inviteSnapshot] = await Promise.all([
            adminDb.collection('Organizations').get(),
            adminDb.collection('TeamInvitations').get()
        ]);

        const organizations = orgSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const invitations = inviteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { organizations, invitations };
    } catch (error) {
        throw new Error(`Failed to fetch enterprise data: ${error.message}`);
    }
}

// ✅ UPDATED: Create test manager with proper permission structure
async function createTestManager() {
    try {
        const managerData = generateRandomUser('manager');
        const manager = await adminAuth.createUser({
            email: managerData.email,
            password: managerData.password,
            displayName: managerData.displayName
        });

        const orgId = `org_${managerData.username}_${Date.now()}`;
        const orgName = generateOrgName(managerData.username);
        const adminTeamId = `team_admin_${Date.now()}`;
        
        // ✅ CRITICAL: Manager permissions from team role
        const managerTeamPermissions = DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.MANAGER];
        
        // ✅ UPDATED: Organization with proper structure including admin team
        await adminDb.collection('Organizations').doc(orgId).set({
            name: orgName,
            domain: `${managerData.username}.test`,
            teams: {
                [adminTeamId]: {
                    name: "Admin Team",
                    description: "Administrative team for organization management",
                    managerId: manager.uid,
                    teamLeads: [],
                    members: {
                        [manager.uid]: {
                            role: TEAM_ROLES.MANAGER,
                            joinedAt: new Date().toISOString(),
                            invitedBy: manager.uid,
                            permissions: managerTeamPermissions
                        }
                    },
                    settings: {},
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                }
            },
            createdAt: new Date().toISOString(),
            isTestOrganization: true,
            billing: {
                maxSeats: 50,
                currentSeats: 1
            },
            settings: {
                allowEmployeeDataExport: true,
                requireManagerApprovalForSharing: false,
                allowCrossTeamSharing: true
            }
        });

        // ✅ UPDATED: User with proper enterprise structure - assigned to admin team
        await adminDb.collection('AccountData').doc(manager.uid).set({
            username: managerData.username,
            displayName: managerData.displayName,
            email: managerData.email,
            isTestAccount: true,
            accountType: 'business', // Give them enterprise access
            enterprise: {
                organizationId: orgId,
                organizationRole: ORGANIZATION_ROLES.MANAGER, // Organization role (for mapping)
                teams: {
                    [adminTeamId]: {
                        role: TEAM_ROLES.MANAGER, // CRITICAL: Team role that grants permissions
                        joinedAt: new Date().toISOString(),
                        permissions: managerTeamPermissions // Team-based permissions
                    }
                },
                // Data sharing preferences
                dataSharing: {
                    allowManagerAccess: true,
                    allowTeamAccess: true,
                    allowCrossTeamAccess: true,
                    optedOutAt: null
                },
                // Management settings for this user
                managementSettings: {
                    defaultEmployeePermissions: DEFAULT_PERMISSIONS_BY_ROLE[TEAM_ROLES.EMPLOYEE],
                    requireApprovalForDataExport: false,
                    allowBulkOperations: true
                }
            },
            createdAt: new Date().toISOString()
        });

        return {
            user: {
                uid: manager.uid,
                email: managerData.email,
                password: managerData.password,
                username: managerData.username,
                displayName: managerData.displayName,
                organizationId: orgId,
                organizationName: orgName,
                organizationRole: ORGANIZATION_ROLES.MANAGER,
                teamRole: TEAM_ROLES.MANAGER, // The role that actually grants permissions
                adminTeamId: adminTeamId,
                permissions: managerTeamPermissions // Team-based permissions that work
            },
            message: 'Test manager created with admin team and proper team-based permissions'
        };
    } catch (error) {
        throw new Error(`Failed to create test manager: ${error.message}`);
    }
}

async function deleteTestUser(userId) {
    try {
        // Get user data first to clean up related resources
        const userDoc = await adminDb.collection('AccountData').doc(userId).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // If user has an organization and is the only member, delete the organization
            if (userData.enterprise?.organizationId) {
                const orgDoc = await adminDb.collection('Organizations').doc(userData.enterprise.organizationId).get();
                if (orgDoc.exists && orgDoc.data().isTestOrganization) {
                    // Check if this is the only user in the organization
                    const orgUsersQuery = await adminDb.collection('AccountData')
                        .where('enterprise.organizationId', '==', userData.enterprise.organizationId)
                        .get();
                    
                    if (orgUsersQuery.size <= 1) {
                        // Delete the organization if this is the only user
                        await adminDb.collection('Organizations').doc(userData.enterprise.organizationId).delete();
                    }
                }
            }
        }

        // Delete any pending invitations created by this user
        const invitationsQuery = await adminDb.collection('TeamInvitations')
            .where('invitedBy', '==', userId)
            .get();
        
        const deleteInvitePromises = invitationsQuery.docs.map(doc => doc.ref.delete());
        await Promise.all(deleteInvitePromises);

        // Delete user account and data
        await Promise.all([
            adminAuth.deleteUser(userId),
            adminDb.collection('AccountData').doc(userId).delete(),
            adminDb.collection('Contacts').doc(userId).delete()
        ]);

        return { 
            message: 'Test user and related data deleted successfully',
            cleanedUp: {
                user: true,
                organization: userDoc.exists && userDoc.data().enterprise?.organizationId ? true : false,
                invitations: deleteInvitePromises.length
            }
        };
    } catch (error) {
        throw new Error(`Failed to delete test user: ${error.message}`);
    }
}

// ✅ UPDATED: Add user with proper role and permission structure
async function addUserToOrganization(email, orgId, role) {
    console.log('🔄 Starting addUserToOrganization:', { email, orgId, role });
    
    try {
        // Validate role
        const validOrgRoles = Object.values(ORGANIZATION_ROLES);
        if (!validOrgRoles.includes(role)) {
            throw new Error(`Invalid role: ${role}. Valid roles: ${validOrgRoles.join(', ')}`);
        }
        console.log('✅ Role validation passed');

        // Find user by email
        const user = await adminAuth.getUserByEmail(email);
        console.log('✅ User found in Auth:', user.uid);
        
        // Verify organization exists
        const orgDoc = await adminDb.collection('Organizations').doc(orgId).get();
        if (!orgDoc.exists) {
            throw new Error(`Organization ${orgId} not found`);
        }
        console.log('✅ Organization found:', orgDoc.data().name);
        
        // ✅ CRITICAL FIX: Check if user document exists, create if it doesn't
        const userDocRef = adminDb.collection('AccountData').doc(user.uid);
        const userDoc = await userDocRef.get();
        
        let documentCreated = false;
        if (!userDoc.exists) {
            // Create user document if it doesn't exist
            console.log(`📝 Creating AccountData document for user: ${user.uid}`);
            await userDocRef.set({
                displayName: user.displayName || user.email.split('@')[0],
                email: user.email,
                username: user.email.split('@')[0], // Generate username from email
                accountType: 'basic', // Start with basic, will be upgraded below
                isTestAccount: false,
                createdAt: new Date().toISOString(),
                enterprise: {
                    organizationId: orgId,
                    organizationRole: role,
                    teams: {},
                    dataSharing: {
                        allowManagerAccess: true,
                        allowTeamAccess: true,
                        allowCrossTeamAccess: role === ORGANIZATION_ROLES.MANAGER,
                        optedOutAt: null
                    }
                }
            });
            documentCreated = true;
            console.log('✅ User document created');
        } else {
            // Update existing user document
            console.log(`📝 Updating existing AccountData document for user: ${user.uid}`);
            await userDocRef.update({
                'enterprise.organizationId': orgId,
                'enterprise.organizationRole': role,
                'enterprise.teams': {}, // Reset teams
                'enterprise.dataSharing': {
                    allowManagerAccess: true,
                    allowTeamAccess: true,
                    allowCrossTeamAccess: role === ORGANIZATION_ROLES.MANAGER,
                    optedOutAt: null
                },
                updatedAt: new Date().toISOString()
            });
            console.log('✅ User document updated');
        }
        
        // Always upgrade to business account for enterprise access
        console.log('📝 Upgrading account to business');
        await userDocRef.update({
            accountType: 'business',
            updatedAt: new Date().toISOString()
        });
        console.log('✅ Account upgraded to business');

        // Update organization's current seat count
        const orgData = orgDoc.data();
        const currentSeats = (orgData.billing?.currentSeats || 0) + 1;
        console.log('📝 Updating organization seat count:', { currentSeats, orgId });
        await adminDb.collection('Organizations').doc(orgId).update({
            'billing.currentSeats': currentSeats,
            lastModified: new Date().toISOString()
        });
        console.log('✅ Organization updated');

        const result = { 
            message: `User ${email} added to organization ${orgData.name} as ${role}`,
            userId: user.uid,
            organizationName: orgData.name,
            organizationRole: role,
            newSeatCount: currentSeats,
            note: "User needs to be assigned to a team to get functional permissions",
            documentCreated: documentCreated
        };
        
        console.log('✅ addUserToOrganization completed successfully:', result);
        return result;
        
    } catch (error) {
        console.error('❌ addUserToOrganization error:', error);
        if (error.code === 'auth/user-not-found') {
            throw new Error(`User with email ${email} not found in Firebase Auth. Make sure the user account exists.`);
        }
        throw new Error(`Failed to add user to organization: ${error.message}`);
    }
}

export async function POST(request) {
    try {
        const token = request.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        const decodedToken = await adminAuth.verifyIdToken(token);
        
        // Check if user has admin privileges
        const userDoc = await adminDb.collection('AccountData').doc(decodedToken.uid).get();
        const userData = userDoc.data();
        
        if (!userData?.isAdmin) {
            return NextResponse.json({ 
                error: 'Access Denied: Admin privileges required.' 
            }, { status: 403 });
        }

        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'run_phase1_test':
                return NextResponse.json(await runPhase1HappyPathTest());
                
            case 'run_phase1_comprehensive_test':
                return NextResponse.json(await runPhase1ComprehensiveTestSuite());
                
            case 'get_all_data':
                return NextResponse.json(await getAllEnterpriseData());
                
            case 'create_test_manager':
                return NextResponse.json(await createTestManager());
                
            case 'delete_test_user':
                if (!params.userId) {
                    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
                }
                return NextResponse.json(await deleteTestUser(params.userId));
                
            case 'add_user_to_org':
                if (!params.email || !params.orgId || !params.role) {
                    return NextResponse.json({ 
                        error: 'Email, organization ID, and role are required' 
                    }, { status: 400 });
                }
                return NextResponse.json(await addUserToOrganization(params.email, params.orgId, params.role));
                
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Enterprise tools API error:', error);
        return NextResponse.json({ 
            error: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}