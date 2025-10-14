//app/dashboard/(dashboard pages)/contacts/components/contacts/ContactCard.jsx
"use client";

import { useState, memo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

// Country flag emoji mapping
const countryFlags = {
    'US': '🇺🇸', 'CA': '🇨🇦', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪',
    'IT': '🇮🇹', 'ES': '🇪🇸', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭',
    'AT': '🇦🇹', 'PL': '🇵🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
    'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'GR': '🇬🇷', 'CZ': '🇨🇿',
    'AU': '🇦🇺', 'NZ': '🇳🇿', 'JP': '🇯🇵', 'CN': '🇨🇳', 'KR': '🇰🇷',
    'IN': '🇮🇳', 'BR': '🇧🇷', 'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱'
};

// Country code to country mapping
const countryCodeMap = {
    '1': 'US', '33': 'FR', '44': 'GB', '49': 'DE', '39': 'IT',
    '34': 'ES', '31': 'NL', '32': 'BE', '41': 'CH', '43': 'AT',
    '48': 'PL', '46': 'SE', '47': 'NO', '45': 'DK', '358': 'FI',
    '353': 'IE', '351': 'PT', '30': 'GR', '420': 'CZ', '61': 'AU',
    '64': 'NZ', '81': 'JP', '86': 'CN', '82': 'KR', '91': 'IN',
    '55': 'BR', '52': 'MX', '54': 'AR', '56': 'CL'
};

function getCountryFromPhone(phoneNumber) {
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
        // Try 3-digit codes first
        const code3 = cleaned.substring(1, 4);
        if (countryCodeMap[code3]) return countryCodeMap[code3];

        // Try 2-digit codes
        const code2 = cleaned.substring(1, 3);
        if (countryCodeMap[code2]) return countryCodeMap[code2];

        // Try 1-digit codes
        const code1 = cleaned.substring(1, 2);
        if (countryCodeMap[code1]) return countryCodeMap[code1];
    }

    return null;
}

