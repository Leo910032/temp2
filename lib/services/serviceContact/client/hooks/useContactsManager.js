// app/dashboard/(dashboard pages)/contacts/components/useContactsManager.js
"use client"

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from "@/lib/translation/useTranslation";

// ✅ 1. SINGLE, CLEAN IMPORT BLOCK from the main service hub
import { 
    getContacts, 
    getContactGroups, 
    getContactStats, 
    getContactSubscriptionStatus,
    CONTACT_FEATURES 
} from '@/lib/services/serviceContact';

// --- A safe, default initial state for pagination ---
const initialPagination = { limit: 100, offset: 0, hasMore: false };

export function useContactsManager(currentUser) {
    const { t } = useTranslation();

    // --- State Management (this part is well-structured) ---
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState(null);

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({ /* default stats object */ });
    
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [pagination, setPagination] = useState(initialPagination);

    // ✅ 2. SIMPLIFIED DATA FETCHING LOGIC
    const reloadData = useCallback(async (options = { append: false, reset: false }) => {
        // This function now only fetches the main contact/group/stats data.
        // It assumes subscription status has already been loaded.
        
        setLoading(true);
        try {
            const currentOffset = options.append ? pagination.offset : 0;

            const [contactsResult, groupsResult, statsResult] = await Promise.all([
                getContacts({
                    status: filter !== 'all' ? filter : undefined,
                    search: searchTerm || undefined,
                    limit: pagination.limit,
                    offset: currentOffset
                }),
                getContactGroups(),
                getContactStats()
            ]);

            const newContacts = contactsResult?.contacts || [];
            
            if (options.append) {
                setContacts(prev => [...prev, ...newContacts]);
            } else {
                setContacts(newContacts);
            }

            setPagination({
                limit: pagination.limit,
                offset: currentOffset + newContacts.length,
                hasMore: contactsResult?.hasMore || false
            });
            
            setGroups(groupsResult?.groups || []);
            setStats(statsResult?.stats || {});

        } catch (error) {
            console.error("Error reloading contact data:", error);
            toast.error(t('contacts.failed_to_load') || 'Failed to load contact data');
        } finally {
            setLoading(false);
        }
    }, [filter, searchTerm, pagination.limit, pagination.offset, t]);

    // ✅ 3. RESTRUCTURED EFFECTS for a clean data flow
    useEffect(() => {
        // This is the main "entry point" effect. It runs once when the user loads the page.
        if (!currentUser) return;

        const initialize = async () => {
            setSubscriptionLoading(true);
            setLoading(true);

            try {
                // STEP 1: Always fetch subscription status first.
                const subStatus = await getContactSubscriptionStatus();
                setSubscriptionStatus(subStatus);

                // STEP 2: If the user has access, then fetch the rest of the data.
                if (subStatus?.features?.includes(CONTACT_FEATURES.BASIC_CONTACTS)) {
                    await reloadData({ reset: true });
                }
            } catch (err) {
                console.error("Error fetching subscription status:", err);
                setSubscriptionError("Failed to load subscription.");
            } finally {
                setSubscriptionLoading(false);
                setLoading(false); // Stop initial loading after subscription check
            }
        };

        initialize();
    }, [currentUser]); // This effect should only re-run if the user changes.

    useEffect(() => {
        // This effect is ONLY for reacting to filter/search changes.
        if (!subscriptionLoading && subscriptionStatus?.features?.includes(CONTACT_FEATURES.BASIC_CONTACTS)) {
            const handler = setTimeout(() => {
                reloadData({ reset: true });
            }, 300); // Debounce search
            return () => clearTimeout(handler);
        }
    }, [searchTerm, filter]); // It no longer depends on reloadData or subscriptionStatus

    // --- Derived State (Client-side filtering by group) ---
    const filteredContacts = contacts.filter(contact => {
        if (selectedGroupIds.length === 0) return true;
        return selectedGroupIds.some(groupId => {
            const group = groups.find(g => g.id === groupId);
            return group?.contactIds?.includes(contact.id);
        });
    });

    return {
        contacts: filteredContacts,
        allOriginalContacts: contacts, // The full list before group filtering
        groups,
        stats,
        loading,
        pagination,
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