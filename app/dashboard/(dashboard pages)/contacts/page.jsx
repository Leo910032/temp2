// app/dashboard/(dashboard pages)/contacts/page.jsx

"use client"
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import dynamic from 'next/dynamic';
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
    getContactUpgradeMessage, // Assuming this is also exported from the main index
    hasContactFeature,      // Assuming this is also exported from the main index

    // Error Handler
    ErrorHandler

} from '@/lib/services/serviceContact'; 

// Import UI Components
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import { ShareContactsModal } from './components/ShareContactsModal';
import GroupManagerModal from './components/GroupManagerModal';

// =============================================================================
// --- MAIN ENTERPRISE CONTACT PAGE ---
// =============================================================================
export default function ContactsPage() {
    const { t } = useTranslation();
    const { currentUser } = useAuth();

    // Use the contact manager hook (corrected path)
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
    const [showMap, setShowMap] = useState(false);
    const [selectedContactForMap, setSelectedContactForMap] = useState(null);
    const [editingContact, setEditingContact] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showGroupManager, setShowGroupManager] = useState(false);

    // Enterprise-style action handlers
    const handleGroupAction = useCallback(async (action, data) => {
        const toastId = toast.loading('Processing group action...');
        
        try {
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
                case 'addContacts':
                    result = await addContactsToGroup(data.groupId, data.contactIds);
                    break;
                case 'removeContacts':
                    result = await removeContactsFromGroup(data.groupId, data.contactIds);
                    break;
                default:
                    throw new Error(`Unknown group action: ${action}`);
            }
            
            toast.success('Group action successful!', { id: toastId });
            await reloadData();
            
            return result;
        } catch (error) {
            console.error(`Group action ${action} failed:`, error);
            toast.error(`Failed: ${error.message}`, { id: toastId });
            throw error;
        }
    }, [reloadData]);

    const handleContactAction = useCallback(async (action, data) => {
        const toastId = toast.loading('Processing contact action...');
        
        try {
            let result;
            
            switch (action) {
                case 'create':
                    result = await createContact(data);
                    break;
                case 'update':
                    result = await updateContact(data.id, data);
                    setShowEditModal(false);
                    setEditingContact(null);
                    break;
                case 'delete':
                    if (!window.confirm(`Are you sure you want to delete ${data.name || 'this contact'}?`)) {
                        toast.dismiss(toastId);
                        return;
                    }
                    result = await deleteContact(data.id || data);
                    break;
                case 'statusUpdate':
                    result = await updateContactStatus(data.id, data.status);
                    break;
                case 'bulkUpdate':
                    result = await bulkUpdateContacts(data.contactIds, data.updates);
                    break;
                case 'import':
                    result = await importContacts(data.file, data.format);
                    break;
                case 'export':
                    result = await exportContacts(data.format, data.filters);
                    break;
                default:
                    throw new Error(`Unknown contact action: ${action}`);
            }
            
            toast.success('Contact action successful!', { id: toastId });
            await reloadData();
            
            return result;
        } catch (error) {
            console.error(`Contact action ${action} failed:`, error);
            toast.error(`Failed: ${error.message}`, { id: toastId });
            throw error;
        }
    }, [reloadData]);

    const handleBusinessCardScan = useCallback(async (parsedFields) => {
        const toastId = toast.loading('Saving scanned contact...');
        
        try {
            const result = await createContactFromScan(parsedFields);
            
            toast.success('Contact saved from business card!', { id: toastId });
            setShowReviewModal(false);
            setScannedFields(null);
            await reloadData();
            
            return result;
        } catch (error) {
            console.error('Business card scan failed:', error);
            toast.error(`Failed to save contact: ${error.message}`, { id: toastId });
            throw error;
        }
    }, [reloadData]);

    const handleTeamSharing = useCallback(async (contactIds, teamMemberIds, permissions) => {
        const toastId = toast.loading('Sharing contacts with team...');
        
        try {
            const result = await shareContactsWithTeam(contactIds, teamMemberIds, permissions);
            
            toast.success(`Shared ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} with team!`, { id: toastId });
            setShowShareModal(false);
            setSelectionMode(false);
            setSelectedContacts([]);
            
            return result;
        } catch (error) {
            console.error('Team sharing failed:', error);
            toast.error(`Failed to share contacts: ${error.message}`, { id: toastId });
            throw error;
        }
    }, []);

    const handleGetTeamMembers = useCallback(async () => {
        try {
            return await getTeamMembersForSharing();
        } catch (error) {
            console.error('Failed to load team members:', error);
            throw error;
        }
    }, []);

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
            </div>
        );
    }

    if (subscriptionError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <p className="text-red-500">⚠️ {subscriptionError}</p>
            </div>
        );
    }

    if (!hasFeature(CONTACT_FEATURES.BASIC_CONTACTS)) {
        return <ContactsUpgradeRequired subscriptionStatus={subscriptionStatus} />;
    }

    if (loading && contacts.length === 0 && !searchTerm) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    const counts = { 
        all: stats?.total || 0, 
        new: stats?.byStatus?.new || 0, 
        viewed: stats?.byStatus?.viewed || 0, 
        archived: stats?.byStatus?.archived || 0, 
        withLocation: stats?.withLocation || 0
    };

    // Main render
    return (
        <div className="flex-1 py-2 flex flex-col max-h-full overflow-y-auto pb-20">
            {/* --- ENTERPRISE MODALS --- */}
            <EditContactModal 
                contact={editingContact} 
                isOpen={showEditModal} 
                onClose={() => {
                    setShowEditModal(false);
                    setEditingContact(null);
                }} 
                onSave={(updatedContact) => handleContactAction('update', updatedContact)} 
            />

            <GroupManagerModal 
                isOpen={showGroupManager} 
                onClose={() => setShowGroupManager(false)} 
                groups={groups} 
                contacts={allOriginalContacts} 
                onGroupAction={handleGroupAction}
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
                onShare={handleTeamSharing} 
                onGetTeamMembers={handleGetTeamMembers}
                hasFeature={hasFeature}
            />

            {/* Map Modal */}
            {showMap && hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION) && (
                <ContactMapModal
                    isOpen={showMap}
                    onClose={() => setShowMap(false)}
                    contacts={selectedContactForMap ? [selectedContactForMap] : allOriginalContacts.filter(c => c.location?.latitude)}
                    selectedContact={selectedContactForMap}
                    groups={groups}
                    selectedGroupIds={selectedGroupIds}
                    onGroupToggle={(gid) => setSelectedGroupIds(p => p.includes(gid) ? p.filter(id => id !== gid) : [...p, gid])}
                    onGroupAction={handleGroupAction}
                />
            )}
            
            <div className="p-3 sm:p-4">
                {/* Enterprise UI Components */}
                <ContactsHeader 
                    subscriptionStatus={subscriptionStatus}
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelectionMode={() => setSelectionMode(!selectionMode)}
                    onSelectAll={() => setSelectedContacts(contacts.map(c => c.id))}
                    onClearSelection={() => setSelectedContacts([])}
                    onShareSelected={() => setShowShareModal(true)}
                    onScanCard={() => setShowScanner(true)}
                    onOpenGroupManager={() => setShowGroupManager(true)}
                    groupsCount={groups.length}
                    onGenerateAutoGroups={() => handleGroupAction('generate')}
                    loading={loading}
                    hasFeature={hasFeature}
                />

                <MobileFilters 
                    filter={filter} 
                    setFilter={setFilter} 
                    searchTerm={searchTerm} 
                    setSearchTerm={setSearchTerm} 
                    counts={counts} 
                    locationStats={stats.locationStats || { withLocation: 0 }}
                    onMapView={() => { 
                        if (hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION)) {
                            setSelectedContactForMap(null); 
                            setShowMap(true);
                        } else {
                            toast.error('Map visualization requires a Pro subscription');
                        }
                    }}
                    groups={groups}
                    selectedGroupIds={selectedGroupIds}
                    onGroupToggle={(gid) => setSelectedGroupIds(p => p.includes(gid) ? p.filter(id => id !== gid) : [...p, gid])}
                    hasFeature={hasFeature}
                />

                <ContactsList 
                    contacts={contacts} 
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelection={(cid) => setSelectedContacts(p => p.includes(cid) ? p.filter(id => id !== cid) : [...p, cid])}
                    onEdit={(c) => { 
                        setEditingContact(c); 
                        setShowEditModal(true); 
                    }}
                    onStatusUpdate={(id, status) => handleContactAction('statusUpdate', { id, status })}
                    onDelete={(id) => {
                        const contact = contacts.find(c => c.id === id) || allOriginalContacts.find(c => c.id === id);
                        handleContactAction('delete', { id, name: contact?.name });
                    }}
                    onContactAction={(action, contact) => { 
                        if (action === 'email' && contact.email) {
                            window.open(`mailto:${contact.email}`);
                        }
                        if (action === 'phone' && contact.phone) {
                            window.open(`tel:${contact.phone}`);
                        }
                    }}
                    onMapView={(contact) => { 
                        if (hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION)) {
                            setSelectedContactForMap(contact); 
                            setShowMap(true);
                        } else {
                            toast.error('Map visualization requires a Pro subscription');
                        }
                    }}
                    hasMore={pagination.hasMore}
                    onLoadMore={() => reloadData({ append: true })}
                    loading={loading}
                    groups={groups}
                    hasFeature={hasFeature}
                />
            </div>
            
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
                onSave={handleBusinessCardScan} 
            />
        </div>
    );
}

