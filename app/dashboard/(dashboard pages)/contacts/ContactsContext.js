// app/dashboard/(dashboard pages)/contacts/ContactsContext.js
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { ContactsService } from '@/lib/services/serviceContact/client/services/ContactService.js';
import { SemanticSearchService } from '@/lib/services/serviceContact/client/services/SemanticSearchService';
import { CONTACT_FEATURES } from '@/lib/services/constants';

const ContactsContext = createContext(null);

export function useContacts() {
    const context = useContext(ContactsContext);
    if (!context) {
        throw new Error('useContacts must be used within ContactsProvider');
    }
    return context;
}

export function ContactsProvider({ children }) {
    const { currentUser, permissions, isLoading: isSessionLoading } = useDashboard();
    
    // Core data state
    const [contacts, setContacts] = useState([]);
    const [groups, setGroups] = useState([]);
const [stats, setStats] = useState({
    total: 0,
    new: 0,
    viewed: 0,
    withLocation: 0
});    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadError, setHasLoadError] = useState(false);
    
    // Filter and search state
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);
    
    // AI Search state
    const [searchMode, setSearchMode] = useState('standard');
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [aiSearchResults, setAiSearchResults] = useState(null);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [searchStage, setSearchStage] = useState('idle');
    
    // Pagination state
    const [pagination, setPagination] = useState({
        hasMore: false,
        lastDoc: null,
        currentPage: 1
    });
    
    // Usage tracking state
    const [usageInfo, setUsageInfo] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);
    
    // Refs
    const hasInitiallyLoaded = useRef(false);
    const componentId = useRef(Math.random().toString(36).substring(7));
    
    // Feature checking helper
    const hasFeature = useCallback((feature) => {
        return permissions?.[feature] || false;
    }, [permissions]);
    
    // Fetch contacts data
    const fetchContactsData = useCallback(async (options = {}) => {
        const { force = false, append = false, clearCache = false } = options;
        
        if (!currentUser) {
            setContacts([]);
            setGroups([]);
            setStats(null);
            setIsLoading(false);
            return;
        }
        
        if (!append) setIsLoading(true);
        setHasLoadError(false);
        
        try {
            console.log(`📥 [${componentId.current}] Fetching contacts data...`, options);
            
            const result = await ContactsService.getAllContactsWithGroups({
                userId: currentUser.uid,
                filter,
                searchTerm,
                selectedGroupIds,
                force,
                clearCache
            });
            
            if (append && pagination.lastDoc) {
                setContacts(prev => [...prev, ...(result.contacts || [])]);
            } else {
                setContacts(result.contacts || []);
            }
            
            setGroups(result.groups || []);
            setStats(result.stats || null);
            setPagination(result.pagination || { hasMore: false, lastDoc: null });
            
            hasInitiallyLoaded.current = true;
            console.log(`✅ [${componentId.current}] Contacts data loaded`);
            
        } catch (error) {
            console.error(`❌ [${componentId.current}] Failed to fetch contacts:`, error);
            setHasLoadError(true);
            toast.error(error.message || 'Failed to load contacts');
        } finally {
            setIsLoading(false);
        }
    }, [currentUser, filter, searchTerm, selectedGroupIds, pagination.lastDoc]);
    
    // Fetch usage info
    const fetchUsageInfo = useCallback(async () => {
        if (!currentUser || !hasFeature(CONTACT_FEATURES.BUSINESS_AI_SEARCH)) return;
        
        setUsageLoading(true);
        try {
            const usage = await ContactsService.getUsageInfo(currentUser.uid);
            setUsageInfo(usage);
        } catch (error) {
            console.error('Failed to fetch usage info:', error);
        } finally {
            setUsageLoading(false);
        }
    }, [currentUser, hasFeature]);
    
    // Enhanced search function
    const handleEnhancedSearch = useCallback(async (query, useAI = false) => {
        if (!query.trim()) {
            setAiSearchResults(null);
            setSearchTerm('');
            setSearchStage('idle');
            return;
        }
        
        if (useAI && hasFeature(CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH)) {
            console.log('🚀 Starting AI search...');
            setIsAiSearching(true);
            setAiSearchResults([]);
            setSearchStage('vector_search');
            
            try {
                const result = await SemanticSearchService.search(query, {
                    userId: currentUser?.uid,
                    maxResults: 10,
                    enhanceResults: hasFeature(CONTACT_FEATURES.BUSINESS_AI_SEARCH),
                    useCache: true
                });
                
                setAiSearchResults(result.results || []);
                setSearchStage('complete');
                
                toast.success(`Found ${result.results?.length || 0} relevant contacts!`);
                
            } catch (error) {
                console.error('AI search failed:', error);
                setSearchStage('idle');
                toast.error(`AI search failed: ${error.message}`);
                setAiSearchResults([]);
            } finally {
                setIsAiSearching(false);
            }
        } else {
            // Standard search
            setSearchTerm(query);
            setAiSearchResults(null);
            setSearchStage('idle');
        }
    }, [currentUser, hasFeature]);
    
    // Clear search
    const clearSearch = useCallback(() => {
        setAiSearchResults(null);
        setAiSearchQuery('');
        setSearchMode('standard');
        setSearchStage('idle');
        setSearchTerm('');
    }, []);
    
    // Create contact
    const createContact = useCallback(async (contactData) => {
        try {
            const result = await ContactsService.createContact({
                userId: currentUser.uid,
                contactData
            });
            
            await fetchContactsData({ force: true, clearCache: true });
            toast.success('Contact created!');
            
            return result;
        } catch (error) {
            console.error('Failed to create contact:', error);
            toast.error(error.message || 'Failed to create contact');
            throw error;
        }
    }, [currentUser, fetchContactsData]);
    
    // Update contact
    const updateContact = useCallback(async (contactId, updates) => {
        try {
            const result = await ContactsService.updateContact({
                contactId,
                updates
            });
            
            await fetchContactsData({ force: true, clearCache: true });
            toast.success('Contact updated!');
            
            return result;
        } catch (error) {
            console.error('Failed to update contact:', error);
            toast.error(error.message || 'Failed to update contact');
            throw error;
        }
    }, [fetchContactsData]);
    
    // Delete contact
    const deleteContact = useCallback(async (contactId) => {
        if (!confirm('Are you sure you want to delete this contact?')) {
            return;
        }
        
        try {
            await ContactsService.deleteContact(contactId);
            await fetchContactsData({ force: true, clearCache: true });
            toast.success('Contact deleted!');
        } catch (error) {
            console.error('Failed to delete contact:', error);
            toast.error(error.message || 'Failed to delete contact');
            throw error;
        }
    }, [fetchContactsData]);
    
    // Initial data load
    useEffect(() => {
        if (currentUser && !isSessionLoading) {
            if (!hasInitiallyLoaded.current) {
                console.log(`🚀 [${componentId.current}] Initial contacts load`);
                fetchContactsData();
                fetchUsageInfo();
            }
        }

        // Cleanup on user change
        if (!currentUser && !isSessionLoading) {
            console.log(`👋 [${componentId.current}] User logged out, clearing data`);
            setContacts([]);
            setGroups([]);
            setStats(null);
            setUsageInfo(null);
            hasInitiallyLoaded.current = false;
        }
    }, [currentUser, isSessionLoading, fetchContactsData, fetchUsageInfo]);

    // Subscribe to real-time contacts updates
    useEffect(() => {
        if (!currentUser) return;

        console.log(`👂 [${componentId.current}] Setting up contacts listener`);

        // Subscribe to ContactsService updates
        const unsubscribe = ContactsService.subscribe((updatedData) => {
            console.log(`🔔 [${componentId.current}] Contacts updated via listener`, updatedData);

            // Update local state with fresh data
            if (updatedData.contacts) setContacts(updatedData.contacts);
            if (updatedData.groups) setGroups(updatedData.groups);
            if (updatedData.stats) setStats(updatedData.stats);
            if (updatedData.pagination) setPagination(updatedData.pagination);
        });

        // Cleanup subscription on unmount or user change
        return () => {
            console.log(`🔕 [${componentId.current}] Removing contacts listener`);
            unsubscribe();
        };
    }, [currentUser]);
    
    // Context value
    const contextValue = useMemo(() => ({
        // Data
        contacts,
        groups,
        stats,
        usageInfo,
        
        // Loading states
        isLoading,
        hasLoadError,
        usageLoading,
        isAiSearching,
        
        // Filters and search
        filter,
        setFilter,
        searchTerm,
        setSearchTerm,
        selectedGroupIds,
        setSelectedGroupIds,
        
        // AI Search
        searchMode,
        setSearchMode,
        aiSearchQuery,
        setAiSearchQuery,
        aiSearchResults,
        searchStage,
        
        // Pagination
        pagination,
        
        // Actions
        createContact,
        updateContact,
        deleteContact,
        handleEnhancedSearch,
        clearSearch,
        refreshData: () => fetchContactsData({ force: true, clearCache: true }),
        refreshUsageInfo: fetchUsageInfo,
        
        // Helpers
        hasFeature,
        currentUser
        
    }), [
        contacts,
        groups,
        stats,
        usageInfo,
        isLoading,
        hasLoadError,
        usageLoading,
        isAiSearching,
        filter,
        searchTerm,
        selectedGroupIds,
        searchMode,
        aiSearchQuery,
        aiSearchResults,
        searchStage,
        pagination,
        createContact,
        updateContact,
        deleteContact,
        handleEnhancedSearch,
        clearSearch,
        fetchContactsData,
        fetchUsageInfo,
        hasFeature,
        currentUser
    ]);
    
    return (
        <ContactsContext.Provider value={contextValue}>
            {children}
        </ContactsContext.Provider>
    );
}