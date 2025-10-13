# Admin View-Only Role Implementation Guide

## Overview

This document describes the implementation of a "view-only" admin role that allows designated users to access the admin dashboard with read-only permissions. View-only admins can see all data and analytics but cannot perform any actions (generate test data, cleanup, enterprise tools, etc.).

---

## Security Architecture

This implementation follows the **multi-layered security approach** documented in `ADMIN_SECURITY_LAYERS_GUIDE.md`:

### Layer 1: Environment Variables (.env)
- **Full Admin**: `ADMIN_EMAILS` - Can view AND perform all actions
- **View-Only**: `ADMIN_EMAILS_VIEW_ONLY` - Can only view, no actions

### Layer 2: Server-Side Authorization (adminService.js)
- Checks both email lists
- Returns role and permissions to client
- Validates permissions before executing operations

### Layer 3: API Route Protection (route.js)
- Verifies Firebase token
- Checks admin role (full or view-only)
- Returns role and permissions in API response
- **Future**: Action endpoints will block view-only users

### Layer 4: Client-Side UI (admin/page.jsx)
- Hides action buttons for view-only users
- Shows "👁️ View Only" badge
- Still displays all data and analytics

---

## Files Modified

### 1. `/lib/services/serviceAdmin/constants/adminConstants.js`

#### Added Role Constants
```javascript
export const ADMIN_ROLES = {
  FULL_ADMIN: 'full_admin',    // Full admin access with all permissions
  VIEW_ONLY: 'view_only'       // Read-only access, cannot perform actions
};
```

#### Updated Permissions
```javascript
export const ADMIN_PERMISSIONS = {
  CAN_VIEW_USERS: 'canViewUsers',
  CAN_VIEW_ANALYTICS: 'canViewAnalytics',
  CAN_VIEW_USER_DETAILS: 'canViewUserDetails',
  CAN_PERFORM_ACTIONS: 'canPerformActions',  // NEW: Generate test data, cleanup, enterprise tools
};
```

#### Added Helper Functions
```javascript
// Get permissions based on role
export function getPermissionsForRole(role) {
  const basePermissions = {
    [ADMIN_PERMISSIONS.CAN_VIEW_USERS]: true,
    [ADMIN_PERMISSIONS.CAN_VIEW_ANALYTICS]: true,
    [ADMIN_PERMISSIONS.CAN_VIEW_USER_DETAILS]: true,
  };

  if (role === ADMIN_ROLES.FULL_ADMIN) {
    return {
      ...basePermissions,
      [ADMIN_PERMISSIONS.CAN_PERFORM_ACTIONS]: true,
    };
  }

  if (role === ADMIN_ROLES.VIEW_ONLY) {
    return {
      ...basePermissions,
      [ADMIN_PERMISSIONS.CAN_PERFORM_ACTIONS]: false,
    };
  }

  return {}; // Default: no permissions
}
```

---

### 2. `/lib/services/serviceAdmin/server/adminService.js`

#### Updated Authorization Check
```javascript
static isServerAdmin(email) {
  if (!email) return false;

  const normalizedEmail = email.toLowerCase().trim();

  // Check full admin list
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  const isFullAdmin = adminEmails
    .map(e => e.toLowerCase().trim())
    .includes(normalizedEmail);

  if (isFullAdmin) return true;

  // Check view-only admin list
  const viewOnlyEmails = process.env.ADMIN_EMAILS_VIEW_ONLY?.split(',') || [];
  const isViewOnly = viewOnlyEmails
    .map(e => e.toLowerCase().trim())
    .includes(normalizedEmail);

  return isViewOnly;
}
```

#### Added Role Management Methods
```javascript
// Get admin role for a user
static getAdminRole(email) {
  if (!email) return null;

  const normalizedEmail = email.toLowerCase().trim();

  // Check full admin list first
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  const isFullAdmin = adminEmails
    .map(e => e.toLowerCase().trim())
    .includes(normalizedEmail);

  if (isFullAdmin) return ADMIN_ROLES.FULL_ADMIN;

  // Check view-only admin list
  const viewOnlyEmails = process.env.ADMIN_EMAILS_VIEW_ONLY?.split(',') || [];
  const isViewOnly = viewOnlyEmails
    .map(e => e.toLowerCase().trim())
    .includes(normalizedEmail);

  if (isViewOnly) return ADMIN_ROLES.VIEW_ONLY;

  return null;
}

// Get admin permissions for a user
static getAdminPermissions(email) {
  const role = this.getAdminRole(email);
  if (!role) return {};
  return getPermissionsForRole(role);
}

// Check if user can perform actions (not view-only)
static canPerformActions(email) {
  const role = this.getAdminRole(email);
  return role === ADMIN_ROLES.FULL_ADMIN;
}
```

---

### 3. `/app/api/admin/users/route.js`

