// components/map/MapControls.jsx - Map control panels and filters

import React, { useState } from 'react';

export function MapControls({
    isLoaded,
    isMobile,
    isSelectingMode,
    selectedMarkers,
    loadingEvents,
    filters,
    onFiltersChange,
    onStartGroupSelection,
    onCancelGroupSelection,
    onCreateGroupFromSelection,
    getUniqueCompanies,
    currentZoom
}) {
    const [showFilters, setShowFilters] = useState(false);

    if (!isLoaded || isMobile) return null;

    return (
        <>
            {/* Main Control Panel */}
            <div className="absolute top-4 right-4 z-20">
                {!isSelectingMode ? (
                    <div className="flex flex-col gap-2">
                        {/* Zoom Level Indicator */}
                        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                                currentZoom < 11 ? 'bg-blue-500' : 
                                currentZoom < 14 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}></div>
                            <span className="text-xs text-gray-600">
                                {currentZoom < 11 && 'Group View'}
                                {currentZoom >= 11 && currentZoom < 14 && 'Mixed View'}
                                {currentZoom >= 14 && 'Detail View'}
                            </span>
                        </div>

                        {/* Filters Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                            </svg>
                            Filters
                            {Object.values(filters).some(f => f !== 'all') && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                    Active
                                </span>
                            )}
                        </button>
                        
                        {/* Create Group Button */}
                        <button
                            onClick={onStartGroupSelection}
                            className="bg-white p-3 rounded-lg shadow-lg border flex items-center gap-2 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Create Group
                        </button>
                        
                        {/* Loading Events Indicator */}
                        {loadingEvents && (
                            <div className="bg-white p-2 rounded-lg shadow-lg border flex items-center gap-2 text-xs text-gray-600">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                                Detecting events...
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white p-3 rounded-lg shadow-lg border">
                        <div className="text-sm font-medium text-gray-900 mb-2">
                            Select contacts for group
                        </div>
                        <div className="text-xs text-gray-600 mb-3">
                            {selectedMarkers.length} selected
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onCancelGroupSelection}
                                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onCreateGroupFromSelection}
                                disabled={selectedMarkers.length === 0}
                                className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                                Create ({selectedMarkers.length})
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters Dropdown */}
            {showFilters && (
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
                                onChange={(e) => onFiltersChange(prev => ({ ...prev, status: e.target.value }))}
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
                                onChange={(e) => onFiltersChange(prev => ({ ...prev, company: e.target.value }))}
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
                                onChange={(e) => onFiltersChange(prev => ({ ...prev, hasLocation: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Contacts</option>
                                <option value="yes">With Location</option>
                                <option value="no">Without Location</option>
                            </select>
                        </div>

                        {/* Event Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Events</label>
                            <select
                                value={filters.hasEvent}
                                onChange={(e) => onFiltersChange(prev => ({ ...prev, hasEvent: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Contacts</option>
                                <option value="yes">From Events</option>
                                <option value="no">Not from Events</option>
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date Added</label>
                            <select
                                value={filters.dateRange}
                                onChange={(e) => onFiltersChange(prev => ({ ...prev, dateRange: e.target.value }))}
                                className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>

                        {/* Clear Filters */}
                        <div className="pt-2 border-t">
                            <button
                                onClick={() => onFiltersChange({
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
            )}
        </>
    );
}