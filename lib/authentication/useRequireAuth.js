// lib/authentication/useRequireAuth.js
"use client"
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useRequireAuth() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
    }
  }, [currentUser, loading, router]);

  return { currentUser, loading };
}

// For getting current user ID in components
export function useCurrentUserId() {
  const { currentUser } = useAuth();
  return currentUser?.uid || null;
}