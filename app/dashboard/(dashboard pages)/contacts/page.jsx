// app/dashboard/(dashboard pages)/contacts/page.jsx

"use client"
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/contexts/AuthContext";
import dynamic from 'next/dynamic'; // <-- Added for the map component

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

    // --- RE-INTRODUCED UI State for modals and actions ---
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scannedFields, setScannedFields] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false); // For EditContactModal
    const [showGroupManager, setShowGroupManager] = useState(false);
    const [showMap, setShowMap] = useState(false); // For ContactsMap modal
    const [selectedContactForMap, setSelectedContactForMap] = useState(null); // For ContactsMap modal

    // Enhanced feature checking
    const hasFeature = useCallback((feature) => {
        if (!subscriptionStatus) return false;
        return hasContactFeature(subscriptionStatus.subscriptionLevel, feature);
    }, [subscriptionStatus]);

    // --- RE-INTRODUCED: Central handler for contact actions ---
    const handleContactAction = async (action, data) => {
        const toastId = toast.loading('Updating contact...');
        try {
            if (action === 'update') {
    // ✅ FIXED: Pass the contact ID and the data object separately
    await updateContact(data.id, data); 
    setShowEditModal(false);
}
            else if (action === 'delete') {
                if (!confirm('Are you sure you want to delete this contact?')) {
                    toast.dismiss(toastId);
                    return;
                }
                await deleteContact(data); // data is the contact ID
            }
            else if (action === 'statusUpdate') {
                await updateContactStatus(data.id, data.status);
            }
            
            toast.success('Contact updated!', { id: toastId });
            await reloadData();
        } catch (error) {
 const handled = ErrorHandler.handle(error, `contactAction.${action}`);
            toast.error(`Failed: ${handled.message}`, { id: toastId });
            throw handled;        }
    };


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

                {/* --- UPDATED Contacts List --- */}
                {/* This now uses the more powerful ContactsList and ContactCard components */}
                <ContactsList 
                    contacts={contacts} 
                    selectionMode={selectionMode}
                    selectedContacts={selectedContacts}
                    onToggleSelection={(cid) => setSelectedContacts(p => p.includes(cid) ? p.filter(id => id !== cid) : [...p, cid])}
                    onEdit={(c) => { setEditingContact(c); setShowEditModal(true); }}
                    onStatusUpdate={(id, status) => handleContactAction('statusUpdate', { id, status })}
                    onDelete={(id) => handleContactAction('delete', id)}
                    onContactAction={(action, contact) => { 
                        if (action === 'email' && contact.email) window.open(`mailto:${contact.email}`);
                        if (action === 'phone' && contact.phone) window.open(`tel:${contact.phone}`);
                    }}
                    onMapView={(contact) => { setSelectedContactForMap(contact); setShowMap(true); }}
                    hasMore={pagination.hasMore}
                    onLoadMore={() => reloadData({ append: true })}
                    loading={loading}
                    groups={groups}
                />

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

            {/* --- RE-INTRODUCED MODALS --- */}
            <EditContactModal 
                contact={editingContact} 
                isOpen={showEditModal} 
                onClose={() => setShowEditModal(false)} 
                onSave={(updatedContact) => handleContactAction('update', updatedContact)} 
            />

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
                            case 'create': result = await createContactGroup(data); break;
                            case 'delete': result = await deleteContactGroup(data); break;
                            case 'update': result = await updateContactGroup(data.id, data); break;
                            case 'generate': result = await generateAutoGroups(); break;
                            default: throw new Error(`Unknown group action: ${action}`);
                        }
                        
                        toast.success('Group action successful!', { id: toastId });
                        await reloadData();
                        return result;
                    } catch (error) {
                        toast.error(`Failed: ${ErrorHandler.extractErrorMessage(error)}`);
                        throw error;
                    }
                }}
                loading={loading}
                hasFeature={hasFeature}
            />

            <ShareContactsModal 
                isOpen={showShareModal} 
                onClose={() => { setShowShareModal(false); setSelectionMode(false); setSelectedContacts([]); }} 
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
                        toast.error(`Failed to share contacts: ${ErrorHandler.extractErrorMessage(error)}`);
                        throw error;
                    }
                }}
                onGetTeamMembers={getTeamMembersForSharing}
                hasFeature={hasFeature}
            />
            
            <BusinessCardScanner 
                isOpen={showScanner} 
                onClose={() => setShowScanner(false)} 
                onContactParsed={(parsedFields) => { setScannedFields(parsedFields); setShowReviewModal(true); setShowScanner(false); }} 
                hasFeature={hasFeature}
            />

            <ContactReviewModal 
                isOpen={showReviewModal} 
                onClose={() => { setShowReviewModal(false); setScannedFields(null); }}
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
                        toast.error(`Failed to save contact: ${ErrorHandler.extractErrorMessage(error)}`);
                        throw error;
                    }
                }}
            />
        </div>
    );
}


