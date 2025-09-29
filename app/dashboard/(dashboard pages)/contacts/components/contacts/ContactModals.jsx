// app/dashboard/(dashboard pages)/contacts/components/ContactModals.jsx
"use client";

import dynamic from 'next/dynamic';
import EditContactModal from './EditContactModal.jsx';
import ContactReviewModal from '../ContactReviewModal.jsx';
import BusinessCardScanner from '../BusinessCardScanner';
//import GroupManagerModal from './GroupManagerModal';
//import ImportExportModal from './ImportExportModal';
//import { ShareContactsModal } from './ShareContactsModal';
  {/*
// Dynamic import for map to avoid SSR issues
const ContactsMap = dynamic(() => import('./ContactsMap'), { 
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
    )
});
   */}

/**
 * Unified modal wrapper component that handles all contact-related modals
 * This keeps the main page clean and organized
 */
export default function ContactModals({
    // Edit Modal
    editingContact,
    showEditModal,
    onCloseEdit,
    onSaveContact,
    
    // Scanner Modal
    showScanner,
    onCloseScanner,
    onContactParsed,
    
    // Review Modal
    showReviewModal,
    onCloseReview,
    scannedFields,
    onSaveScanned,
    
    // Group Manager
    showGroupManager,
    onCloseGroupManager,
    groups,
    contacts,
    onRefreshData,
    onRefreshUsage,
    
    // Import/Export
    showImportExportModal,
    onCloseImportExport,
    
    // Map
    showMap,
    onCloseMap,
    selectedContactForMap,
    
    // Share Modal
    showShareModal,
    onCloseShare,
    selectedContacts,
    
    // Common props
    hasFeature,
    usageInfo
}) {
    return (
        <>
            {/* Edit Contact Modal */}
            <EditContactModal
                contact={editingContact}
                isOpen={showEditModal}
                onClose={onCloseEdit}
                onSave={onSaveContact}
            />

            {/* Business Card Scanner  */}
            <BusinessCardScanner
                isOpen={showScanner}
                onClose={onCloseScanner}
                onContactParsed={onContactParsed}
                hasFeature={hasFeature}
            />
           

            {/* Contact Review Modal (after scanning) */}
          <ContactReviewModal
    isOpen={showReviewModal}
    onClose={onCloseReview}
    parsedFields={scannedFields}
    onSave={onSaveScanned}
    hasFeature={hasFeature}  // Add this prop
/>
            {/* Group Manager Modal 
            <GroupManagerModal
                isOpen={showGroupManager}
                onClose={onCloseGroupManager}
                groups={groups}
                contacts={contacts}
                onRefreshData={onRefreshData}
                onRefreshUsage={onRefreshUsage}
                usageInfo={usageInfo}
                hasFeature={hasFeature}
            />
*/}
            {/* Import/Export Modal 
            <ImportExportModal
                isOpen={showImportExportModal}
                onClose={onCloseImportExport}
                allContacts={contacts}
                onActionComplete={onRefreshData}
            />*/}

            {/* Contacts Map 
            <ContactsMap
                isOpen={showMap}
                onClose={onCloseMap}
                contacts={contacts}
                groups={groups}
                selectedContactId={selectedContactForMap?.id}
                onContactsUpdate={onRefreshData}
            />
*/}
            {/* Share Contacts Modal 
            <ShareContactsModal
                isOpen={showShareModal}
                onClose={onCloseShare}
                contacts={contacts}
                selectedContactIds={selectedContacts}
                hasFeature={hasFeature} 
                
            />
            */}
        </>
    );
}