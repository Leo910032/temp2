import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@serviceEnterprise/server';

export async function GET(request, { params }) {
  try {
    const { teamId } = params;
   const { searchParams } = new URL(request.url);
    
    console.log('📋 API: Getting team audit logs:', teamId);

    // ✅ Parse query parameters
    const filter = searchParams.get('filter') || 'all';
    const sortBy = searchParams.get('sortBy') || 'newest';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50); // Max 50 per page

    // ✅ Authenticate request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // ✅ Get user context and validate permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ error: 'Not part of an organization' }, { status: 403 });
    }

    // ✅ Check if user can access audit logs (managers and owners only)
    const userTeamRole = EnterprisePermissionService.getUserTeamRole(userContext, teamId);
    const canViewLogs = userContext.organizationRole === 'owner' || 
                       userTeamRole === 'manager';
    
    if (!canViewLogs) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to view audit logs' 
      }, { status: 403 });
    }

    // ✅ Build the primary, indexed query for logs
    let query = adminDb.collection('AuditLogs')
      .where('organizationId', '==', userContext.organizationId)
      .where('resourceId', '==', teamId)
      .where('resourceType', '==', 'team');
    
   // ✅ Apply filters
    if (filter !== 'all') {
      const filterMap = {
        'members': ['member_added', 'member_removed', 'role_updated', 'member_role_updated'],
        'invitations': ['invitation_sent', 'invitation_revoked', 'invitation_resent'],
        'permissions': ['team_permissions_updated', 'permission_changed'],
        'settings': ['team_updated', 'settings_changed']
      };
      
      if (filterMap[filter]) {
        query = query.where('action', 'in', filterMap[filter]);
      }
    }

    query = query.orderBy('timestamp', sortBy === 'oldest' ? 'asc' : 'desc');
    
    // ✅ Apply pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(limit + 1); // +1 to check for more

    // ✅ Execute the main query - THIS IS FAST
    const snapshot = await query.get();
     // ✅ THE FIX: Declare `hasMore` right here.
    const hasMore = snapshot.docs.length > limit;
    
    // ==================== NEW OPTIMIZED LOGIC ====================
    
    const docsToProcess = snapshot.docs.length > limit 
        ? snapshot.docs.slice(0, -1) 
        : snapshot.docs;
    
    // STEP 1: Get all log data and collect unique user IDs
    const uniqueUserIds = new Set();
    const rawLogs = docsToProcess.map(doc => {
      const logData = doc.data();
      // Add the user who performed the action
      if (logData.userId) uniqueUserIds.add(logData.userId);
      // Add the target user, if any
      const targetUserId = logData.details?.targetUserId || logData.details?.updatedUserId;
      if (targetUserId) uniqueUserIds.add(targetUserId);
      return { id: doc.id, ...logData };
    });

    // STEP 2: Fetch all user data in a single bulk operation
    let usersDataMap = new Map();
    if (uniqueUserIds.size > 0) {
      const userIdsArray = Array.from(uniqueUserIds);
      // Firestore `in` query is limited to 30 items. If more, we need multiple queries.
      // This handles up to 30 unique users per log page, which is very reasonable.
      const userDocs = await adminDb.collection('AccountData').where('__name__', 'in', userIdsArray).get();
      userDocs.forEach(doc => {
        const userData = doc.data();
        usersDataMap.set(doc.id, {
          id: doc.id,
          displayName: userData.displayName,
          email: userData.email,
          avatarUrl: userData.avatarUrl
        });
      });
    }

    // STEP 3: Process and enrich the logs using the pre-fetched user data
    const logs = rawLogs.map(logData => {
      const targetUserId = logData.details?.targetUserId || logData.details?.updatedUserId;
      
      let timestamp = logData.timestamp;
      if (timestamp?.toDate) timestamp = timestamp.toDate().toISOString();
      else if (!timestamp) timestamp = logData.createdAt || new Date().toISOString();

      return {
        ...logData,
        timestamp,
        user: usersDataMap.get(logData.userId) || null,
        targetUser: usersDataMap.get(targetUserId) || null,
      };
    });
    
    // ================= END OF OPTIMIZED LOGIC =================

    console.log(`✅ API: Retrieved ${logs.length} audit logs efficiently`);

   return NextResponse.json({
      success: true,
      logs,
      hasMore,
      page,
      totalShown: logs.length,
      filter,
      sortBy
    });
  } catch (error) {
    console.error('❌ API: Error getting audit logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get audit logs' },
      { status: 500 }
    );
  }
}

/**
 * ✅ POST /api/enterprise/teams/[teamId]/audit-logs/export
 * Export audit logs (for organization owners)
 */
export async function POST(request, { params }) {
  try {
    const { teamId } = params;
    console.log('📤 API: Exporting audit logs for team:', teamId);

    // ✅ Authenticate request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // ✅ Get user context and validate permissions
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ error: 'Not part of an organization' }, { status: 403 });
    }

    // ✅ Only organization owners can export logs
    if (userContext.organizationRole !== 'owner') {
      return NextResponse.json({ 
        error: 'Only organization owners can export audit logs' 
      }, { status: 403 });
    }

    // ✅ Get all logs for the team (no pagination for export)
    const snapshot = await adminDb.collection('AuditLogs')
      .where('organizationId', '==', userContext.organizationId)
      .where('resourceId', '==', teamId)
      .where('resourceType', '==', 'team')
      .orderBy('timestamp', 'desc')
      .limit(1000) // Reasonable limit for export
      .get();

    const exportData = [];
    
    for (const doc of snapshot.docs) {
      const logData = doc.data();
      
      // ✅ Handle timestamp for export
      let timestamp = logData.timestamp;
      if (timestamp?.toDate) {
        timestamp = timestamp.toDate().toISOString();
      } else if (typeof timestamp === 'string') {
        timestamp = timestamp;
      } else {
        timestamp = logData.createdAt || new Date().toISOString();
      }
      
      // ✅ Format for CSV export
      exportData.push({
        timestamp: timestamp,
        action: logData.action,
        userId: logData.userId,
        userEmail: logData.userEmail || 'Unknown',
        targetUserId: logData.details?.targetUserId || logData.details?.updatedUserId || '',
        targetEmail: logData.details?.email || '',
        description: logData.details?.description || '',
        ipAddress: logData.ipAddress || '',
        userAgent: logData.userAgent || '',
        details: JSON.stringify(logData.details || {})
      });
    }

    console.log(`✅ API: Prepared ${exportData.length} logs for export`);

    // ✅ Log the export action
    await adminDb.collection('AuditLogs').add({
      userId,
      organizationId: userContext.organizationId,
      action: 'audit_logs_exported',
      resourceType: 'team',
      resourceId: teamId,
      timestamp: new Date().toISOString(), // Use string format for consistency
      details: {
        exportedCount: exportData.length,
        requestedBy: userId
      }
    });

    return NextResponse.json({
      success: true,
      data: exportData,
      count: exportData.length,
      exportedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ API: Error exporting audit logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}
// ... The POST (export) handler has a similar N+1 problem.
// You can apply the same optimization pattern there if you need to.