// =============================================================================
// --- ENTERPRISE UI COMPONENTS ---
// =============================================================================

// Field icon helper component
const FieldIcon = ({ label }) => {
    const l = label.toLowerCase();
    if (l.includes('name')) return <span className="text-gray-400">👤</span>;
    if (l.includes('email')) return <span className="text-gray-400">✉️</span>;
    if (l.includes('phone') || l.includes('tel') || l.includes('mobile')) return <span className="text-gray-400">📞</span>;
    if (l.includes('company') || l.includes('organisation')) return <span className="text-gray-400">🏢</span>;
    if (l.includes('website') || l.includes('url')) return <span className="text-gray-400">🌐</span>;
    if (l.includes('qr')) return <span className="text-gray-400">🔳</span>;
    if (l.includes('linkedin')) return <span className="text-gray-400">💼</span>;
    if (l.includes('address') || l.includes('location')) return <span className="text-gray-400">📍</span>;
    if (l.includes('twitter')) return <svg className="w-3 h-3 text-gray-400" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6904H306.615L611.412 515.685L658.88 583.579L1055.08 1150.31H892.476L569.165 687.854V687.828Z" fill="currentColor"/></svg>;
    return <span className="text-gray-400">📄</span>;
};

// Helper function to get group colors consistently
function getGroupColor(groupId, groups) {
    const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}