#### Updated to Return Role and Permissions
```javascript
// Get admin role and permissions
const adminRole = AdminService.getAdminRole(email);
const adminPermissions = AdminService.getAdminPermissions(email);

console.log(`✅ Authorized admin access by: ${email} (Role: ${adminRole})`);

// Add to response
result.adminUser = email;
result.adminRole = adminRole;
result.adminPermissions = adminPermissions;
result.processingTimeMs = processingTime;
```

---

### 4. `/app/api/admin/analytics/route.js`

#### Updated to Return Role and Permissions
```javascript
// Get admin role and permissions
const adminRole = AdminService.getAdminRole(email);
const adminPermissions = AdminService.getAdminPermissions(email);

console.log(`✅ Authorized admin analytics access by: ${email} (Role: ${adminRole})`);

// Add to response
result.adminUser = email;
result.adminRole = adminRole;
result.adminPermissions = adminPermissions;
result.processingTimeMs = processingTime;
```

---

### 5. `/app/admin/page.jsx`

#### Added Permission State
```javascript
import { ADMIN_PERMISSIONS } from '@/lib/services/serviceAdmin/constants/adminConstants';

// Admin role and permissions
const [adminPermissions, setAdminPermissions] = useState({});
```

#### Store Permissions from API
```javascript
// Store admin permissions from API response
if (usersData.adminPermissions) {
  console.log('✅ [AdminPage] Admin permissions received:', usersData.adminPermissions);
  setAdminPermissions(usersData.adminPermissions);
}
```

#### Conditional UI Rendering
```javascript
// Check if user can perform actions (not view-only)
const canPerformActions = adminPermissions[ADMIN_PERMISSIONS.CAN_PERFORM_ACTIONS] === true;

return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-gray-900">
        Admin Dashboard
        {!canPerformActions && (
          <span className="ml-3 text-sm font-normal text-gray-500 bg-yellow-100 px-3 py-1 rounded-full border border-yellow-300">
            👁️ View Only
          </span>
        )}
      </h2>
      <div className="flex items-center gap-3">
        {/* Enterprise Panel Toggle - Only for full admins */}
        {canPerformActions && (
          <button onClick={() => setShowEnterprisePanel(!showEnterprisePanel)}>
            <span>🏢</span>
            {showEnterprisePanel ? 'Hide Enterprise Panel' : 'Show Enterprise Panel'}
          </button>
        )}

        {/* Vector Panel Toggle - Only for full admins */}
        {canPerformActions && (
          <button onClick={() => setShowVectorPanel(!showVectorPanel)}>
            <span>🔮</span>
            {showVectorPanel ? 'Hide Vector Panel' : 'Show Vector Panel'}
          </button>
        )}

        {/* Test Panel Toggle - Only for full admins */}
        {canPerformActions && (
          <button onClick={() => setShowTestPanel(!showTestPanel)}>
            <span>🧪</span>
            {showTestPanel ? 'Hide Test Panel' : 'Show Test Panel'}
          </button>
        )}
      </div>
    </div>
  </div>
);
```

---

### 6. `/.env` (Development)

```bash
# Admin Access Control
# Full admin access - can view AND perform all actions (generate, cleanup, enterprise tools)
ADMIN_EMAILS="leozul0204@gmail.com"

# View-only admin access - can only view data, cannot perform any actions
# Add comma-separated emails for users who should have read-only admin access
# Example: ADMIN_EMAILS_VIEW_ONLY="viewer1@example.com,viewer2@example.com"
ADMIN_EMAILS_VIEW_ONLY=""
```

---

### 7. `/.env.production.example` (Production Template)

```bash
# ========================================
# Admin Access Control
# ========================================

# Full admin access - can view AND perform all actions (generate, cleanup, enterprise tools)
# Add comma-separated emails for users who should have full admin access
# Example: ADMIN_EMAILS="admin1@example.com,admin2@example.com"
ADMIN_EMAILS="leozul0204@gmail.com"

# View-only admin access - can only view data, cannot perform any actions
# Add comma-separated emails for users who should have read-only admin access
# Example: ADMIN_EMAILS_VIEW_ONLY="viewer1@example.com,viewer2@example.com"
ADMIN_EMAILS_VIEW_ONLY=""
```

---

## How to Use

### Adding a View-Only Admin

1. **Open `.env` file** (development) or **Vercel Dashboard** (production)

2. **Add email to `ADMIN_EMAILS_VIEW_ONLY`**:
   ```bash
   ADMIN_EMAILS_VIEW_ONLY="viewer@example.com,another.viewer@company.com"
   ```

3. **Restart the application** (or redeploy if production)

4. **User logs in** with their Firebase account using that email

5. **User sees**:
   - ✅ Full access to users list
   - ✅ Full access to analytics data
   - ✅ Full access to user details
   - ✅ "👁️ View Only" badge in header
   - ❌ No "Show Enterprise Panel" button
   - ❌ No "Show Vector Panel" button
   - ❌ No "Show Test Panel" button

