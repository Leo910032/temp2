// lib/hooks/useContactSubscription.js - Frontend Hook for Contact Features
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/important/firebase';
import { 
    getContactFeatureStatus, 
    canAccessContacts, 
    validateContactAction,
    getContactLimitations,
    getContactUpgradeSuggestions
} from '@/lib/services/contactSubscriptionService';
import { getUserSubscription } from '@/lib/services/subscriptionService';

export function useContactSubscription() {
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [subscriptionStatus, setSubscriptionStatus] = useState({
        loading: true,
        level: 'base',
        features: null,
        limitations: [],
        upgradeSuggestion: null,
        canAccessContacts: false
    });

    useEffect(() => {
        const fetchSubscriptionStatus = async () => {
            if (!user) {
                setSubscriptionStatus(prev => ({
                    ...prev,
                    loading: false,
                    canAccessContacts: false
                }));
                return;
            }

            try {
                const subscription = await getUserSubscription();
                const subscriptionLevel = subscription.level || 'base';
                
                const featureStatus = getContactFeatureStatus(subscriptionLevel);
                const limitations = getContactLimitations(subscriptionLevel);
                const upgradeSuggestion = getContactUpgradeSuggestions(subscriptionLevel);
                const contactAccess = canAccessContacts(subscriptionLevel);

                setSubscriptionStatus({
                    loading: false,
                    level: subscriptionLevel,
                    features: featureStatus,
                    limitations: limitations,
                    upgradeSuggestion: upgradeSuggestion,
                    canAccessContacts: contactAccess,
                    subscription: subscription
                });

            } catch (error) {
                console.error('Error fetching subscription status:', error);
                setSubscriptionStatus({
                    loading: false,
                    level: 'base',
                    features: null,
                    limitations: [],
                    upgradeSuggestion: null,
                    canAccessContacts: false,
                    error: error.message
                });
            }
        };

        fetchSubscriptionStatus();
    }, [user]);

    const validateAction = async (action) => {
        try {
            return await validateContactAction(action);
        } catch (error) {
            console.error('Error validating contact action:', error);
            return {
                allowed: false,
                reason: 'Unable to verify permissions'
            };
        }
    };

    const hasFeature = (feature) => {
        if (!subscriptionStatus.features) return false;
        return subscriptionStatus.features.features[feature]?.enabled || false;
    };

    const getFeatureStatus = (feature) => {
        if (!subscriptionStatus.features) return 'unknown';
        return subscriptionStatus.features.features[feature]?.status || 'unknown';
    };

    const getUpgradeMessage = (feature) => {
        const limitation = subscriptionStatus.limitations.find(l => 
            l.feature.toLowerCase().includes(feature.toLowerCase())
        );
        return limitation?.message || `Upgrade to access ${feature} features.`;
    };

    const refresh = () => {
        if (user) {
            setSubscriptionStatus(prev => ({ ...prev, loading: true }));
            // Force re-fetch by updating a dependency
            setTimeout(() => {
                fetchSubscriptionStatus();
            }, 100);
        }
    };

    const fetchSubscriptionStatus = async () => {
        if (!user) return;
        
        try {
            const subscription = await getUserSubscription();
            const subscriptionLevel = subscription.level || 'base';
            
            const featureStatus = getContactFeatureStatus(subscriptionLevel);
            const limitations = getContactLimitations(subscriptionLevel);
            const upgradeSuggestion = getContactUpgradeSuggestions(subscriptionLevel);
            const contactAccess = canAccessContacts(subscriptionLevel);

            setSubscriptionStatus({
                loading: false,
                level: subscriptionLevel,
                features: featureStatus,
                limitations: limitations,
                upgradeSuggestion: upgradeSuggestion,
                canAccessContacts: contactAccess,
                subscription: subscription
            });

        } catch (error) {
            console.error('Error fetching subscription status:', error);
            setSubscriptionStatus({
                loading: false,
                level: 'base',
                features: null,
                limitations: [],
                upgradeSuggestion: null,
                canAccessContacts: false,
                error: error.message
            });
        }
    };

    return {
        ...subscriptionStatus,
        user,
        authLoading,
        validateAction,
        hasFeature,
        getFeatureStatus,
        getUpgradeMessage,
        refresh
    };
}