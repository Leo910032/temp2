//app/dashboard/(dashboard pages)/contacts/components/useContactsManager.js
"use client"

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from "@/lib/translation/useTranslation";
import { getContacts, getContactGroups, getContactStats } from '@/lib/services/contactsService';
import { getContactSubscriptionStatus, CONTACT_FEATURES } from '@/lib/services/contactSubscriptionService';

// --- A safe, default initial state for pagination ---
const initialPagination = { limit: 100, offset: 0, hasMore: false };

export function useContactsManager(currentUser) {
    const { t } = useTranslation();

    // --- State Management ---
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState(null);

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({ 
        total: 0, 
        byStatus: { new: 0, viewed: 0, archived: 0 }, 
        locationStats: { withLocation: 0 },
    });

    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [pagination, setPagination] = useState(initialPagination);

    // --- Data Fetching Logic ---
    const reloadData = useCallback(async (options = { append: false }) => {
        if (!subscriptionStatus?.canAccessContacts) return;

        setLoading(true);
        try {
            const contactFilters = {
                status: filter !== 'all' ? filter : undefined,
                search: searchTerm || undefined,
                limit: pagination.limit,
                offset: options.append ? pagination.offset : 0
            };

            const [contactsResult, groupsResult, statsResult] = await Promise.all([
                getContacts(contactFilters),
                subscriptionStatus.features.includes(CONTACT_FEATURES.BASIC_GROUPS) 
                    ? getContactGroups() 
                    : Promise.resolve({ groups: [] }),
                getContactStats()
            ]);

            // Defensive Check: Ensure results are valid before setting state
            const newContacts = contactsResult?.contacts || [];
            const newPaginationData = contactsResult?.pagination || {};

            if (options.append) {
                setContacts(prev => [...prev, ...newContacts]);
            } else {
                setContacts(newContacts);
            }

            setPagination(prev => ({
                ...prev,
                offset: options.append ? prev.offset + newContacts.length : newContacts.length,
                hasMore: newPaginationData.hasMore || false // Safely access hasMore
            }));

            setGroups(groupsResult?.groups || []);
            setStats(statsResult || stats);

        } catch (error) {
            toast.error(t('contacts.failed_to_load') || 'Failed to load contact data');
            if (error.type === 'subscription') setSubscriptionError(error.message);
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm, pagination.limit, pagination.offset, subscriptionStatus, t]);

    // --- Effects ---
    useEffect(() => {
        if (currentUser) {
            setSubscriptionLoading(true);
            getContactSubscriptionStatus()
                .then(setSubscriptionStatus)
                .catch(err => setSubscriptionError("Failed to load subscription."))
                .finally(() => setSubscriptionLoading(false));
        }
    }, [currentUser]);

    useEffect(() => {
        if (!subscriptionStatus) return;
        const handler = setTimeout(() => {
            // Reset pagination and contacts before fetching new filtered data
            setPagination(initialPagination);
            setContacts([]);
            reloadData({ append: false });
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm, filter, subscriptionStatus]); // reloadData is not needed here

    // --- Derived State (Filtering) ---
    const filteredContacts = contacts.filter(contact => {
        if (selectedGroupIds.length === 0) return true;
        return selectedGroupIds.some(groupId => {
            const group = groups.find(g => g.id === groupId);
            return group?.contactIds?.includes(contact.id);
        });
    });

    // --- Return everything the UI component needs ---
    return {
        contacts: filteredContacts,
        allOriginalContacts: contacts,
        groups,
        stats,
        loading,
        pagination, // This is now guaranteed to be an object
        subscriptionStatus,
        subscriptionLoading,
        subscriptionError,
        filter,
        setFilter,
        searchTerm,
        setSearchTerm,
        selectedGroupIds,
        setSelectedGroupIds,
        reloadData,
    };
}