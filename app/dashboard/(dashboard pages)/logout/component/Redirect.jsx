// app/dashboard/(dashboard pages)/logout/component/Redirect.jsx
"use client"
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export default function Redirect() {
    const { logout } = useAuth();

    useEffect(() => {
        logout(); // This will handle sign out and redirect
    }, [logout]);

    return null; // No need to render anything
}