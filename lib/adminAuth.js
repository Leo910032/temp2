// lib/adminAuth.js
/**
 * Admin authentication utilities
 * Add your email address to the adminEmails array to gain admin access
 */

const adminEmails = [
    'leozul0204@gmail.com',
    'reynard.ladislaslr2004@gmail.com',
     // Replace with your actual email
    // Add more admin emails here if needed
    // 'another-admin@domain.com',
];

/**
 * Check if a user is an admin based on their email
 * @param {string} email - User's email address
 * @returns {boolean} - Whether the user is an admin
 */
export function isAdmin(email) {
    console.log('[AdminAuth] Checking admin status for email:', email);

    if (!email) {
        console.log('[AdminAuth] No email provided, returning false');
        return false;
    }

    const normalizedEmail = email.toLowerCase();
    const isAdminUser = adminEmails.includes(normalizedEmail);

    console.log('[AdminAuth] Email normalized to:', normalizedEmail);
    console.log('[AdminAuth] Is admin:', isAdminUser);
    console.log('[AdminAuth] Admin emails list:', adminEmails);

    return isAdminUser;
}

/**
 * Verify admin access on the server side
 * @param {Request} request - Next.js request object
 * @returns {Promise<boolean>} - Whether the user has admin access
 */
export async function verifyAdminAccess(request) {
    console.log('[AdminAuth] Verifying admin access...');

    try {
        // You can implement additional server-side checks here
        // For now, we'll rely on Firebase Auth token verification
        const authHeader = request.headers.get('authorization');
        console.log('[AdminAuth] Auth header present:', !!authHeader);
        console.log('[AdminAuth] Auth header value:', authHeader ? authHeader.substring(0, 20) + '...' : 'none');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('[AdminAuth] No valid auth header found, returning false');
            return false;
        }

        // In a production app, you'd verify the Firebase token here
        // For now, we'll implement a simpler check
        console.log('[AdminAuth] Auth header validated, returning true');
        return true; // We'll handle auth in the API route
    } catch (error) {
        console.error('[AdminAuth] Admin verification error:', error);
        return false;
    }
}