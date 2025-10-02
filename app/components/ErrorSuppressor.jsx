//app/components/ErrorSuppressor.jsx
'use client';

import { useEffect } from 'react';

/**
 * Component to suppress known non-critical React DOM errors
 * This specifically handles the "removeChild" error that occurs with iframes and dynamic routing
 */
export default function ErrorSuppressor() {
    useEffect(() => {
        // Only suppress in production or when needed
        if (typeof window === 'undefined') return;

        // Store original console.error
        const originalError = console.error;

        // Override console.error to filter out known iframe errors
        console.error = (...args) => {
            const errorString = args.join(' ');

            // Suppress known non-critical errors
            if (
                errorString.includes('removeChild') &&
                errorString.includes('not a child of this node')
            ) {
                // Log a warning instead
                console.warn('⚠️ Suppressed known React DOM iframe error (non-critical)');
                return;
            }

            // Call original console.error for all other errors
            originalError.apply(console, args);
        };

        // Cleanup
        return () => {
            console.error = originalError;
        };
    }, []);

    return null; // This component renders nothing
}
