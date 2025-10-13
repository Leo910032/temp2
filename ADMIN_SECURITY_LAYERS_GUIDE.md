# Admin Security Layers - Implementation Guide

## Overview
This guide explains how to implement the 7-layer security verification system for admin operations, step by step.

---

## 🔐 Security Layer Architecture

```
User Request
    ↓
[1. Client Check] → UI hides feature if no admin access
    ↓
[2. Component Guard] → AdminProtection component
    ↓
[3. API Call] → JWT token sent
    ↓
[4. Rate Limiting] → Fingerprint-based throttling
    ↓
[5. Authentication] → Verify JWT, load user data
    ↓
[6. Permission Check] ⭐ → Validate ADMIN feature flag
    ↓
[7. Business Logic] → Execute admin operations
    ↓
Success Response
```

---

## Layer 1: Client-Side Check (✅ Implemented)

**Current Status:** ✅ Working
**File:** `app/admin/page.jsx`

```javascript
// Already implemented via AdminService
const [usersData, analyticsData] = await Promise.all([
    AdminService.fetchUsers(),
    AdminService.fetchAnalytics()
]);
```

**Purpose:** Provides clean API abstraction and proper error handling

---

## Layer 2: Component Guard (⏸️ To Implement)

**Current Status:** ⏸️ Not yet implemented
**Files to create:**
- `app/admin/components/AdminProtection.jsx`
- `lib/hooks/useAdminAccess.js`

### Step-by-Step Implementation:

#### 1. Create the hook (`lib/hooks/useAdminAccess.js`)
```javascript
"use client"
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminService } from '@/lib/services/serviceAdmin/client/adminService';

export function useAdminAccess() {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function checkAccess() {
      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const hasAccess = await AdminService.checkAdminAccess();
        setIsAdmin(hasAccess);
      } catch (err) {
        console.error('Admin access check failed:', err);
        setError(err.message);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [currentUser]);

  return { isAdmin, loading, error };
}
```

#### 2. Create the component (`app/admin/components/AdminProtection.jsx`)
```javascript
"use client"
import { useAdminAccess } from '@/lib/hooks/useAdminAccess';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminProtection({ children }) {
  const { isAdmin, loading, error } = useAdminAccess();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      // Redirect non-admin users
      router.push('/dashboard');
    }
  }, [isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Error verifying access: {error}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">Access denied. Redirecting...</p>
        </div>
      </div>
    );
  }

  return children;
}
```

#### 3. Wrap the admin page
```javascript
// app/admin/page.jsx
import AdminProtection from './components/AdminProtection';

export default function AdminDashboard() {
  return (
    <AdminProtection>
      {/* existing content */}
    </AdminProtection>
  );
}
```

---

## Layer 3: API Call with JWT (✅ Implemented)

**Current Status:** ✅ Working
**File:** `lib/services/core/ApiClient.js`

Already handled by `ContactApiClient.getAuthHeaders()`:
```javascript
static async getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');

  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}
```

---

## Layer 4: Rate Limiting (⏸️ To Implement)

**Current Status:** ⏸️ Not yet implemented
**Files to create:**
- `lib/services/serviceAdmin/server/rateLimiter.js`
- `lib/middleware/adminRateLimit.js`

### Step-by-Step Implementation:

#### 1. Create rate limiter service
```javascript
// lib/services/serviceAdmin/server/rateLimiter.js
import { adminDb } from '@/lib/firebaseAdmin';
import { ADMIN_RATE_LIMITS } from '../constants/adminConstants';

export class AdminRateLimiter {
  /**
   * Check if operation is rate limited
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   * @param {string} fingerprint - Browser fingerprint (optional)
   * @returns {Promise<{allowed: boolean, reason?: string}>}
   */
  static async checkRateLimit(userId, operation, fingerprint = null) {
    const limits = ADMIN_RATE_LIMITS[operation];
    if (!limits) return { allowed: true };

    const key = fingerprint
      ? `ratelimit:${operation}:${fingerprint}`
      : `ratelimit:${operation}:${userId}`;

    const now = Date.now();
    const windowStart = now - limits.windowMs;

    try {
      // Get recent requests from Firestore
      const rateLimitDoc = await adminDb
        .collection('RateLimits')
        .doc(key)
        .get();

      if (!rateLimitDoc.exists) {
        // First request - allow and create record
        await adminDb.collection('RateLimits').doc(key).set({
          requests: [now],
          lastRequest: now
        });
        return { allowed: true };
      }

      const data = rateLimitDoc.data();
      const recentRequests = (data.requests || [])
        .filter(timestamp => timestamp > windowStart);

      if (recentRequests.length >= limits.maxRequests) {
        return {
          allowed: false,
          reason: limits.message || 'Rate limit exceeded'
        };
      }

      // Allow request and update counter
      await adminDb.collection('RateLimits').doc(key).update({
        requests: [...recentRequests, now],
        lastRequest: now
      });

      return { allowed: true };

    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if rate limiting fails
      return { allowed: true };
    }
  }
}
```

