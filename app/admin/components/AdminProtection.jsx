// app/admin/components/AdminProtection.jsx
"use client"
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/lib/adminAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AdminProtection({ children }) {
    const { currentUser, loading } = useAuth();
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        if (loading) return;

        if (!currentUser) {
            router.push('/login');
            return;
        }

        // Get user's email and check admin status
        const userEmail = currentUser.email;
        if (!isAdmin(userEmail)) {
            router.push('/dashboard');
            return;
        }

        setIsAuthorized(true);
    }, [currentUser, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Verifying admin access...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Checking permissions...</p>
                </div>
            </div>
        );
    }

    return children;
}