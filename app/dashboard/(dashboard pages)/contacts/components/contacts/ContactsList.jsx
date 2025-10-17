// app/dashboard/(dashboard pages)/contacts/components/ContactsList.jsx
"use client";

import { memo, useState, useMemo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import ContactCard from './ContactCard';
import SearchFeedbackButton from '@/app/dashboard/general components/SearchFeedbackButton';
import { motion } from 'framer-motion';

// Confidence tier configuration
const TIER_CONFIG = {
    high: {
        label: 'High Confidence',
        description: 'These contacts closely match your search query',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
        ),
        colorClasses: 'bg-green-50 border-green-200 text-green-900',
        iconColor: 'text-green-600',
        badgeColor: 'bg-green-100 text-green-700 border-green-300'
    },
    medium: {
        label: 'Medium Confidence',
        description: 'These contacts partially match your query',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
        ),
        colorClasses: 'bg-yellow-50 border-yellow-200 text-yellow-900',
        iconColor: 'text-yellow-600',
        badgeColor: 'bg-yellow-100 text-yellow-700 border-yellow-300'
    },
    low: {
        label: 'Low Confidence',
        description: 'These contacts weakly match your query',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        colorClasses: 'bg-gray-50 border-gray-200 text-gray-900',
        iconColor: 'text-gray-500',
        badgeColor: 'bg-gray-100 text-gray-600 border-gray-300'
    }
};

// Categorization logic - uses both absolute thresholds and percentile fallback
function categorizeContactsByConfidence(contacts) {
    // Only categorize if we have rerank scores and 3+ results
    if (!contacts || contacts.length < 3) {
        return null;
    }

    // Check if contacts have rerank scores
    const contactsWithScores = contacts.filter(c => c.searchMetadata?.rerankScore !== undefined);
    if (contactsWithScores.length === 0) {
        return null;
    }

    const scores = contactsWithScores.map(c => c.searchMetadata.rerankScore);
    const hasHighScores = scores.some(score => score >= 0.5);

    // Approach B: Absolute thresholds with percentile fallback
    if (hasHighScores) {
        // Use strict absolute thresholds when we have clear high-confidence results
        return contacts.map(contact => {
            const score = contact.searchMetadata?.rerankScore;
            if (score === undefined) return { ...contact, tier: null };

            if (score >= 0.5) return { ...contact, tier: 'high' };
            if (score >= 0.01) return { ...contact, tier: 'medium' };
            return { ...contact, tier: 'low' };
        });
    } else {
        // Use percentile-based approach when all scores are relatively low
        const sorted = [...scores].sort((a, b) => b - a);
        const p75 = sorted[Math.floor(sorted.length * 0.25)]; // Top 25%
        const p50 = sorted[Math.floor(sorted.length * 0.50)]; // Top 50%

        return contacts.map(contact => {
            const score = contact.searchMetadata?.rerankScore;
            if (score === undefined) return { ...contact, tier: null };

            if (score >= p75) return { ...contact, tier: 'high' };
            if (score >= p50) return { ...contact, tier: 'medium' };
            return { ...contact, tier: 'low' };
        });
    }
}

// Group contacts by tier
function groupContactsByTier(categorizedContacts) {
    const groups = {
        high: [],
        medium: [],
        low: []
    };

    categorizedContacts.forEach(contact => {
        if (contact.tier && groups[contact.tier]) {
            groups[contact.tier].push(contact);
        }
    });

    return groups;
}

// TierHeader component
const TierHeader = memo(function TierHeader({ tier, count, isCollapsed, onToggle }) {
    const config = TIER_CONFIG[tier];

    return (
        <div className={`p-4 rounded-lg border ${config.colorClasses} mb-3`}>
            <div
                className="flex items-center justify-between cursor-pointer"
                onClick={onToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle();
                    }
                }}
                aria-expanded={!isCollapsed}
            >
                <div className="flex items-center gap-3">
                    <div className={`${config.iconColor}`}>
                        {config.icon}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">
                            {config.label} ({count})
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5">
                            {config.description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.badgeColor}`}>
                        {count} {count === 1 ? 'result' : 'results'}
                    </span>
                    <svg
                        className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
});

const ContactsList = memo(function ContactsList({
    contacts,
    isPremium,
    selectionMode,
    selectedContacts,
    onToggleSelection,
    onEdit,
    onAction,
    onMapView,
    onShowGroups,
    hasMore,
    onLoadMore,
    loading,
    groups = [],
    isAiSearch = false,
    searchMode = 'standard',
    onClearSearch,
    searchSessionId = null // Session ID from semantic search API response
}) {
    const { t } = useTranslation();

    // State for collapsible tiers (low tier collapsed by default)
    const [collapsedTiers, setCollapsedTiers] = useState({
        high: false,
        medium: false,
        low: true
    });

    const toggleTier = (tier) => {
        setCollapsedTiers(prev => ({
            ...prev,
            [tier]: !prev[tier]
        }));
    };

    // Categorize contacts by confidence tier (memoized for performance)
    const { tierGroups, shouldUseTiers } = useMemo(() => {
        // Only use tiers for AI search with semantic mode and rerank scores
        if (!isAiSearch || searchMode !== 'semantic') {
            return { tierGroups: null, shouldUseTiers: false };
        }

        const categorized = categorizeContactsByConfidence(contacts);
        if (!categorized) {
            return { tierGroups: null, shouldUseTiers: false };
        }

        const groups = groupContactsByTier(categorized);
        return { tierGroups: groups, shouldUseTiers: true };
    }, [contacts, isAiSearch, searchMode]);

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
                            {/* Feedback Button - only shown for semantic search */}
                            <SearchFeedbackButton
                                sessionId={searchSessionId}
                                searchMode={searchMode}
                                isAiSearch={isAiSearch}
                            />
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

    // Render a single contact card with selection checkbox
    const renderContactCard = (contact) => (
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
                isPremium={isPremium}
                onEdit={onEdit}
                onContactAction={onAction}
                onMapView={onMapView}
                onShowGroups={onShowGroups}
                groups={groups}
                isAiResult={isAiSearch}
            />
        </div>
    );

    // Render tier section with collapsible functionality
    const renderTierSection = (tier, tierContacts) => {
        if (tierContacts.length === 0) return null;

        const isCollapsed = collapsedTiers[tier];

        return (
            <section key={tier} className="mb-6" aria-labelledby={`tier-${tier}-header`}>
                <TierHeader
                    tier={tier}
                    count={tierContacts.length}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleTier(tier)}
                />
                {!isCollapsed && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3 mt-3"
                    >
                        {tierContacts.map(renderContactCard)}
                    </motion.div>
                )}
            </section>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 pb-24 sm:pb-6"
        >
            {renderSearchHeader()}

            {shouldUseTiers ? (
                // Tiered display for semantic search with rerank scores
                <div className="space-y-6">
                    {renderTierSection('high', tierGroups.high)}
                    {renderTierSection('medium', tierGroups.medium)}
                    {renderTierSection('low', tierGroups.low)}
                </div>
            ) : (
                // Flat list for standard search or when categorization isn't applicable
                <div className="space-y-3">
                    {contacts.map(renderContactCard)}
                </div>
            )}

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
        </motion.div>
    );
});

export default ContactsList;
