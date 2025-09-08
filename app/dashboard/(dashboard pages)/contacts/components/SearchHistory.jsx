"use client"
import React from 'react';

export default function SearchHistory({ history, onHistoryClick, onClearHistory }) {
    if (!history || history.length === 0) {
        return null; // Don't render anything if there's no history
    }

    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-4">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Recent Searches</h4>
                <button 
                    onClick={onClearHistory}
                    className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                    Clear
                </button>
            </div>
            <div className="flex flex-wrap gap-2">
                {history.map((query, index) => (
                    <button
                        key={`${query}-${index}`}
                        onClick={() => onHistoryClick(query)}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-full hover:bg-gray-100 text-gray-800 transition-colors"
                    >
                        {query}
                    </button>
                ))}
            </div>
        </div>
    );
}