#### 2. Add to API routes
```javascript
// app/api/admin/users/route.js
import { AdminRateLimiter } from '@/lib/services/serviceAdmin/server/rateLimiter';

export async function GET(request) {
  // ... existing auth code ...

  // Add rate limiting check
  const rateLimitCheck = await AdminRateLimiter.checkRateLimit(
    email,
    'VIEW_USERS'
  );

  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: rateLimitCheck.reason },
      { status: 429 }
    );
  }

  // ... rest of the code ...
}
```

---

## Layer 5: Authentication (✅ Implemented)

**Current Status:** ✅ Working
**File:** `app/api/admin/users/route.js`

```javascript
async function verifyAdminToken(token) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      isValid: true,
      email: decodedToken.email,
      isAdmin: AdminService.isServerAdmin(decodedToken.email),
      uid: decodedToken.uid
    };
  } catch (error) {
    return { isValid: false, isAdmin: false, error: error.code };
  }
}
```

---

## Layer 6: Permission Check (🔄 Partial)

**Current Status:** 🔄 Basic implementation (email check only)
**Improvement needed:** Feature flag integration

### Current Implementation
```javascript
// lib/services/serviceAdmin/server/adminService.js
static isServerAdmin(email) {
  if (!email) return false;

  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  return adminEmails
    .map(e => e.toLowerCase().trim())
    .includes(email.toLowerCase().trim());
}
```

### Enhanced Implementation (To Add)
```javascript
// lib/services/serviceAdmin/server/adminService.js
import { ADMIN_FEATURES } from '../constants/adminConstants';

static async checkAdminPermission(email, feature) {
  // 1. Basic admin check
  if (!this.isServerAdmin(email)) {
    return {
      allowed: false,
      reason: 'Not an admin user'
    };
  }

  // 2. Feature flag check (optional granular permissions)
  // Future: Could store admin permissions in Firestore
  // For now, all admins have all permissions

  return {
    allowed: true,
    reason: null
  };
}

// Usage in API routes:
const permissionCheck = await AdminService.checkAdminPermission(
  email,
  ADMIN_FEATURES.VIEW_USERS
);

if (!permissionCheck.allowed) {
  return NextResponse.json(
    { error: permissionCheck.reason },
    { status: 403 }
  );
}
```

---

## Layer 7: Business Logic (✅ Implemented)

**Current Status:** ✅ Working
**File:** `lib/services/serviceAdmin/server/adminService.js`

All business logic properly isolated in service layer:
- `getAllUsers()` - Fetch and process users
- `getUserDetail()` - Fetch user details
- Data sanitization
- Analytics processing
- Statistics calculation

---

## 🎯 Implementation Priority

### High Priority (Do Next)
1. **Layer 2:** Component Guard (AdminProtection)
2. **Layer 4:** Rate Limiting
3. **Layer 6:** Enhanced permission checks

### Medium Priority
4. Audit logging for all admin actions
5. IP-based blocking for suspicious activity
6. Session management enhancements

### Low Priority
7. Advanced fingerprinting
8. ML-based anomaly detection
9. Real-time alerting

---

## 📊 Testing Each Layer

### Layer 1: Client Check
```bash
# Should use AdminService
✓ Verify AdminService.fetchUsers() is called
✓ Verify proper error handling
✓ Verify no direct fetch() calls
```

### Layer 2: Component Guard
```bash
# Should block non-admin users
✓ Test with admin email - should allow
✓ Test with non-admin email - should redirect
✓ Test with no auth - should redirect
✓ Test loading state
```

### Layer 3: API Call
```bash
# Should send JWT token
✓ Verify Authorization header present
✓ Verify Bearer token format
✓ Verify token is valid
```

### Layer 4: Rate Limiting
```bash
# Should enforce rate limits
✓ Send 61 requests in 1 minute - should block 61st
✓ Wait 1 minute - should reset
✓ Test different operations have different limits
```

### Layer 5: Authentication
```bash
# Should verify tokens
✓ Valid token - should pass
✓ Expired token - should reject (401)
✓ Invalid token - should reject (401)
✓ No token - should reject (401)
```

### Layer 6: Permission Check
```bash
# Should check admin status
✓ Admin email - should pass
✓ Non-admin email - should reject (403)
✓ Invalid email - should reject (403)
```

### Layer 7: Business Logic
```bash
# Should execute operations
✓ Fetch users - should return data
✓ Sanitization - should remove sensitive fields
✓ Analytics - should process correctly
```

---

## 🔒 Security Best Practices

1. **Never trust client-side checks** - Always verify server-side
2. **Use environment variables** - Store admin emails in ADMIN_EMAILS
3. **Rate limit aggressively** - Prevent abuse
4. **Log all admin actions** - Audit trail
5. **Sanitize all data** - Never expose sensitive fields
6. **Use strong tokens** - Firebase JWT tokens
7. **Implement timeouts** - Prevent long-running operations
8. **Monitor for abuse** - Track suspicious patterns

---

## 📚 References

- Contact Service Pattern: `lib/services/serviceContact/`
- Business Card Service: `lib/services/serviceContact/server/businessCardService.js`
- Session Management: `lib/server/session.js`
- API Client: `lib/services/core/ApiClient.js`

---

**Status:** Phase 1 Complete, Phase 2 Ready to Implement
**Next Step:** Implement Layer 2 (Component Guard)
