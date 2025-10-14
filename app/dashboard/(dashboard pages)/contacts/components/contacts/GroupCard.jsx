// app/dashboard/(dashboard pages)/contacts/components/contacts/GroupCard.jsx
"use client";

import { useState, memo } from 'react';

// Helper function to get group color
function getGroupColor(groupId, groups) {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}

const GroupCard = memo(function GroupCard({
    group,
    groups,
    contacts = [],
    onShowMembers,
    onDelete,
    onEdit,
    onShowLocation,
    compact = false
}) {
    const [expanded, setExpanded] = useState(false);
    const hasLocation = group.eventLocation && (group.eventLocation.latitude || group.eventLocation.lat);
    const memberCount = group.contactIds?.length || 0;

    const handleShowOnMap = () => {
        if (onShowLocation && hasLocation) {
            onShowLocation(group.eventLocation);
        }
    };

    const handleShowMembers = () => {
        if (onShowMembers) {
            onShowMembers(group.id);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                        <div
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm border-2 border-white shadow"
                            style={{ backgroundColor: getGroupColor(group.id, groups) }}
                        >
                            {memberCount}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{group.name}</h3>
                                <p className="text-xs text-gray-500 truncate">
                                    {memberCount} member{memberCount !== 1 ? 's' : ''} • {group.type}
                                </p>
                                {group.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                        {group.description}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {group.metadata?.aiGenerated && (
                                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                            AI Generated
                                        </span>
                                    )}
                                    {hasLocation && <span className="text-xs text-green-600">📍</span>}
                                    {group.timeFrame && <span className="text-xs text-blue-600">⏰</span>}
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
                        {/* Group Details */}
                        <div className="space-y-2 text-sm">
                            {group.timeFrame && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 h-4 flex-shrink-0">⏰</span>
                                    <span className="text-gray-700">
                                        {new Date(group.timeFrame.startDate).toLocaleDateString()} - {new Date(group.timeFrame.endDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                            {hasLocation && (
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400 w-4 h-4 flex-shrink-0">📍</span>
                                    <span className="text-gray-700">{group.eventLocation.name || 'Event Location'}</span>
                                </div>
                            )}
                            {group.createdAt && (
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Created {new Date(group.createdAt).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Contact Preview */}
                        {group.contactIds && group.contactIds.length > 0 && contacts.length > 0 && (
                            <div className="pt-3 border-t border-gray-100">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Members</h4>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {group.contactIds.slice(0, 5).map(contactId => {
                                        const contact = contacts.find(c => c.id === contactId);
                                        if (!contact) return null;
                                        return (
                                            <div key={contactId} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1">
                                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                                                    {contact.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs text-gray-700">{contact.name}</span>
                                            </div>
                                        );
                                    })}
                                    {group.contactIds.length > 5 && (
                                        <span className="text-xs text-gray-500">+{group.contactIds.length - 5} more</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action buttons section */}
                    <div className="p-3 sm:p-4 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(group)}
                                    className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit
                                </button>
                            )}
                            <button
                                onClick={() => onDelete(group.id)}
                                className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                            {onShowMembers && memberCount > 0 && (
                                <button
                                    onClick={handleShowMembers}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors col-span-2"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Show Members</span>
                                </button>
                            )}
                            {hasLocation && onShowLocation && (
                                <button
                                    onClick={handleShowOnMap}
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">Map</span>
                                    <span className="sm:hidden">📍</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default GroupCard;
