
// components/ContactsMap/MapFilters.jsx
import React from 'react';

export function MapFilters({
    showFilters,
    isLoaded,
    isMobile,
    filters,
    setFilters,
    setShowFilters,
    getUniqueCompanies
}) {
    if (!showFilters || !isLoaded || isMobile) return null;

    return (
        <div className="absolute top-32 right-4 z-30 bg-white rounded-lg shadow-lg border p-4 w-80">
            <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-gray-900">Filter Contacts</h4>
                <button
                    onClick={() => setShowFilters(false)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="space-y-3">
                {/* Status Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Status</option>
                        <option value="new">New</option>
                        <option value="viewed">Viewed</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                {/* Company Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                    <select
                        value={filters.company}
                        onChange={(e) => setFilters(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Companies</option>
                        <option value="no-company">No Company</option>
                        {getUniqueCompanies().map(company => (
                            <option key={company} value={company}>{company}</option>
                        ))}
                    </select>
                </div>

                {/* Location Filter */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                    <select
                        value={filters.hasLocation}
                        onChange={(e) => setFilters(prev => ({ ...prev, hasLocation: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">All Contacts</option>
                        <option value="yes">With Location</option>
                        <option value="no">Without Location</option>
                    </select>
                </div>

                {/* Clear Filters */}
                <div className="pt-2 border-t">
                    <button
                        onClick={() => setFilters({
                            status: 'all',
                            company: 'all',
                            hasLocation: 'all',
                            hasEvent: 'all',
                            dateRange: 'all'
                        })}
                        className="w-full px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                        Clear All Filters
                    </button>
                </div>
            </div>
        </div>
    );
}