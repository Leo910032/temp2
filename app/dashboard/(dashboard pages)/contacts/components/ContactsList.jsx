// app/dashboard/(dashboard pages)/contacts/components/ContactsList.jsx
"use client";

import { useTranslation } from "@/lib/translation/useTranslation";
import ContactCard from './ContactCard'; // Import the new ContactCard component

export default function ContactsList({ 
    contacts, selectionMode, selectedContacts, onToggleSelection, 
    onEdit, onStatusUpdate, onDelete, onContactAction, onMapView,
    hasMore, onLoadMore, loading, groups = []
}) {
    const { t } = useTranslation();

    if (contacts.length === 0) {
        return (
            <div className="p-6 sm:p-8 text-center bg-white rounded-lg border">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
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
                            <input 
                                type="checkbox" 
                                checked={selectedContacts.includes(contact.id)} 
                                onChange={() => onToggleSelection(contact.id)} 
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                            />
                        </div>
                    )}
                    <ContactCard 
                        contact={contact} 
                        onEdit={onEdit} 
                        onStatusUpdate={onStatusUpdate} 
                        onDelete={onDelete} 
                        onContactAction={onContactAction} 
                        onMapView={onMapView} 
                        groups={groups} 
                    />
                </div>
            ))}
            {hasMore && (
                <div className="flex justify-center py-4">
                    <button 
                        onClick={onLoadMore} 
                        disabled={loading} 
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {loading ? (t('contacts.loading') || 'Loading...') : (t('contacts.load_more') || 'Load More')}
                    </button>
                </div>
            )}
        </div>
    );
}