// lib/adminAuth.js
/**
 * Admin authentication utilities
 * Add your email address to the adminEmails array to gain admin access
 */

const adminEmails = [
    'leozul0204@gmail.com', // Replace with your actual email
    // Add more admin emails here if needed
    // 'another-admin@domain.com',
];

/**
 * Check if a user is an admin based on their email
 * @param {string} email - User's email address
 * @returns {boolean} - Whether the user is an admin
 */
export function isAdmin(email) {
    if (!email) return false;
    return adminEmails.includes(email.toLowerCase());
}

/**
 * Verify admin access on the server side
 * @param {Request} request - Next.js request object
 * @returns {Promise<boolean>} - Whether the user has admin access
 */
export async function verifyAdminAccess(request) {
    try {
        // You can implement additional server-side checks here
        // For now, we'll rely on Firebase Auth token verification
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false;
        }

        // In a production app, you'd verify the Firebase token here
        // For now, we'll implement a simpler check
        return true; // We'll handle auth in the API route
    } catch (error) {
        console.error('Admin verification error:', error);
        return false;
    }
}