// lib/services/serviceContact/client/hooks/useExchange.js
"use client"

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { 
    submitExchangeContact,
    getCurrentLocation,
    checkLocationPermission,
    verifyProfileByUsername,
    verifyProfileByUserId 
} from '@/lib/services/serviceContact';

export function useExchange() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [location, setLocation] = useState(null);
    const [locationPermission, setLocationPermission] = useState({ state: 'unavailable', supported: false });

    // Initialize location services
    const initializeLocation = useCallback(async () => {
        try {
            const permission = await checkLocationPermission();
            setLocationPermission(permission);
            
            if (permission.state === 'granted') {
                const userLocation = await getCurrentLocation();
                setLocation(userLocation);
            }
            
            return permission;
        } catch (error) {
            console.error('Error initializing location:', error);
            return { state: 'unavailable', supported: false };
        }
    }, []);

    // Request location permission and get location
    const requestLocation = useCallback(async () => {
        try {
            const userLocation = await getCurrentLocation({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            });
            
            setLocation(userLocation);
            setLocationPermission(prev => ({ ...prev, state: 'granted' }));
            
            return userLocation;
        } catch (error) {
            console.error('Error requesting location:', error);
            
            if (error.message.includes('denied')) {
                setLocationPermission(prev => ({ ...prev, state: 'denied' }));
            }
            
            throw error;
        }
    }, []);

    // Submit exchange contact
    const submitContact = useCallback(async (exchangeData) => {
        setIsSubmitting(true);
        
        try {
            const result = await submitExchangeContact({
                ...exchangeData,
                contact: {
                    ...exchangeData.contact,
                    location: location
                },
                metadata: {
                    ...exchangeData.metadata,
                    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
                    referrer: typeof window !== 'undefined' ? document.referrer : '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    language: navigator.language || 'en'
                }
            });
            
            return result;
        } finally {
            setIsSubmitting(false);
        }
    }, [location]);

    // Verify profile exists and is available
    const verifyProfile = useCallback(async (identifier, type = 'username') => {
        try {
            if (type === 'userId') {
                return await verifyProfileByUserId(identifier);
            } else {
                return await verifyProfileByUsername(identifier);
            }
        } catch (error) {
            console.error('Error verifying profile:', error);
            throw error;
        }
    }, []);

    // Reset all state
    const reset = useCallback(() => {
        setLocation(null);
        setLocationPermission({ state: 'unavailable', supported: false });
        setIsSubmitting(false);
    }, []);

    return {
        // State
        isSubmitting,
        location,
        locationPermission,
        
        // Actions
        initializeLocation,
        requestLocation,
        submitContact,
        verifyProfile,
        reset,
        
        // Computed values
        hasLocation: !!location,
        canRequestLocation: locationPermission.supported && 
                           (locationPermission.state === 'prompt' || 
                            locationPermission.state === 'unavailable')
    };
}