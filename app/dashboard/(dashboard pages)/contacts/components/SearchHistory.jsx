//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 

"use client"
import React, { useState, useEffect } from 'react';
import { SemanticSearchService } from '@/lib/services/serviceContact/client/services/SemanticSearchService';

export default function SearchHistory({ 
    onHistoryClick, 
    onJobSelect, 
    currentQuery = '',
    className = '' 
}) {
    const [searchHistory, setSearchHistory] = useState([]);
    const [jobHistory, setJobHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('queries');
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        loadHistories();
    }, []);

    const loadHistories = () => {
        const queries = SemanticSearchService.loadSearchHistory();
        const jobs = SemanticSearchService.loadJobHistory();
        
        setSearchHistory(queries);
        setJobHistory(jobs.reverse()); // Show newest first
    };

    const clearSearchHistory = () => {
        const cleared = SemanticSearchService.clearSearchHistory();
        setSearchHistory(cleared);
    };

    const clearJobHistory = () => {
        try {
            localStorage.removeItem('semantic_search_jobs');
            setJobHistory([]);
        } catch (error) {
            console.warn('Failed to clear job history:', error);
        }
    };

    const handleJobClick = async (job) => {
        try {
            const jobData = await SemanticSearchService.loadSearchJob(job.id);
            if (jobData) {
                onJobSelect({
                    ...jobData,
                    fromHistory: true,
                    originalJob: job
                });
            } else {
                // Job data not in cache, re-run the search
                onHistoryClick(job.query);
            }
        } catch (error) {
            console.error('Failed to load job:', error);
            // Fallback to re-running the search
            onHistoryClick(job.query);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getEnhancementIcon = (enhancementLevel) => {
        switch (enhancementLevel) {
            case 'ai_powered_reranked':
                return <span className="text-indigo-600" title="AI Enhanced + Reranked">🧠+</span>;
            case 'ai_powered':
                return <span className="text-purple-600" title="AI Enhanced">🧠</span>;
            case 'vector_streaming_ai':
                return <span className="text-blue-600" title="Streaming AI">⚡</span>;
            case 'vector_streaming_ai_reranked':
                return <span className="text-cyan-600" title="Streaming AI + Reranked">⚡+</span>;
            case 'vector_reranked':
                return <span className="text-teal-600" title="Vector + Reranked">🔍+</span>;
            case 'vector_only':
                return <span className="text-green-600" title="Vector Search">📊</span>;
            default:
                return <span className="text-gray-600">🔍</span>;
        }
    };

    const hasHistoryData = searchHistory.length > 0 || jobHistory.length > 0;

    if (!hasHistoryData) {
        return null;
    }

    return (
        <div className={`bg-gray-50 border border-gray-200 rounded-lg mt-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <h4 className="text-sm font-medium text-gray-700">Search History</h4>
                    
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-100 rounded-md p-0.5">
                        <button
                            onClick={() => setActiveTab('queries')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                                activeTab === 'queries' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Queries ({searchHistory.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('jobs')}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                                activeTab === 'jobs' 
                                    ? 'bg-white text-gray-900 shadow-sm' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            Results ({jobHistory.length})
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        {isExpanded ? 'Collapse' : 'Expand'}
                    </button>
                    <button 
                        onClick={activeTab === 'queries' ? clearSearchHistory : clearJobHistory}
                        className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className={`transition-all duration-300 ${isExpanded ? 'max-h-96' : 'max-h-32'} overflow-hidden`}>
                <div className="p-3 space-y-2 overflow-y-auto max-h-full">
                    
                    {/* Query History Tab */}
                    {activeTab === 'queries' && (
                        <div className="flex flex-wrap gap-2">
                            {searchHistory.length === 0 ? (
                                <p className="text-sm text-gray-500">No recent searches</p>
                            ) : (
                                searchHistory.map((query, index) => (
                                    <button
                                        key={`${query}-${index}`}
                                        onClick={() => onHistoryClick(query)}
                                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                                            query === currentQuery
                                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                                : 'bg-white border-gray-300 hover:bg-gray-100 text-gray-800'
                                        }`}
                                    >
                                        "{query}"
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Job History Tab */}
                    {activeTab === 'jobs' && (
                        <div className="space-y-2">
                            {jobHistory.length === 0 ? (
                                <p className="text-sm text-gray-500">No completed searches</p>
                            ) : (
                                jobHistory.slice(0, isExpanded ? 20 : 5).map((job) => (
                                    <div
                                        key={job.id}
                                        onClick={() => handleJobClick(job)}
                                        className="flex items-start justify-between p-2 bg-white rounded-md border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {getEnhancementIcon(job.enhancementLevel)}
                                                <span className="text-sm font-medium text-gray-900 truncate">
                                                    "{job.query}"
                                                </span>
                                                {job.hasReranking && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                                                        Reranked
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>{job.resultCount} results</span>
                                                <span>{formatDate(job.timestamp)}</span>
                                                {job.vectorCategories && (
                                                    <span>
                                                        H:{job.vectorCategories.high} 
                                                        M:{job.vectorCategories.medium} 
                                                        L:{job.vectorCategories.low}
                                                    </span>
                                                )}
                                            </div>

                                            {job.summary?.topContacts && (
                                                <div className="mt-1 text-xs text-gray-600">
                                                    Top: {job.summary.topContacts.slice(0, 2).join(', ')}
                                                    {job.summary.topContacts.length > 2 && '...'}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 ml-3">
                                            {job.summary?.hasAI && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                    AI
                                                </span>
                                            )}
                                            {job.summary?.hasReranking && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                                                    Ranked
                                                </span>
                                            )}
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                                job.subscriptionLevel === 'enterprise' ? 'bg-gray-100 text-gray-800' :
                                                job.subscriptionLevel === 'business' ? 'bg-blue-100 text-blue-800' :
                                                job.subscriptionLevel === 'premium' ? 'bg-purple-100 text-purple-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                                {job.subscriptionLevel}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                            
                            {jobHistory.length > 5 && !isExpanded && (
                                <button
                                    onClick={() => setIsExpanded(true)}
                                    className="w-full text-center py-2 text-xs text-gray-500 hover:text-gray-700 border-t border-gray-200"
                                >
                                    Show {jobHistory.length - 5} more results
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Stats */}
            <div className="px-3 py-2 bg-gray-100 rounded-b-lg border-t border-gray-200">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>
                        {activeTab === 'queries' 
                            ? `${searchHistory.length} recent queries` 
                            : `${jobHistory.length} cached results`
                        }
                    </span>
                    
                    {activeTab === 'jobs' && (
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                                Reranking
                            </span>
                            <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                Cache active
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}