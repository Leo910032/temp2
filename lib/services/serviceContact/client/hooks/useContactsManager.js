"use client"
import { useState, useEffect, useCallback, useRef } from 'react';
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

    const [allContacts, setAllContacts] = useState([]); // Holds ALL contacts from Firestore
    const [contacts, setContacts] = useState([]); // Holds the filtered and paginated view
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({});
    
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    const [pagination, setPagination] = useState({ limit: 20, hasMore: true });

    // --- Main Data Loading and Real-time Listening Effect ---
    useEffect(() => {
        if (!currentUser?.uid) return;

        console.log("🚀 Setting up main data listeners for user:", currentUser.uid);
        setLoading(true);

        // Fetch initial subscription status once
        getContactSubscriptionStatus()
            .then(subStatus => {
                setSubscriptionStatus(subStatus);
                if (!subStatus?.features?.includes(CONTACT_FEATURES.BASIC_CONTACTS)) {
                    throw new Error("Subscription does not include contacts access.");
                }
            })
            .catch(err => {
                console.error("❌ Subscription Error:", err);
                setSubscriptionError("Failed to load your subscription status.");
                setLoading(false);
            });

        // Setup real-time listener for CONTACTS
        const contactsDocRef = doc(db, "Contacts", currentUser.uid);
        const unsubscribeContacts = onSnapshot(contactsDocRef, (docSnap) => {
            console.log("🔥 Firestore listener fired: Contacts updated.");
            const allContactsData = docSnap.exists() ? docSnap.data().contacts || [] : [];
            allContactsData.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
            setAllContacts(allContactsData); // Update the master list
            getContactStats().then(statsResult => setStats(statsResult?.stats || {})); // Refresh stats
            setLoading(false);
            setSubscriptionLoading(false);
        }, (err) => {
            console.error("Error with contacts listener:", err);
            toast.error("Real-time connection for contacts lost.");
            setLoading(false);
        });

        // Setup real-time listener for GROUPS
        const groupsDocRef = doc(db, "ContactGroups", currentUser.uid);
        const unsubscribeGroups = onSnapshot(groupsDocRef, (docSnap) => {
            console.log("🔥 Firestore listener fired: Groups updated.");
            const groupsData = docSnap.exists() ? docSnap.data().groups || [] : [];
            setGroups(groupsData);
        }, (err) => {
            console.error("Error with groups listener:", err);
            toast.error("Real-time connection for groups lost.");
        });

        // Cleanup function
        return () => {
            console.log("🔌 Detaching Firestore listeners.");
            unsubscribeContacts();
            unsubscribeGroups();
        };
    }, [currentUser?.uid]);

    // --- Filtering and Pagination Effect ---
    // This effect runs whenever the master list, search term, or filters change.
    useEffect(() => {
        let filtered = [...allContacts];

        // Apply search term filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(c => 
                c.name?.toLowerCase().includes(lowercasedTerm) || 
                c.email?.toLowerCase().includes(lowercasedTerm) ||
                c.company?.toLowerCase().includes(lowercasedTerm)
            );
        }

        // Apply status filter
        if (filter !== 'all') {
            filtered = filtered.filter(c => c.status === filter);
        }

        // Apply group filter
        if (selectedGroupIds.length > 0) {
            const contactIdSet = new Set();
            groups.forEach(group => {
                if (selectedGroupIds.includes(group.id)) {
                    group.contactIds.forEach(id => contactIdSet.add(id));
                }
            });
            filtered = filtered.filter(c => contactIdSet.has(c.id));
        }

        // Apply pagination
        const paginated = filtered.slice(0, pagination.limit);
        setContacts(paginated);
        setPagination(prev => ({ ...prev, hasMore: filtered.length > paginated.length }));

    }, [allContacts, searchTerm, filter, selectedGroupIds, pagination.limit, groups]);

    // --- Load More Logic ---
    const loadMoreContacts = useCallback(() => {
        setPagination(prev => ({ ...prev, limit: prev.limit + 20 }));
    }, []);
    
    // --- Manual Reload Function (for cache clearing) ---
    const reloadData = useCallback(async (options = {}) => {
        if (!currentUser?.uid) return;
        console.log(`🔄 Manual data reload requested:`, options);
        setLoading(true);
        contactCache.clear();
        
        // Refetch everything manually. The listeners will then take over again.
        try {
            const [contactsResult, groupsResult] = await Promise.all([
                getContacts({ force: true }),
                getContactGroups({ force: true })
            ]);
            // The listeners will automatically update the state, but we can set it here for immediate feedback
            setAllContacts(contactsResult.contacts || []);
            setGroups(groupsResult.groups || []);
        } catch (error) {
            console.error('❌ Failed to manually reload data:', error);
            toast.error('Failed to refresh data.');
        } finally {
            setLoading(false);
        }
    }, [currentUser?.uid]);

    return {
        contacts,
        allOriginalContacts: allContacts, // Return the full unfiltered list for modals
        groups,
        stats,
        loading,
        error,
        pagination: { ...pagination, onLoadMore: loadMoreContacts },
        subscriptionStatus,
        subscriptionLoading,
        subscriptionError,
        filter, setFilter,
        searchTerm, setSearchTerm,
        selectedGroupIds, setSelectedGroupIds,
        reloadData
    };
}