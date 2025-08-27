// lib/services/adminService.js - NEW FILE
import { auth } from '@/important/firebase';

/**
 * Check if current user has admin access via API
 * This hits the server-side admin check endpoint
 */
export async function checkAdminAccess() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    try {
        const token = await user.getIdToken(false);
        
        const response = await fetch('/api/admin/users/check', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Admin check failed:', response.status, response.statusText);
            return { isAdmin: false };
        }

        const result = await response.json();
        console.log('✅ Admin check result:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Admin check error:', error);
        return { isAdmin: false };
    }
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers() {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('User not authenticated');
    }

    try {
        const token = await user.getIdToken(false);
        
        const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            let errorMessage = 'Failed to fetch users';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        return response.json();
        
    } catch (error) {
        console.error('❌ Get users error:', error);
        throw error;
    }
}
