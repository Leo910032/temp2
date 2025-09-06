// app/api/enterprise/audit/log/route.js

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { EnterprisePermissionService } from '@serviceEnterprise/server';

/**
 * ✅ POST /api/enterprise/audit/log
 * Log audit events for enterprise actions
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, details } = body;

    console.log('📝 API: Logging audit event:', { action, details });

    // ✅ Validate input
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // ✅ Authenticate request
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // ✅ Get user context
    const userContext = await EnterprisePermissionService.getUserContext(userId);
    
    if (!userContext.organizationId) {
      return NextResponse.json({ error: 'Not part of an organization' }, { status: 403 });
    }

    // ✅ Get client IP address
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    // ✅ Prepare audit log entry
    const auditLogEntry = {
      userId,
      organizationId: userContext.organizationId,
      action,
      resourceType: details.teamId ? 'team' : 'organization',
      resourceId: details.teamId || userContext.organizationId,
      timestamp: new Date(),
      ipAddress: ip,
      userAgent: details.userAgent || request.headers.get('user-agent') || 'unknown',
      details: {
        ...details,
        userEmail: userContext.userData?.email,
        userDisplayName: userContext.userData?.displayName,
        organizationId: userContext.organizationId
      }
    };

    // ✅ Add to AuditLogs collection
    const auditLogRef = await adminDb.collection('AuditLogs').add(auditLogEntry);

    console.log('✅ API: Audit event logged successfully:', auditLogRef.id);

    return NextResponse.json({
      success: true,
      auditLogId: auditLogRef.id,
      timestamp: auditLogEntry.timestamp.toISOString()
    });

  } catch (error) {
    console.error('❌ API: Error logging audit event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log audit event' },
      { status: 500 }
    );
  }
}

/**
 * ✅ GET /api/enterprise/audit/log
 * Get audit logs for organization (admin only)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    console.log('📋 API: Getting organization audit logs');

    // ✅ Parse query parameters
    const filter = searchParams.get('filter') || 'all';
    const sortBy = searchParams.get('sortBy') || 'newest';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 100); // Max 100 per page

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

    // ✅ Only organization owners can view all audit logs
    if (userContext.organizationRole !== 'owner') {
      return NextResponse.json({ 
        error: 'Only organization owners can view audit logs' 
      }, { status: 403 });
    }

    // ✅ Build query
    let query = adminDb.collection('AuditLogs')
      .where('organizationId', '==', userContext.organizationId);

    // ✅ Apply filters
    if (filter !== 'all') {
      const filterMap = {
        'teams': ['member_added', 'member_removed', 'role_updated', 'team_created', 'team_updated'],
        'invitations': ['invitation_sent', 'invitation_revoked', 'invitation_resent'],
        'permissions': ['team_permissions_updated', 'permission_changed'],
        'security': ['login', 'logout', 'password_changed', 'account_locked']
      };
      
      if (filterMap[filter]) {
        query = query.where('action', 'in', filterMap[filter]);
      }
    }

    // ✅ Apply sorting
    const orderDirection = sortBy === 'oldest' ? 'asc' : 'desc';
    query = query.orderBy('timestamp', orderDirection);

    // ✅ Apply pagination
    const offset = (page - 1) * limit;
    query = query.offset(offset).limit(limit + 1); // +1 to check if there are more

    // ✅ Execute query
    const snapshot = await query.get();
    const logs = [];
    const hasMore = snapshot.docs.length > limit;

    // ✅ Process logs (excluding the extra one for hasMore check)
    const docsToProcess = hasMore ? snapshot.docs.slice(0, -1) : snapshot.docs;
    
    for (const doc of docsToProcess) {
      const logData = doc.data();
      
      // ✅ Enrich with user information
      let userInfo = null;
      if (logData.userId) {
        try {
          const userDoc = await adminDb.collection('AccountData').doc(logData.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userInfo = {
              id: logData.userId,
              displayName: userData.displayName,
              email: userData.email,
              avatarUrl: userData.avatarUrl
            };
          }
        } catch (error) {
          console.warn('Could not fetch user info for log:', logData.userId);
        }
      }

      logs.push({
        id: doc.id,
        ...logData,
        timestamp: logData.timestamp?.toDate?.()?.toISOString() || logData.createdAt,
        user: userInfo
      });
    }

    console.log(`✅ API: Retrieved ${logs.length} audit logs`);

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