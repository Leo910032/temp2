//app/[userId]/error.jsx
'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error but don't show it to users if it's the known React DOM issue
        if (error?.message?.includes('removeChild') || error?.message?.includes('not a child')) {
            console.warn('⚠️ Caught known React DOM iframe error (non-critical):', error.message);
        } else {
            console.error('❌ Profile page error:', error);
        }
    }, [error]);

    // Don't show error UI for the known removeChild issue
    if (error?.message?.includes('removeChild') || error?.message?.includes('not a child')) {
        return null; // Silently ignore
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong!</h2>
                <p className="text-gray-600 mb-4">
                    {error?.message || 'An unexpected error occurred'}
                </p>
                <button
                    onClick={reset}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
