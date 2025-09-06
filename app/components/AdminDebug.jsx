// components/AdminDebug.jsx - Temporary component to debug admin access
"use client"
import { useAuth } from "@/contexts/AuthContext";
import { isAdmin } from "@/lib/adminAuth";
import { useEffect, useState } from "react";

export default function AdminDebug() {
    const { currentUser } = useAuth();
    const [adminStatus, setAdminStatus] = useState(null);

    useEffect(() => {
        if (currentUser) {
            console.log('🔍 AdminDebug - Current User:', {
                email: currentUser.email,
                emailVerified: currentUser.emailVerified,
                uid: currentUser.uid
            });
            
            const isUserAdmin = isAdmin(currentUser.email);
            setAdminStatus(isUserAdmin);
            
            console.log('🔐 AdminDebug - Admin Check Result:', isUserAdmin);
        } else {
            console.log('🔍 AdminDebug - No current user');
            setAdminStatus(false);
        }
    }, [currentUser]);

    // This component is just for debugging - remove it later
    if (!currentUser) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg p-4 text-sm z-50">
            <div className="font-bold">Admin Debug Info:</div>
            <div>Email: {currentUser.email}</div>
            <div>Is Admin: {adminStatus ? '✅ YES' : '❌ NO'}</div>
            <div>Email Verified: {currentUser.emailVerified ? '✅' : '❌'}</div>
        </div>
    );
}