// app/dashboard/(dashboard pages)/contacts/components/useContactsManager.js
"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from "@/lib/translation/useTranslation";

// Import client-side firestore for the listener
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
// ✅ FIX: Import the now-exported `app` instance correctly
import { app } from '@/important/firebase'; 

import { 
    getContacts, 
    getContactGroups, 
    getContactStats, 
    getContactSubscriptionStatus,
    CONTACT_FEATURES,
    // ✅ FIX: This import will now work
    contactCache 
} from '@/lib/services/serviceContact';

// ✅ FIX: Use the correctly imported `app`
const db = getFirestore(app);

export function useContactsManager(currentUser) {
    const { t } = useTranslation();

    // --- State Management ---
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState(null);

    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({});
    
    const [loading, setLoading] = useState(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    
    const [pagination, setPagination] = useState({ limit: 10, offset: 0, hasMore: true });
    
    // useRef to prevent re-running listener setup on every render
    const listenerUnsubscribe = useRef(null);

    // --- Data Fetching Logic ---
    const loadMoreContacts = useCallback(async () => {
        if (!pagination.hasMore || loading) return;

        setLoading(true);
        try {
            const result = await getContacts({
                status: filter !== 'all' ? filter : undefined,
                search: searchTerm || undefined,
                limit: pagination.limit,
                offset: pagination.offset
            });

            const newContacts = result?.contacts || [];
            setContacts(prev => [...prev, ...newContacts]);
            setPagination(prev => ({
                ...prev,
                offset: prev.offset + newContacts.length,
                hasMore: result?.hasMore || false
            }));
        } catch (error) {
            console.error("Error loading more contacts:", error);
            toast.error(t('contacts.failed_to_load_more') || 'Failed to load more contacts');
        } finally {
            setLoading(false);
        }
    }, [pagination.hasMore, pagination.limit, pagination.offset, loading, filter, searchTerm, t]);

    // --- Real-time Firestore Listener ---
    useEffect(() => {
        if (!currentUser?.uid || !initialLoadComplete) {
            return;
        }

        // Clean up previous listener if it exists
        if (listenerUnsubscribe.current) {
            listenerUnsubscribe.current();
        }

        const docRef = doc(db, "Contacts", currentUser.uid);
        
        listenerUnsubscribe.current = onSnapshot(docRef, (docSnap) => {
            console.log("🔥 Firestore listener fired: Contacts updated in real-time.");
            if (docSnap.exists()) {
                const allContactsData = docSnap.data().contacts || [];
                // Sort newest first
                allContactsData.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

                // This is a simplified update. When the listener fires, we just show the most recent
                // data up to the current offset. This prevents a sudden list jump.
                const currentVisibleContacts = allContactsData.slice(0, pagination.offset);
                setContacts(currentVisibleContacts);

                // Manually update the cache with the fresh data from the listener
                // This keeps the cache in sync with real-time updates.
                const cacheKey = `contacts_${JSON.stringify({ status: 'all', search: '', limit: pagination.limit, offset: 0 })}`;
                contactCache.set(cacheKey, { contacts: allContactsData.slice(0, pagination.limit), hasMore: allContactsData.length > pagination.limit }, 'contacts');
                
                // Also refresh stats
                getContactStats().then(statsResult => setStats(statsResult?.stats || {}));

            } else {
                setContacts([]);
            }
        }, (error) => {
            console.error("Error with contacts listener:", error);
            // Don't show a toast for permissions errors as they can be noisy on startup
            if (error.code !== 'permission-denied') {
               toast.error("Real-time connection lost.");
            }
        });

        // Cleanup function
        return () => {
            if (listenerUnsubscribe.current) {
                console.log("🔌 Detaching Firestore listener.");
                listenerUnsubscribe.current();
            }
        };
    }, [currentUser?.uid, initialLoadComplete, pagination.offset]); // Re-attach if user or initial load status changes

    // --- Main Initialization Effect ---
    useEffect(() => {
        if (!currentUser) return;

        const initialize = async () => {
            setSubscriptionLoading(true);
            setLoading(true);
            setContacts([]);
            setPagination({ limit: 10, offset: 0, hasMore: true });
            setInitialLoadComplete(false); // Reset this on re-init

            try {
                // 1. Fetch subscription first
                const subStatus = await getContactSubscriptionStatus();
                setSubscriptionStatus(subStatus);

                if (subStatus?.features?.includes(CONTACT_FEATURES.BASIC_CONTACTS)) {
                    // 2. Fetch groups and initial stats
                    const [groupsResult, statsResult] = await Promise.all([
                        getContactGroups(),
                        getContactStats()
                    ]);
                    setGroups(groupsResult?.groups || []);
                    setStats(statsResult?.stats || {});

                    // 3. Progressive Loading: Load first 10, then 10, then 10.
                    let loadedContacts = [];
                    let currentOffset = 0;
                    let hasMore = true;

                    for (let i = 0; i < 3 && hasMore; i++) {
                        const result = await getContacts({
                            status: filter !== 'all' ? filter : undefined,
                            search: searchTerm || undefined,
                            limit: 10,
                            offset: currentOffset
                        });
                        
                        const newContacts = result?.contacts || [];
                        loadedContacts = [...loadedContacts, ...newContacts];
                        setContacts([...loadedContacts]); // Update UI progressively
                        
                        currentOffset += newContacts.length;
                        hasMore = result?.hasMore || false;
                    }
                    
                    setPagination({ limit: 10, offset: currentOffset, hasMore });
                    setInitialLoadComplete(true); // Enable the listener now
                }
            } catch (err) {
                console.error("Initialization Error:", err);
                setSubscriptionError("Failed to load your contacts dashboard.");
            } finally {
                setSubscriptionLoading(false);
                setLoading(false);
            }
        };

        const debounce = setTimeout(() => initialize(), 300); // Debounce search/filter changes
        return () => clearTimeout(debounce);

    }, [currentUser, searchTerm, filter]); // Re-run initialization on user, search, or filter change

    // reloadData is now simplified to just load more
    const reloadData = useCallback((options = {}) => {
        if (options.append) {
            loadMoreContacts();
        }
    }, [loadMoreContacts]);

    return {
        contacts,
        allOriginalContacts: contacts, // Kept for components that need the full unfiltered list
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
        reloadData // This function is now just for 'load more'
    };
}