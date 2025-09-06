"use client"
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { app } from '@/important/firebase'; 
import { getContacts, getContactGroups, getContactStats, getContactSubscriptionStatus, CONTACT_FEATURES, contactCache } from '@/lib/services/serviceContact';

const db = getFirestore(app);

export function useContactsManager(currentUser) {
    // --- State Management ---
    const [subscriptionStatus, setSubscriptionStatus] = useState(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState(null);
    const [error, setError] = useState(null);

    // MASTER DATA LISTS - Populated by real-time listeners
    const [allContacts, setAllContacts] = useState([]);
    const [groups, setGroups] = useState([]);

    // UI/DERIVED STATE
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [pagination, setPagination] = useState({ limit: 20 }); // Simplified pagination

    // --- Main Data Loading and Real-time Listening Effect ---
    useEffect(() => {
        if (!currentUser?.uid) return;

        console.log("🚀 Setting up main data listeners for user:", currentUser.uid);
        setLoading(true);

        // Fetch non-real-time data once
        Promise.all([
            getContactSubscriptionStatus(),
            getContactStats()
        ]).then(([subStatus, statsResult]) => {
            setSubscriptionStatus(subStatus);
            setStats(statsResult?.stats || {});
            setSubscriptionLoading(false);
            if (!subStatus?.features?.includes(CONTACT_FEATURES.BASIC_CONTACTS)) {
                throw new Error("Subscription does not include contacts access.");
            }
        }).catch(err => {
            console.error("❌ Initial data fetch error:", err);
            setSubscriptionError("Failed to load your subscription status.");
            setLoading(false);
        });

        // Setup real-time listener for CONTACTS
        const contactsDocRef = doc(db, "Contacts", currentUser.uid);
        const unsubscribeContacts = onSnapshot(contactsDocRef, (docSnap) => {
            console.log("🔥 Firestore listener fired: Contacts updated.");
            const contactsData = docSnap.exists() ? docSnap.data().contacts || [] : [];
            contactsData.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
            setAllContacts(contactsData);
            setLoading(false); // Stop loading once we have contacts
        });

        // Setup real-time listener for GROUPS
        const groupsDocRef = doc(db, "ContactGroups", currentUser.uid);
        const unsubscribeGroups = onSnapshot(groupsDocRef, (docSnap) => {
            console.log("🔥 Firestore listener fired: Groups updated.");
            const groupsData = docSnap.exists() ? docSnap.data().groups || [] : [];
            setGroups(groupsData);
        });

        // Cleanup function
        return () => {
            console.log("🔌 Detaching Firestore listeners.");
            unsubscribeContacts();
            unsubscribeGroups();
        };
    }, [currentUser?.uid]);
    
    // --- Client-Side Filtering and Pagination Logic (using useMemo for performance) ---
// useContactsManager.js - UPDATED

    // --- Client-Side Filtering and Pagination Logic (using useMemo for performance) ---
    const filteredContacts = useMemo(() => {
        let result = [...allContacts];

        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            result = result.filter(c => 
                c.name?.toLowerCase().includes(lowercasedTerm) || 
                c.email?.toLowerCase().includes(lowercasedTerm) ||
                c.company?.toLowerCase().includes(lowercasedTerm) ||
                c.notes?.toLowerCase().includes(lowercasedTerm) // ✅ ADD THIS LINE
            );
        }

        if (filter !== 'all') {
            result = result.filter(c => c.status === filter);
        }

        // Note: Group filtering can be added here if needed

        return result;
    }, [allContacts, searchTerm, filter]);

// ... rest of the file is unchanged
    const paginatedContacts = useMemo(() => {
        return filteredContacts.slice(0, pagination.limit);
    }, [filteredContacts, pagination.limit]);

    const hasMore = useMemo(() => {
        return paginatedContacts.length < filteredContacts.length;
    }, [paginatedContacts.length, filteredContacts.length]);

    const loadMoreContacts = useCallback(() => {
        setPagination(prev => ({ ...prev, limit: prev.limit + 20 }));
    }, []);
    
    // --- Manual Reload Function (for critical cache clearing) ---
    const reloadData = useCallback(async (options = {}) => {
        if (!currentUser?.uid) return;
        console.log(`🔄 Manual data reload requested:`, options);
        contactCache.clear();
        
        try {
            // Manually re-fetch. The listeners will pick up the changes anyway,
            // but this gives immediate feedback.
            const [_, statsResult] = await Promise.all([
                getContactGroups({ force: true }),
                getContactStats({ force: true }),
            ]);
            setStats(statsResult?.stats || {});
        } catch (error) {
            console.error('❌ Failed to manually reload data:', error);
            toast.error('Failed to refresh data.');
        }
    }, [currentUser?.uid]);

    return {
        contacts: paginatedContacts, // Return the final, visible list
        allOriginalContacts: allContacts,
        groups,
        stats,
        loading,
        error,
        pagination: { hasMore, onLoadMore: loadMoreContacts },
        subscriptionStatus,
        subscriptionLoading,
        subscriptionError,
        filter, setFilter,
        searchTerm, setSearchTerm,
        selectedGroupIds, setSelectedGroupIds,
        reloadData
    };
}