---

## Permission Matrix

| Feature | Full Admin | View-Only Admin | Regular User |
|---------|-----------|----------------|--------------|
| View Users List | ✅ | ✅ | ❌ |
| View User Details | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ❌ |
| View API Usage Stats | ✅ | ✅ | ❌ |
| Generate Test Contacts | ✅ | ❌ | ❌ |
| Cleanup Test Data | ✅ | ❌ | ❌ |
| Generate Vector Contacts | ✅ | ❌ | ❌ |
| Enterprise Tools | ✅ | ❌ | ❌ |

---

## Future Action Endpoints (To Be Protected)

When these endpoints are created, they should include this server-side check:

```javascript
// Example: /app/api/admin/generate-contacts/route.js
export async function POST(request) {
  try {
    // 1. Verify token and get email
    const { isValid, email, isAdmin } = await verifyAdminToken(token);

    if (!isValid || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check if user can perform actions (NEW CHECK)
    const canPerform = AdminService.canPerformActions(email);
    if (!canPerform) {
      console.warn(`🚨 VIEW-ONLY ADMIN ACTION BLOCKED: ${email} tried to generate contacts`);
      return NextResponse.json(
        { error: 'Forbidden: View-only admins cannot perform this action' },
        { status: 403 }
      );
    }

    // 3. Proceed with action
    // ... rest of endpoint logic
  } catch (error) {
    // ... error handling
  }
}
```

**Action Endpoints to Protect**:
- `/api/admin/generate-contacts` - POST
- `/api/admin/generate-vector-contacts` - POST
- `/api/admin/cleanup-test-data` - POST
- `/api/admin/cleanup-vector-test-data` - POST
- `/api/admin/enterprise-tools` - POST

---

## Testing

### Test View-Only Access

1. **Add a test email to view-only list**:
   ```bash
   ADMIN_EMAILS_VIEW_ONLY="test.viewer@example.com"
   ```

2. **Restart the app**:
   ```bash
   npm run dev
   ```

3. **Log in with that email**

4. **Verify**:
   - ✅ You can access `/admin`
   - ✅ You see "👁️ View Only" badge
   - ✅ You can see users, analytics, stats
   - ❌ You don't see panel toggle buttons

### Test Full Admin Access

1. **Use email from `ADMIN_EMAILS`**:
   ```bash
   ADMIN_EMAILS="leozul0204@gmail.com"
   ```

2. **Log in and verify**:
   - ✅ No "View Only" badge
   - ✅ All panel toggle buttons visible
   - ✅ Can perform all actions

---

## Security Best Practices

### ✅ DO:
- Always use `ADMIN_EMAILS_VIEW_ONLY` environment variable (server-only)
- Check permissions on both client and server
- Block view-only users from action endpoints
- Log unauthorized access attempts
- Use comma-separated emails for multiple users

### ❌ DON'T:
- Don't trust client-side checks for security decisions
- Don't expose admin lists to the client
- Don't allow view-only users to bypass server checks
- Don't forget to restart after .env changes

---

## Integration with Existing Security Layers

This implementation follows all 4 security layers from `ADMIN_SECURITY_LAYERS_GUIDE.md`:

1. **Environment Variables**: Added `ADMIN_EMAILS_VIEW_ONLY`
2. **Server Authorization**: Updated `AdminService` with role checks
3. **API Route Protection**: Return role and permissions in API responses
4. **Client UI**: Conditionally render action buttons based on permissions

---

## Troubleshooting

### Issue: View-only user sees action buttons
**Solution**: Check that permissions are being fetched and stored correctly:
```javascript
console.log('Admin permissions:', adminPermissions);
console.log('Can perform actions:', canPerformActions);
```

### Issue: View-only user can't access /admin
**Solution**: Verify email is correctly added to `ADMIN_EMAILS_VIEW_ONLY` and app was restarted.

### Issue: Full admin sees "View Only" badge
**Solution**: Check if email exists in both lists. `ADMIN_EMAILS` takes priority.

---

## Change Log

| Date | Change | Files Modified |
|------|--------|---------------|
| 2025-10-13 | Initial implementation of view-only role | adminConstants.js, adminService.js, users/route.js, analytics/route.js, admin/page.jsx, .env, .env.production.example |

---

## Related Documentation

- `ADMIN_SECURITY_LAYERS_GUIDE.md` - Security architecture overview
- `ADMIN_ANALYTICS_INTEGRATION_GUIDE.md` - Analytics system integration
- `ADMIN_SERVICE_SEPARATION_GUIDE.md` - Service layer architecture

---

**✅ Implementation Complete**

The view-only admin role is now fully implemented with:
- Server-side role management
- Permission-based UI rendering
- Environment variable configuration
- Ready for future action endpoint protection