const ContactCard = memo(function ContactCard({ contact, onEdit, onStatusUpdate, onDelete, onContactAction, onMapView, onShowGroups, groups = [], isPremium = false }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const contactGroups = groups.filter(group => group.contactIds && group.contactIds.includes(contact.id));

    // Simplified logic: Directly use the top-level dynamicFields array.
    // We can still look for taglines within it for special display.
    const allDynamicFields = contact.dynamicFields || [];
    const taglines = allDynamicFields.filter(field => 
        field.label?.toLowerCase().includes('tagline')
    );
    // Display all other dynamic fields in the "AI Insights" section.
    const otherDynamicFields = allDynamicFields.filter(field => 
        !field.label?.toLowerCase().includes('tagline')
    );

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
        return new Date(dateString).toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric'
        });
    };
    
    const getCategoryIcon = (category) => {
        switch (category) {
            case 'professional': return '💼';
            case 'social': return '🌐';
            case 'contact': return '📞';
            case 'personal': return '👤';
            case 'other': return '📄';
            default: return '📄';
        }
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.9) return 'text-green-600';
        if (confidence >= 0.7) return 'text-yellow-600';
        return 'text-orange-600';
    };

    const isFromTeamMember = contact.sharedBy || contact.teamMemberSource;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${isFromTeamMember ? 'bg-gradient-to-br from-purple-400 to-blue-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'}`}>
                            {(contact.name || '?').charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{contact.name || 'No Name'}</h3>
                                <p className="text-xs text-gray-500 truncate">
                                    {contact.jobTitle ? `${contact.jobTitle}` : contact.email || 'No Email'}
                                    {contact.jobTitle && contact.company ? ` at ${contact.company}` : (!contact.jobTitle && contact.company ? contact.company : '')}
                                </p>
                                
                                {taglines.length > 0 && (
                                    <p className="text-xs text-blue-600 italic mt-1 truncate">
                                        &quot;{taglines[0].value}&quot;
                                    </p>
                                )}
                                
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                                        {t(`contacts.status_${contact.status}`) || contact.status}
                                    </span>
                                    {contact.location && <span className="text-xs text-green-600">📍</span>}
                                    {isFromTeamMember && <span className="text-xs text-purple-600">👥</span>}
                                    {allDynamicFields.length > 0 && (
                                        <span className="text-xs text-purple-500" title={`${allDynamicFields.length} AI-detected fields`}>
                                            ✨{allDynamicFields.length}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="ml-2">
                                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {expanded && (
                <div className="border-t border-gray-100">
                    <div className="p-3 sm:p-4 space-y-4">
                        {/* Standard contact information */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {contact.email && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 h-4 flex-shrink-0">📧</span>
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline break-all">{contact.email}</a>
                                </div>
                            )}
                            {contact.website && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 h-4 flex-shrink-0">🌐</span>
                                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{contact.website}</a>
                                </div>
                            )}
                            {contact.address && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 h-4 flex-shrink-0">📍</span>
                                    <span className="text-gray-700 truncate">{contact.address}</span>
                                </div>
                            )}
                        </div>

                        {/* Phone Numbers Section */}
                        {((contact.phoneNumbers && contact.phoneNumbers.length > 0) || contact.phone) && (
                            <div className="pt-3 border-t border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                                    📞 Phone Numbers
                                    {isPremium && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-full normal-case">
                                            Premium: Country Detection
                                        </span>
                                    )}
                                </h4>
                                <div className="space-y-2">
                                    {contact.phoneNumbers && contact.phoneNumbers.length > 0 ? (
                                        contact.phoneNumbers.map((phoneObj, index) => {
                                            const phoneNumber = phoneObj.number;
                                            const country = isPremium ? getCountryFromPhone(phoneNumber) : null;
                                            const flag = country ? countryFlags[country] : '📞';

                                            return (
                                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                    {isPremium && (
                                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded border border-gray-200">
                                                            <span className="text-xl" title={country || 'Unknown'}>
                                                                {flag}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {!isPremium && (
                                                        <span className="text-gray-400 w-4 h-4 flex-shrink-0">📞</span>
                                                    )}
                                                    <a href={`tel:${phoneNumber}`} className="text-blue-600 hover:underline">
                                                        {phoneNumber}
                                                    </a>
                                                </div>
                                            );
                                        })
                                    ) : contact.phone ? (
                                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                            {isPremium && (() => {
                                                const country = getCountryFromPhone(contact.phone);
                                                const flag = country ? countryFlags[country] : '📞';
                                                return (
                                                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-white rounded border border-gray-200">
                                                        <span className="text-xl" title={country || 'Unknown'}>
                                                            {flag}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                            {!isPremium && (
                                                <span className="text-gray-400 w-4 h-4 flex-shrink-0">📞</span>
                                            )}
                                            <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
                                                {contact.phone}
                                            </a>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        )}

                        {/* AI-Detected Dynamic Fields Section (includes taglines and others) */}
                        {allDynamicFields.length > 0 && (
                            <div className="pt-3 border-t border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                    ✨ AI-Detected Information
                                </h4>
                                <div className="space-y-2">
                                    {allDynamicFields.map((field, index) => (
                                        <div key={field.id || index} className="flex items-start gap-3 text-sm p-3 bg-purple-50 rounded-lg border border-purple-200">
                                            <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs border border-purple-300">
                                                {getCategoryIcon(field.category)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="font-medium text-purple-900">{field.label}</div>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full">
                                                            {field.category || 'other'}
                                                        </span>
                                                        <span className={getConfidenceColor(field.confidence)}>
                                                            {Math.round((field.confidence || 0) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-purple-800 break-words">{field.value}</div>
                                                {field.source && (
                                                    <div className="text-xs text-purple-600 mt-1">
                                                        Source: {field.source.replace(/_/g, ' ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Groups section */}
                        {contactGroups.length > 0 && (
                             <div className="pt-3 border-t border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Groups</h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {contactGroups.map(group => (
                                        <span key={group.id} className="px-2.5 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                            {group.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Metadata section */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-3 border-t border-gray-100 mt-3">
                            {contact.source === 'business_card_scan' ? (
                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                    📇 Business Card Scan
                                </span>
                            ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <span>{t('contacts.added') || 'Added'} {formatDate(contact.submittedAt)}</span>
                        </div>
                    </div>
                    
                    {/* Action buttons section */}
                    <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50/50">
                         <div className="grid grid-cols-2 gap-2 mb-3">
                            {(!isFromTeamMember || contact.canEdit) && (
                                <button 
                                    onClick={() => onEdit(contact)} 
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    {t('contacts.edit') || 'Edit'}
                                </button>
                            )}
                            {contact.status === 'new' && (
                                <button 
                                    onClick={() => onStatusUpdate(contact.id, 'viewed')} 
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.mark_as_viewed') || 'Mark as Viewed'}</span>
                                    <span className="sm:hidden">{t('contacts.viewed') || 'Viewed'}</span>
                                </button>
                            )}
                            {contact.status !== 'archived' && (
                                <button 
                                    onClick={() => onStatusUpdate(contact.id, 'archived')} 
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l4 4 6-6m-3 10l4-4 6 6-6 6-4-4" />
                                    </svg>
                                    {t('contacts.archive') || 'Archive'}
                                </button>
                            )}
                            {contact.status === 'archived' && (
                                <button 
                                    onClick={() => onStatusUpdate(contact.id, 'viewed')} 
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    {t('contacts.restore') || 'Restore'}
                                </button>
                            )}
                            {(!isFromTeamMember || contact.canEdit) && (
                                <button 
                                    onClick={() => onDelete(contact.id)} 
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors col-span-2"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t('contacts.delete') || 'Delete'}
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                            {contact.email && (
                                <button
                                    onClick={() => onContactAction?.('email', contact)}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.email') || 'Email'}</span>
                                    <span className="sm:hidden">✉️</span>
                                </button>
                            )}
                            {((contact.phoneNumbers && contact.phoneNumbers.length > 0) || contact.phone) && (
                                <button
                                    onClick={() => onContactAction?.('phone', contact)}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.call') || 'Call'}</span>
                                    <span className="sm:hidden">📞</span>
                                </button>
                            )}
                            {contact.location?.latitude && (
                                <button
                                    onClick={() => onMapView?.(contact)}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.57L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.map_button') || 'Map'}</span>
                                    <span className="sm:hidden">📍</span>
                                </button>
                            )}
                        </div>
                        {onShowGroups && contactGroups.length > 0 && (
                            <button
                                onClick={() => onShowGroups(contact.id)}
                                className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors mt-2 w-full"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>Show Groups ({contactGroups.length})</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export default ContactCard;
