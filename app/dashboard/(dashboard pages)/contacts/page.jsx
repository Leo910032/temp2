// app/dashboard/(dashboard pages)/contacts/page.jsx
"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { ContactsProvider, useContacts } from './ContactsContext';
import { CONTACT_FEATURES } from '@/lib/services/constants';
import { useMapVisibility } from '../../MapVisibilityContext';

// Import child components
import ContactsList from './components/contacts/ContactsList';
import GroupList from './components/contacts/GroupList';
import SearchBar from './components/SearchBar';
import StatsCards from './components/StatsCards';
import UsageCards from './components/UsageCards';
import ContactModals from './components/contacts/ContactModals';
import ContactsMap from './components/ContactsMap';
import BudgetInfoCard from '../../general components/BudgetInfoCard';
import { AnimatePresence } from 'framer-motion';

// Wrapper component to provide context
export default function ContactsPageWrapper() {
    return (
        <ContactsProvider>
            <ContactsPage />
        </ContactsProvider>
    );
}

function ContactsPage() {
    const { t, isInitialized } = useTranslation();
    const { isLoading: isSessionLoading, subscriptionLevel, budgetInfo, budgetLoading } = useDashboard();
    const isPremium = subscriptionLevel === 'premium' || subscriptionLevel === 'business' || subscriptionLevel === 'enterprise';
    const { setIsMapOpen } = useMapVisibility();

    // Get everything from context
    const {
        contacts,
        groups,
        stats,
        usageInfo,
        isLoading,
        hasLoadError,
        usageLoading,
        isAiSearching,
        filter,
        setFilter,
        searchTerm,
        aiSearchResults,
        searchSessionId, // Get sessionId from context
        searchMode,
        setSearchMode,
        aiSearchQuery,
        setAiSearchQuery,
        searchStage,
        pagination,
        createContact,
        updateContact,
        deleteContact,
        handleEnhancedSearch,
        clearSearch,
        refreshData,
        refreshUsageInfo,
        hasFeature
    } = useContacts();
    
    // Local UI state (only for modals and temporary UI)
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scannedFields, setScannedFields] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showGroupManager, setShowGroupManager] = useState(false);
    const [showImportExportModal, setShowImportExportModal] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [selectedContactForMap, setSelectedContactForMap] = useState(null);
    const [focusLocation, setFocusLocation] = useState(null);

    // View mode and focus state for interactive filtering
    const [viewMode, setViewMode] = useState('contacts'); // 'contacts' | 'groups'
    const [focus, setFocus] = useState(null); // null | { type: 'contact', id: string } | { type: 'group', id: string }

    // Update map visibility in context
    useEffect(() => {
        // Set the context to true if either the map OR the scanner OR the review modal is open
        setIsMapOpen(showMap || showScanner || showReviewModal);
    }, [showMap, showScanner, showReviewModal, setIsMapOpen]);

    // Translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('contacts.title') || 'Contacts',
            subtitle: t('contacts.subtitle') || 'Manage your contacts and networking connections',
            totalContacts: t('contacts.stats.total') || 'Total Contacts',
            newContacts: t('contacts.stats.new') || 'New',
            viewedContacts: t('contacts.stats.viewed') || 'Viewed',
            withLocation: t('contacts.stats.with_location') || 'With Location',
            loading: t('common.loading') || 'Loading...',
            loadingContacts: t('contacts.loading') || 'Loading contacts...',
            loadingSession: t('common.loading_session') || 'Loading session...',
            tryAgain: t('common.try_again') || 'Try Again',
            upgradePlan: t('common.upgrade_plan') || 'Upgrade Plan',
            featureNotAvailable: t('contacts.feature_not_available') || 'Contacts Feature Not Available',
            requiresUpgrade: t('contacts.requires_upgrade') || 'Your current subscription plan doesn\'t include contact management features.'
        };
    }, [t, isInitialized]);

    // Contact action handler
    const handleContactAction = useCallback(async (action, data) => {
        try {
            switch (action) {
                case 'update':
                    await updateContact(data.id, data);
                    setShowEditModal(false);
                    break;
                    
                case 'delete':
                    await deleteContact(data.id || data);
                    break;
                    
                case 'email':
                    if (data.email) window.open(`mailto:${data.email}`);
                    break;
                    
                case 'phone':
                    if (data.phone) window.open(`tel:${data.phone}`);
                    break;
                    
                case 'map':
                    setSelectedContactForMap(data);
                    setShowMap(true);
                    break;
                    
                default:
                    console.warn('Unknown contact action:', action);
            }
        } catch (error) {
            console.error('Contact action failed:', error);
            toast.error(error.message || `Failed to ${action} contact`);
        }
    }, [updateContact, deleteContact]);

    const handleMapView = useCallback((contact) => {
        if (!contact) return;
        handleContactAction('map', contact);
    }, [handleContactAction]);

    // Focus mode handlers
    const handleShowGroups = useCallback((contactId) => {
        setFocus({ type: 'contact', id: contactId });
        setViewMode('groups');
    }, []);

    const handleShowMembers = useCallback((groupId) => {
        setFocus({ type: 'group', id: groupId });
        setViewMode('contacts');
    }, []);

    const handleBackToAll = useCallback(() => {
        setFocus(null);
    }, []);

    // Filtered data based on focus mode
    const filteredContacts = useMemo(() => {
        if (!focus) return aiSearchResults || contacts;
        if (focus.type === 'group') {
            const group = groups.find(g => g.id === focus.id);
            if (!group) return [];
            return (aiSearchResults || contacts).filter(c => group.contactIds?.includes(c.id));
        }
        return aiSearchResults || contacts;
    }, [focus, contacts, groups, aiSearchResults]);

    const filteredGroups = useMemo(() => {
        if (!focus) return groups;
        if (focus.type === 'contact') {
            return groups.filter(g => g.contactIds?.includes(focus.id));
        }
        return groups;
    }, [focus, groups]);

    console.log(
        'FEATURE CHECK: Business Card Scanner ->',
        hasFeature(CONTACT_FEATURES.BUSINESS_CARD_SCANNER)
    );

    // Loading states
    if (isSessionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                    <span>{translations.loadingSession}</span>
                </div>
            </div>
        );
    }

    if (!isInitialized) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-pulse">Loading translations...</div>
            </div>
        );
    }

    if (isLoading && contacts.length === 0) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span>{translations.loadingContacts}</span>
                </div>
            </div>
        );
    }

    if (hasLoadError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-500 mb-4">Failed to load contacts</p>
                    <button 
                        onClick={() => refreshData()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {translations.tryAgain}
                    </button>
                </div>
            </div>
        );
    }

    // Permission check
    if (!hasFeature(CONTACT_FEATURES.BASIC_CONTACTS)) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center p-6 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">{translations.featureNotAvailable}</h2>
                    <p className="text-gray-600 mb-6">{translations.requiresUpgrade}</p>
                    <button className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        {translations.upgradePlan}
                    </button>
                </div>
            </div>
        );
    }

    // Main render
    return (
        <div className="flex-1 w-full py-3 sm:py-4 max-h-full overflow-y-auto">
            <div className="w-full">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 sm:mb-2">
                        {translations.title}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">{translations.subtitle}</p>
                </div>

                {/* Budget Information Card */}
                <BudgetInfoCard
                    budgetInfo={budgetInfo}
                    budgetLoading={budgetLoading}
                    compact={false}
                />

                {/* Stats Cards */}
                <StatsCards stats={stats} translations={translations} />

                {/* Usage Info Cards (if available) */}
                <UsageCards 
                    usageInfo={usageInfo}
                    usageLoading={usageLoading}
                    hasFeature={hasFeature}
                />

                {/* Search Bar */}
                <SearchBar
                    searchMode={searchMode}
                    setSearchMode={setSearchMode}
                    searchTerm={searchTerm}
                    aiSearchQuery={aiSearchQuery}
                    setAiSearchQuery={setAiSearchQuery}
                    isAiSearching={isAiSearching}
                    handleEnhancedSearch={handleEnhancedSearch}
                    hasFeature={hasFeature}
                />

                {/* Action Buttons */}
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
                    {/* Mobile Layout: Grid + Select */}
                    <div className="block sm:hidden space-y-3">
                        {/* Filter Dropdown */}
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm border border-gray-300 bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">{t('contacts.filters.all_status') || 'All Status'}</option>
                            <option value="new">{t('contacts.filters.new') || 'New'}</option>
                            <option value="viewed">{t('contacts.filters.viewed') || 'Viewed'}</option>
                            <option value="archived">{t('contacts.filters.archived') || 'Archived'}</option>
                        </select>

                        {/* Action Buttons Grid */}
                        <div className="grid grid-cols-2 gap-2">
                            {hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION) && (
                                <button
                                    onClick={() => setShowMap(true)}
                                    className="px-3 py-2.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 text-sm"
                                    disabled={contacts.filter(c => c.location?.latitude).length === 0}
                                >
                                    <span>🗺️</span>
                                    <span>{t('contacts.buttons.map_view') || 'Map View'}</span>
                                </button>
                            )}

                            {(hasFeature(CONTACT_FEATURES.BASIC_CARD_SCANNER) || hasFeature(CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER)) && (
                                <button
                                    onClick={() => {
                                        console.log("ACCESS GRANTED: User opened the Business Card Scanner.");
                                        setShowScanner(true);
                                    }}
                                    className="px-3 py-2.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center gap-1.5 text-sm"
                                >
                                    <span>📇</span>
                                    <span>{t('contacts.buttons.scan_card') || 'Scan Card'}</span>
                                </button>
                            )}

                            <button
                                onClick={() => setShowGroupManager(true)}
                                className="px-3 py-2.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center justify-center gap-1.5 text-sm col-span-2"
                            >
                                <span>👥</span>
                                <span>{t('contacts.buttons.manage_groups', { count: groups.length }) || `Manage Groups (${groups.length})`}</span>
                            </button>

                            {hasFeature(CONTACT_FEATURES.EXPORT_DATA) && (
                                <button
                                    onClick={() => setShowImportExportModal(true)}
                                    className="px-3 py-2.5 bg-gray-700 text-white rounded-md hover:bg-gray-800 flex items-center justify-center gap-1.5 text-sm col-span-2"
                                >
                                    <span>📥</span>
                                    <span>{t('contacts.buttons.import_export') || 'Import / Export'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Desktop Layout: Original Flex */}
                    <div className="hidden sm:flex flex-wrap items-center justify-end gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">{t('contacts.filters.all_status') || 'All Status'}</option>
                            <option value="new">{t('contacts.filters.new') || 'New'}</option>
                            <option value="viewed">{t('contacts.filters.viewed') || 'Viewed'}</option>
                            <option value="archived">{t('contacts.filters.archived') || 'Archived'}</option>
                        </select>

                        {hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION) && (
                            <button
                                onClick={() => setShowMap(true)}
                                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
                                disabled={contacts.filter(c => c.location?.latitude).length === 0}
                            >
                                {t('contacts.buttons.map_view') || 'Map View'}
                            </button>
                        )}

                        {hasFeature(CONTACT_FEATURES.EXPORT_DATA) && (
                            <button
                                onClick={() => setShowImportExportModal(true)}
                                className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
                            >
                                {t('contacts.buttons.import_export') || 'Import / Export'}
                            </button>
                        )}

                        {(hasFeature(CONTACT_FEATURES.BASIC_CARD_SCANNER) || hasFeature(CONTACT_FEATURES.AI_ENHANCED_CARD_SCANNER)) && (
                            <button
                                onClick={() => {
                                    console.log("ACCESS GRANTED: User opened the Business Card Scanner.");
                                    setShowScanner(true);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                            >
                                {t('contacts.buttons.scan_card') || 'Scan Card'}
                            </button>
                        )}

                        <button
                            onClick={() => setShowGroupManager(true)}
                            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                        >
                            {t('contacts.buttons.manage_groups', { count: groups.length }) || `Manage Groups (${groups.length})`}
                        </button>
                    </div>
                </div>

                {/* View Toggle */}
                {!focus && (
                    <div className="bg-white p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6">
                        <div className="flex items-center justify-center">
                            <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
                                <button
                                    onClick={() => setViewMode('contacts')}
                                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                                        viewMode === 'contacts'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span>Contacts ({contacts.length})</span>
                                    </span>
                                </button>
                                <button
                                    onClick={() => setViewMode('groups')}
                                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
                                        viewMode === 'groups'
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <span>Groups ({groups.length})</span>
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Back Button for Focus Mode */}
                {focus && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 sm:p-4 rounded-lg shadow mb-4 sm:mb-6 border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-blue-900">
                                        {focus.type === 'contact' ? 'Showing Groups for Contact' : 'Showing Members of Group'}
                                    </h3>
                                    <p className="text-sm text-blue-700">
                                        {focus.type === 'contact'
                                            ? `${filteredGroups.length} group${filteredGroups.length !== 1 ? 's' : ''} found`
                                            : `${filteredContacts.length} member${filteredContacts.length !== 1 ? 's' : ''} found`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleBackToAll}
                                className="px-4 py-2 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Back to All {focus.type === 'contact' ? 'Groups' : 'Contacts'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Contacts List */}
                <div className="relative">
                    <AnimatePresence mode="wait">
                        {viewMode === 'contacts' ? (
                            <ContactsList
                                key="contacts"
                                contacts={filteredContacts}
                            isPremium={isPremium}
                            selectionMode={selectionMode}
                            selectedContacts={selectedContacts}
                            onToggleSelection={(id) => setSelectedContacts(prev =>
                                prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
                            )}
                            onEdit={(contact) => {
                                setEditingContact(contact);
                                setShowEditModal(true);
                            }}
                            onAction={handleContactAction}
                            onMapView={handleMapView}
                            onShowGroups={handleShowGroups}
                            hasMore={!focus && pagination.hasMore}
                            onLoadMore={() => refreshData({ append: true })}
                            loading={isLoading}
                            groups={groups}
                            isAiSearch={!!aiSearchResults}
                            searchMode={searchMode}
                            searchSessionId={searchSessionId} // Pass sessionId for feedback button
                            onClearSearch={clearSearch}
                            />
                        ) : (
                            <GroupList
                                key="groups"
                                groups={filteredGroups}
                            contacts={contacts}
                            onShowMembers={handleShowMembers}
                            onEdit={(group) => {
                                // Open group manager with this group selected for editing
                                setShowGroupManager(true);
                            }}
                            onDelete={async (groupId) => {
                                // Handle group deletion
                                try {
                                    const groupsService = await import('@/lib/services/serviceContact/client/services/GroupService');
                                    await groupsService.GroupService.deleteGroup(currentUser.uid, groupId);
                                    refreshData();
                                    toast.success('Group deleted successfully');
                                } catch (error) {
                                    console.error('Failed to delete group:', error);
                                    toast.error('Failed to delete group');
                                }
                            }}
                            onShowLocation={(location) => {
                                setFocusLocation(location);
                                setShowMap(true);
                            }}
                            loading={isLoading}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* All Modals */}
            <ContactModals
                // Edit modal props
                editingContact={editingContact}
                showEditModal={showEditModal}
                onCloseEdit={() => {
                    setShowEditModal(false);
                    setEditingContact(null);
                }}
                onSaveContact={(contact) => handleContactAction('update', contact)}
                
                // Scanner modal props
                showScanner={showScanner}
                onCloseScanner={() => setShowScanner(false)}
                onContactParsed={(fields) => {
                    setScannedFields(fields);
                    setShowReviewModal(true);
                    setShowScanner(false);
                }}
                
                // Review modal props
                showReviewModal={showReviewModal}
                onCloseReview={() => {
                    setShowReviewModal(false);
                    setScannedFields(null);
                }}
                scannedFields={scannedFields}
                onSaveScanned={async (editedData) => {
                    try {
                        const contactData = {};

                        // 1. Process standard fields
                        if (editedData.standardFields) {
                            editedData.standardFields.forEach(field => {
                                const label = field.label.toLowerCase().trim();
                                const value = field.value?.trim();

                                if (value) {
                                    if (label === 'name' || label === 'full name') contactData.name = value;
                                    else if (label.includes('email')) contactData.email = value;
                                    else if (label.includes('company')) contactData.company = value;
                                    else if (label.includes('job title') || label === 'title') contactData.jobTitle = value;
                                    else if (label.includes('website')) contactData.website = value;
                                    // Note: Phone is handled separately below
                                }
                            });
                        }

                        // 2. Process dynamic fields
                        contactData.dynamicFields = editedData.dynamicFields?.filter(f => f.value?.trim()) || [];

                        // 3. Process phone numbers
                        if (editedData.phoneNumbers && editedData.phoneNumbers.length > 0) {
                            contactData.phoneNumbers = editedData.phoneNumbers.map(phone => ({ number: phone, type: 'Mobile' }));
                        }

                        // 4. Final Validation: Ensure a name was found
                        if (!contactData.name) {
                            toast.error('Contact must have a name.');
                            return; // Stop the save process
                        }

                        // 5. Add default metadata
                        contactData.source = 'business_card_scan';
                        contactData.status = 'new';
                        if (editedData.metadata) {
                            contactData.scanMetadata = editedData.metadata;
                        }

                        // 6. Call the createContact function from context
                        await createContact(contactData);

                        // Close the modal
                        setShowReviewModal(false);
                        setScannedFields(null);

                    } catch (error) {
                        console.error('onSaveScanned failed:', error);
                        // Toast is already handled by createContact
                    }
                }}
                
                // Group manager props
                showGroupManager={showGroupManager}
                onCloseGroupManager={() => setShowGroupManager(false)}
                onRefreshData={refreshData}
                onRefreshUsage={refreshUsageInfo}
                onShowLocationOnMap={(location) => {
                    setFocusLocation(location);
                    setShowMap(true);
                    setShowGroupManager(false);
                }}

                // Import/Export props
                showImportExportModal={showImportExportModal}
                onCloseImportExport={() => setShowImportExportModal(false)}
                
                // Map props
                showMap={showMap}
                onCloseMap={() => {
                    setShowMap(false);
                    setSelectedContactForMap(null);
                    setFocusLocation(null);
                }}
                selectedContactForMap={selectedContactForMap}
                focusLocation={focusLocation}
                contacts={contacts}
                groups={groups}
                
                // Share modal props
                showShareModal={showShareModal}
                onCloseShare={() => {
                    setShowShareModal(false);
                    setSelectionMode(false);
                    setSelectedContacts([]);
                }}
                selectedContacts={selectedContacts}
                
                // Common props
                hasFeature={hasFeature}
                usageInfo={usageInfo}
            />
        </div>
    );
}