// =============================================================================
// --- RE-INTRODUCED SUB-COMPONENTS ---
// (These are copied from your original file to restore functionality)
// =============================================================================
const ContactsMap = dynamic(() => import('./components/ContactsMap'), { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div> });


function ContactsList({ 
    contacts, selectionMode, selectedContacts, onToggleSelection, 
    onEdit, onStatusUpdate, onDelete, onContactAction, onMapView,
    hasMore, onLoadMore, loading, groups = []
}) {
    const { t } = useTranslation();

    if (contacts.length === 0) {
        return (
            <div className="p-6 sm:p-8 text-center bg-white rounded-lg border">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    {t('contacts.no_contacts_found') || 'No contacts found'}
                </h3>
                <p className="text-gray-500 text-sm">
                    {t('contacts.try_adjusting_filters') || 'Try adjusting your filters or add your first contact'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {contacts.map((contact) => (
                <div key={contact.id} className={`relative ${selectionMode && !contact.isSharedContact ? 'pl-10 sm:pl-12' : ''}`}>
                    {selectionMode && !contact.isSharedContact && (
                        <div className="absolute left-2 sm:left-3 top-4 z-10">
                            <input type="checkbox" checked={selectedContacts.includes(contact.id)} onChange={() => onToggleSelection(contact.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                        </div>
                    )}
                    <ContactCard contact={contact} onEdit={onEdit} onStatusUpdate={onStatusUpdate} onDelete={onDelete} onContactAction={onContactAction} onMapView={onMapView} groups={groups} />
                </div>
            ))}
            {hasMore && (
                <div className="flex justify-center py-4">
                    <button onClick={onLoadMore} disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {loading ? (t('contacts.loading') || 'Loading...') : (t('contacts.load_more') || 'Load More')}
                    </button>
                </div>
            )}
        </div>
    );
}

function ContactCard({ contact, onEdit, onStatusUpdate, onDelete, onContactAction, onMapView, groups = [] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const contactGroups = groups.filter(group => group.contactIds && group.contactIds.includes(contact.id));

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };
    
    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const isDynamicContact = Array.isArray(contact.details);
    const headerName = contact.name || 'No Name';
    const headerEmail = contact.email || 'No Email';
    const displayDetails = isDynamicContact
        ? contact.details.filter(d => !d.label.toLowerCase().includes('name') && !d.label.toLowerCase().includes('email'))
        : [
            contact.phone && { label: t('contacts.phone') || 'Phone', value: contact.phone },
            contact.company && { label: t('contacts.company') || 'Company', value: contact.company },
          ].filter(Boolean);
    const isFromTeamMember = contact.sharedBy || contact.teamMemberSource;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                         <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${isFromTeamMember ? 'bg-gradient-to-br from-purple-400 to-blue-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'}`}>
                            {headerName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{headerName}</h3>
                                <p className="text-xs text-gray-500 truncate">{headerEmail}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>{t(`contacts.status_${contact.status}`) || contact.status}</span>
                                    {contact.location && <span className="text-xs text-green-600">📍</span>}
                                    {isFromTeamMember && <span className="text-xs text-purple-600">👥</span>}
                                </div>
                            </div>
                            <div className="ml-2"><svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                        </div>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className="border-t border-gray-100">
                    <div className="p-3 sm:p-4 space-y-3">
                         {!isDynamicContact && contact.message && (<div className="mt-3 p-3 bg-gray-50 rounded-lg"><p className="text-sm text-gray-700 italic">&quot;{contact.message}&quot;</p></div>)}
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100 mt-3">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>{t('contacts.added') || 'Added'} {formatDate(contact.submittedAt)}</span>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 border-t border-gray-100">
                        {/* --- THE ACTION BUTTONS YOU WANTED --- */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {(!isFromTeamMember || contact.canEdit) && (<button onClick={() => onEdit(contact)} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>{t('contacts.edit') || 'Edit'}</button>)}
                            {contact.status === 'new' && (<button onClick={() => onStatusUpdate(contact.id, 'viewed')} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="hidden sm:inline">{t('contacts.mark_as_viewed') || 'Mark as Viewed'}</span><span className="sm:hidden">{t('contacts.viewed') || 'Viewed'}</span></button>)}
                            {contact.status !== 'archived' && (<button onClick={() => onStatusUpdate(contact.id, 'archived')} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 6-6m-3 10l4-4 6 6-6 6-4-4" /></svg>{t('contacts.archive') || 'Archive'}</button>)}
                            {contact.status === 'archived' && (<button onClick={() => onStatusUpdate(contact.id, 'viewed')} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>{t('contacts.restore') || 'Restore'}</button>)}
                            {(!isFromTeamMember || contact.canEdit) && (<button onClick={() => onDelete(contact.id)} className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors col-span-2"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>{t('contacts.delete') || 'Delete'}</button>)}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            <button onClick={() => onContactAction('email', contact)} className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span className="hidden sm:inline">{t('contacts.email') || 'Email'}</span><span className="sm:hidden">✉️</span></button>
                            {contact.phone && (<button onClick={() => onContactAction('phone', contact)} className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg><span className="hidden sm:inline">{t('contacts.call') || 'Call'}</span><span className="sm:hidden">📞</span></button>)}
                            {contact.location?.latitude && (<button onClick={() => onMapView(contact)} className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg><span className="hidden sm:inline">{t('contacts.map_button') || 'Map'}</span><span className="sm:hidden">📍</span></button>)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditContactModal({ contact, isOpen, onClose, onSave }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', message: '', status: 'new' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData({ name: contact.name || '', email: contact.email || '', phone: contact.phone || '', company: contact.company || '', message: contact.message || '', status: contact.status || 'new' });
        }
    }, [contact]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({ ...contact, ...formData, lastModified: new Date().toISOString() });
            onClose();
        } catch (error) {
            console.error('Error updating contact:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-0 z-[10000] sm:items-center sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white"><h2 className="text-lg font-semibold text-gray-900">{t('contacts.edit_contact') || 'Edit Contact'}</h2><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.name') || 'Name'} *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" required disabled={isSubmitting} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.email') || 'Email'} *</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" required disabled={isSubmitting} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.phone') || 'Phone'}</label><input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.company') || 'Company'}</label><input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} /></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.status') || 'Status'}</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting}><option value="new">{t('contacts.status_new') || 'New'}</option><option value="viewed">{t('contacts.status_viewed') || 'Viewed'}</option><option value="archived">{t('contacts.status_archived') || 'Archived'}</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.message') || 'Message'}</label><textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-base" disabled={isSubmitting} /></div>
                    <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white"><button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-base font-medium" disabled={isSubmitting}>{t('common.cancel') || 'Cancel'}</button><button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium" disabled={isSubmitting}>{isSubmitting && (<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>)}{isSubmitting ? (t('contacts.saving') || 'Saving...') : (t('contacts.save_changes') || 'Save Changes')}</button></div>
                </form>
            </div>
        </div>
    );
}

// Helper function to get group colors consistently
function getGroupColor(groupId, groups) {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}