// app/dashboard/(dashboard pages)/contacts/page.jsx

"use client"
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/contexts/AuthContext";

// ✅ PERFECT: ONE single import for all service logic.
import {
    // Hooks
    useContactsManager,

    // Contact Service Functions
    createContact, 
    updateContact, 
    deleteContact, 
    updateContactStatus,
    bulkUpdateContacts,
    importContacts,
    exportContacts,
    createContactFromScan,

    // Group Service Functions
    createContactGroup, 
    deleteContactGroup,
    generateAutoGroups,
    updateContactGroup,
    addContactsToGroup,
    removeContactsFromGroup,

    // Sharing Service Functions
    shareContactsWithTeam,
    getTeamMembersForSharing,

    // Subscription Service Functions & Constants
    CONTACT_FEATURES, 
    getContactUpgradeMessage,
    hasContactFeature,

    // Error Handler
    ErrorHandler

} from '@/lib/services/serviceContact'; 

// Import UI Components that exist
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import { ShareContactsModal } from './components/ShareContactsModal';
import GroupManagerModal from './components/GroupManagerModal';

// =============================================================================
// --- SIMPLIFIED CONTACT PAGE ---
// =============================================================================
export default function ContactsPage() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    // Use the contact manager hook
    const {
        contacts, 
        allOriginalContacts, 
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
        reloadData
    } = useContactsManager(currentUser);

    // UI-only state
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scannedFields, setScannedFields] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [showGroupManager, setShowGroupManager] = useState(false);

    // Enhanced feature checking
    const hasFeature = useCallback((feature) => {
        if (!subscriptionStatus) return false;
        return hasContactFeature(subscriptionStatus.subscriptionLevel, feature);
    }, [subscriptionStatus]);

    // Conditional rendering for loading/error states
    if (subscriptionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading subscription...</span>
            </div>
        );
    }

    if (subscriptionError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-500 mb-4">⚠️ {subscriptionError}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!hasFeature(CONTACT_FEATURES.BASIC_CONTACTS)) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-4">Contacts Feature Not Available</h2>
                    <p className="text-gray-600 mb-4">
                        Your current subscription plan doesn't include contact management features.
                    </p>
                    <button className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Upgrade Plan
                    </button>
                </div>
            </div>
        );
    }

    if (loading && contacts.length === 0 && !searchTerm) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading contacts...</span>
            </div>
        );
    }

    // Main render
    return (
        <div className="flex-1 py-4 px-4 max-h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Contacts</h1>
                    <p className="text-gray-600">
                        Manage your contacts and networking connections
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
                            <div className="text-sm text-gray-600">Total Contacts</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-green-600">{stats.byStatus?.new || 0}</div>
                            <div className="text-sm text-gray-600">New</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-yellow-600">{stats.byStatus?.viewed || 0}</div>
                            <div className="text-sm text-gray-600">Viewed</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-gray-600">{stats.withLocation || 0}</div>
                            <div className="text-sm text-gray-600">With Location</div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Filter */}
                        <div className="flex gap-2">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="new">New</option>
                                <option value="viewed">Viewed</option>
                                <option value="archived">Archived</option>
                            </select>

                            {hasFeature(CONTACT_FEATURES.BUSINESS_CARD_SCANNER) && (
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Scan Card
                                </button>
                            )}

                            <button
                                onClick={() => setShowGroupManager(true)}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                Manage Groups ({groups.length})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Contacts List */}
                <div className="bg-white rounded-lg shadow">
                    {contacts.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="text-gray-400 mb-4">
                                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                            <p className="text-gray-600 mb-4">
                                {searchTerm ? 'Try adjusting your search terms' : 'Get started by scanning a business card or adding your first contact'}
                            </p>
                            {hasFeature(CONTACT_FEATURES.BUSINESS_CARD_SCANNER) && (
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Scan Your First Business Card
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {contacts.map((contact) => (
                                <div key={contact.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {contact.name || 'Unnamed Contact'}
                                            </h3>
                                            <div className="mt-1 text-sm text-gray-600">
                                                {contact.email && (
                                                    <div className="flex items-center">
                                                        <span className="mr-2">✉️</span>
                                                        <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-800">
                                                            {contact.email}
                                                        </a>
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="flex items-center mt-1">
                                                        <span className="mr-2">📞</span>
                                                        <a href={`tel:${contact.phone}`} className="text-blue-600 hover:text-blue-800">
                                                            {contact.phone}
                                                        </a>
                                                    </div>
                                                )}
                                                {contact.company && (
                                                    <div className="flex items-center mt-1">
                                                        <span className="mr-2">🏢</span>
                                                        <span>{contact.company}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                                contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                                contact.status === 'viewed' ? 'bg-green-100 text-green-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                                {contact.status || 'new'}
                                            </span>
                                            
                                            {contact.submittedAt && (
                                                <span className="text-xs text-gray-500">
                                                    {new Date(contact.submittedAt).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {contact.message && (
                                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                            {contact.message}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Load More */}
                    {pagination.hasMore && (
                        <div className="p-4 border-t border-gray-200 text-center">
                            <button
                                onClick={() => reloadData({ append: true })}
                                disabled={loading}
                                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Groups Preview */}
                {groups.length > 0 && (
                    <div className="mt-6 bg-white p-4 rounded-lg shadow">
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Contact Groups</h3>
                        <div className="flex flex-wrap gap-2">
                            {groups.slice(0, 5).map((group) => (
                                <div key={group.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                    {group.name} ({group.contactIds?.length || 0})
                                </div>
                            ))}
                            {groups.length > 5 && (
                                <button
                                    onClick={() => setShowGroupManager(true)}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200"
                                >
                                    +{groups.length - 5} more
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <GroupManagerModal 
                isOpen={showGroupManager} 
                onClose={() => setShowGroupManager(false)} 
                groups={groups} 
                contacts={allOriginalContacts} 
                onGroupAction={async (action, data) => {
                    try {
                        const toastId = toast.loading('Processing group action...');
                        let result;
                        
                        switch (action) {
                            case 'create':
                                result = await createContactGroup(data);
                                break;
                            case 'delete':
                                result = await deleteContactGroup(data);
                                break;
                            case 'update':
                                result = await updateContactGroup(data.id, data);
                                break;
                            case 'generate':
                                result = await generateAutoGroups();
                                break;
                            default:
                                throw new Error(`Unknown group action: ${action}`);
                        }
                        
                        toast.success('Group action successful!', { id: toastId });
                        await reloadData();
                        return result;
                    } catch (error) {
                        console.error(`Group action ${action} failed:`, error);
                        toast.error(`Failed: ${error.message}`);
                        throw error;
                    }
                }}
                loading={loading}
                hasFeature={hasFeature}
            />

            <ShareContactsModal 
                isOpen={showShareModal} 
                onClose={() => { 
                    setShowShareModal(false); 
                    setSelectionMode(false); 
                    setSelectedContacts([]); 
                }} 
                contacts={allOriginalContacts} 
                selectedContactIds={selectedContacts} 
                onShare={async (contactIds, teamMemberIds, permissions) => {
                    try {
                        const result = await shareContactsWithTeam(contactIds, teamMemberIds, permissions);
                        toast.success(`Shared ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} with team!`);
                        setShowShareModal(false);
                        setSelectionMode(false);
                        setSelectedContacts([]);
                        return result;
                    } catch (error) {
                        console.error('Team sharing failed:', error);
                        toast.error(`Failed to share contacts: ${error.message}`);
                        throw error;
                    }
                }}
                onGetTeamMembers={getTeamMembersForSharing}
                hasFeature={hasFeature}
            />
            
            {/* Business Card Scanner Flow */}
            <BusinessCardScanner 
                isOpen={showScanner} 
                onClose={() => setShowScanner(false)} 
                onContactParsed={(parsedFields) => {
                    setScannedFields(parsedFields);
                    setShowReviewModal(true);
                    setShowScanner(false);
                }} 
                hasFeature={hasFeature}
            />

            <ContactReviewModal 
                isOpen={showReviewModal} 
                onClose={() => { 
                    setShowReviewModal(false); 
                    setScannedFields(null); 
                }}
                parsedFields={scannedFields} 
                onSave={async (parsedFields) => {
                    try {
                        const toastId = toast.loading('Saving scanned contact...');
                        const result = await createContactFromScan(parsedFields);
                        toast.success('Contact saved from business card!', { id: toastId });
                        setShowReviewModal(false);
                        setScannedFields(null);
                        await reloadData();
                        return result;
                    } catch (error) {
                        console.error('Business card scan failed:', error);
                        toast.error(`Failed to save contact: ${error.message}`);
                        throw error;
                    }
                }}
            />
        </div>
    );
}