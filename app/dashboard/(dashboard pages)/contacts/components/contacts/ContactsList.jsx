// app/dashboard/(dashboard pages)/contacts/components/ContactsList.jsx
"use client";

import { useTranslation } from "@/lib/translation/useTranslation";
import ContactCard from './ContactCard';

export default function ContactsList({ 
    contacts,
    selectionMode,
    selectedContacts,
    onToggleSelection,
    onEdit,
    onAction,
    onMapView,
    hasMore,
    onLoadMore,
    loading,
    groups = [],
    isAiSearch = false,
    searchMode = 'standard',
    onClearSearch
}) {
    const { t } = useTranslation();

    // Empty state
    if (!contacts || contacts.length === 0) {
        return (
            <div className="p-6 sm:p-8 text-center bg-white rounded-lg border">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    {isAiSearch 
                        ? t('contacts.no_ai_results') || 'No matching contacts found'
                        : t('contacts.no_contacts_found') || 'No contacts found'
                    }
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                    {isAiSearch
                        ? t('contacts.try_different_query') || 'Try adjusting your search query'
                        : t('contacts.try_adjusting_filters') || 'Try adjusting your filters or add your first contact'
                    }
                </p>
                {isAiSearch && onClearSearch && (
                    <button
                        onClick={onClearSearch}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Clear Search
                    </button>
                )}
            </div>
        );
    }

    // AI Search Results Header
    const renderSearchHeader = () => {
        if (!isAiSearch) return null;

        return (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="font-semibold text-purple-900">
                                AI Search Results ({contacts.length})
                            </h3>
                            <p className="text-sm text-purple-700">
                                {searchMode === 'semantic' ? 'Semantic search powered by AI' : 'Standard search results'}
                            </p>
                        </div>
                    </div>
                    {onClearSearch && (
                        <button
                            onClick={onClearSearch}
                            className="px-4 py-2 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {renderSearchHeader()}
            
            <div className="space-y-3">
                {contacts.map((contact) => (
                    <div 
                        key={contact.id} 
                        className={`relative ${selectionMode && !contact.isSharedContact ? 'pl-10 sm:pl-12' : ''}`}
                    >
                        {/* Selection checkbox */}
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
                        
                        {/* Contact Card */}
                        <ContactCard 
                            contact={contact} 
                            onEdit={onEdit}
                            onContactAction={onAction}
                            onMapView={onMapView}
                            groups={groups}
                            isAiResult={isAiSearch}
                        />
                    </div>
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
                <div className="flex justify-center py-4">
                    <button 
                        onClick={onLoadMore} 
                        disabled={loading} 
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        {loading && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        )}
                        {loading 
                            ? (t('contacts.loading') || 'Loading...') 
                            : (t('contacts.load_more') || 'Load More')
                        }
                    </button>
                </div>
            )}
        </div>
    );
}
