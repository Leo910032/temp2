// components/ContactsMap/MapLegend.jsx - Simplified without filters
import React from 'react';

export function MapLegend({
    isLoaded,
    isMobile,
    showLegend,
    setShowLegend,
    groupStats,
    contactCounts,
    onGroupToggle,
    getGroupColor,
    contactsWithLocation
}) {
    if (!isLoaded) return null;

    // Desktop Legend
    if (!isMobile) {
        return (
            <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg shadow-lg border min-w-64 z-20 max-h-80 overflow-y-auto">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Contact Groups
                </h4>
                
                {/* Groups Section */}
                {groupStats.length > 0 && (
                    <div className="mb-4">
                        <h5 className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Active Groups
                        </h5>
                        <div className="space-y-1 text-xs">
                            {groupStats.map(group => (
                                <div key={group.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <button
                                            onClick={() => onGroupToggle && onGroupToggle(group.id)}
                                            className="flex items-center gap-2 hover:bg-gray-50 rounded p-1 -m-1 flex-1 min-w-0"
                                        >
                                            <div 
                                                className="w-3 h-3 rounded-full border-2 border-white shadow"
                                                style={{ backgroundColor: getGroupColor(group.id) }}
                                            />
                                            <span className="text-gray-700 truncate" title={group.name}>
                                                {group.name}
                                            </span>
                                            {group.type === 'auto' && (
                                                <span className="text-xs text-gray-400" title="Auto-generated">🤖</span>
                                            )}
                                            {group.type === 'event' && (
                                                <span className="text-xs text-gray-400" title="Event-based">📅</span>
                                            )}
                                            {group.type === 'company' && (
                                                <span className="text-xs text-gray-400" title="Company-based">🏢</span>
                                            )}
                                        </button>
                                    </div>
                                    <span className="font-medium text-gray-600 ml-2">
                                        {group.contactCount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Visualization Guide */}
                <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow flex items-center justify-center">
                                <span className="text-white text-xs font-bold">5</span>
                            </div>
                            <span className="text-gray-600">Group clusters</span>
                        </div>
                        <span className="text-xs text-gray-500">Zoom &lt; 11</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                                <span className="text-white text-xs font-bold">J</span>
                            </div>
                            <span className="text-gray-600">Individual contacts</span>
                        </div>
                        <span className="text-xs text-gray-500">Zoom &gt; 14</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-gray-500 border-2 border-white shadow flex items-center justify-center">
                                <span className="text-white text-xs font-bold">A</span>
                            </div>
                            <span className="text-gray-600">Ungrouped contacts</span>
                        </div>
                        <span className="text-xs text-gray-500">Always visible</span>
                    </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                        Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                        📍 {contactCounts.withLocation} with location data
                    </div>
                </div>
            </div>
        );
    }

    // Mobile Legend Toggle
    if (isMobile) {
        return (
            <>
                <button
                    onClick={() => setShowLegend(!showLegend)}
                    className="absolute top-20 left-4 bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 z-20"
                >
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700">
                        {groupStats.length > 0 ? `${groupStats.length} Groups` : 'Locations'}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        {contactCounts.total}
                    </span>
                </button>

                {/* Mobile Legend Overlay */}
                {showLegend && (
                    <div className="absolute inset-x-4 top-32 bg-white p-4 rounded-lg shadow-lg border z-30 max-h-64 overflow-y-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-sm">Contact Groups</h4>
                            <button
                                onClick={() => setShowLegend(false)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Mobile Groups */}
                        {groupStats.length > 0 && (
                            <div className="mb-3">
                                <h5 className="text-xs font-medium text-gray-700 mb-2">Groups</h5>
                                <div className="space-y-1">
                                    {groupStats.map(group => (
                                        <button
                                            key={group.id}
                                            onClick={() => onGroupToggle && onGroupToggle(group.id)}
                                            className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded text-xs"
                                        >
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-3 h-3 rounded-full border-2 border-white shadow"
                                                    style={{ backgroundColor: getGroupColor(group.id) }}
                                                />
                                                <span>{group.name}</span>
                                                {group.type === 'auto' && <span>🤖</span>}
                                                {group.type === 'event' && <span>📅</span>}
                                                {group.type === 'company' && <span>🏢</span>}
                                            </div>
                                            <span className="font-medium">{group.contactCount}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                            <div className="text-xs text-gray-500">
                                Total: {contactCounts.total} contact{contactCounts.total !== 1 ? 's' : ''}
                            </div>
                            <div className="text-xs text-purple-600 mt-1">
                                📍 {contactCounts.withLocation} with location
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    return null;
}