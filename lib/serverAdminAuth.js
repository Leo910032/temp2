// lib/serverAdminAuth.js (SERVER-ONLY)
export function isServerAdmin(email) {
    if (!email) return false;
    
    const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
    return adminEmails.map(e => e.toLowerCase().trim())
                     .includes(email.toLowerCase().trim());
}

export async function verifyAdminToken(token) {
    try {
        const { adminAuth } = await import('./firebaseAdmin');
        const decodedToken = await adminAuth.verifyIdToken(token);
        return {
            isValid: true,
            email: decodedToken.email,
            isAdmin: isServerAdmin(decodedToken.email)
        };
    } catch (error) {
        return { isValid: false, isAdmin: false };
    }
}