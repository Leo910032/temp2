
"use client"
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/contexts/AuthContext";
import dynamic from 'next/dynamic';
import ImportExportModal from './components/ImportExportModal';
import { ContactServiceFactory } from '@/lib/services/serviceContact/client/factories/ContactServiceFactory';
import { useUsageInfo } from './components/GroupModalComponents/hooks/useUsageInfo.js';
import SearchModeIndicator, { SearchProgressIndicator } from './components/SearchModeIndicator';
import AiSearchResults from './components/AiSearchResults';
import SearchHistory from './components/SearchHistory'; // NEW IMPORT
import VectorDebugPanel from './components/VectorDebugPanel';

// Enhanced imports with caching
import {
    useContactsManager,
    createContact, updateContact, deleteContact, updateContactStatus,
    bulkUpdateContacts, importContacts, exportContacts, createContactFromScan,
    createContactGroup, deleteContactGroup, updateContactGroup,
    addContactsToGroup, removeContactsFromGroup,
    shareContactsWithTeam, getTeamMembersForSharing,
    CONTACT_FEATURES, getContactUpgradeMessage, hasContactFeature,
    ErrorHandler
} from '@/lib/services/serviceContact'; 

// NEW: Import enhanced semantic search service with caching
import { SemanticSearchService } from '@/lib/services/serviceContact/client/services/SemanticSearchService';
import { contactCache } from '@/lib/services/serviceContact/client/core/contactCacheManager';

// Import UI Components
import BusinessCardScanner from './components/BusinessCardScanner';
import ContactReviewModal from './components/ContactReviewModal';
import { ShareContactsModal } from './components/ShareContactsModal';
import GroupManagerModal from './components/GroupManagerModal';
import { BackgroundJobToast } from './components/BackgroundJobToast';

// Dynamic import for ContactsMap to avoid SSR issues
const ContactsMap = dynamic(() => import('./components/ContactsMap'), { 
    ssr: false, 
    loading: () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
        </div>
    ) 
});

export default function ContactsPage() {
    const { t, locale } = useTranslation();
    const { currentUser } = useAuth();

    // Use the contact manager hook
    const {
        contacts, allOriginalContacts, groups, stats, loading, pagination,
        subscriptionStatus, subscriptionLoading, subscriptionError,
        filter, setFilter, searchTerm, setSearchTerm, 
        selectedGroupIds, setSelectedGroupIds, reloadData
    } = useContactsManager(currentUser);

    // UI State for modals and actions
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [scannedFields, setScannedFields] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
        // Enhanced feature checking
    const hasFeature = useCallback((feature) => {
        if (!subscriptionStatus) return false;
        return hasContactFeature(subscriptionStatus.subscriptionLevel, feature);
    }, [subscriptionStatus]);
    const canUseSmartIcebreakers = hasFeature(CONTACT_FEATURES.BUSINESS_SMART_ICEBREAKERS);

    const [streamingProgress, setStreamingProgress] = useState(null);
    const [isStreamingActive, setIsStreamingActive] = useState(false);
    const [showGroupManager, setShowGroupManager] = useState(false);
    const [showImportExportModal, setShowImportExportModal] = useState(false);
    const { 
        usageInfo, 
        loading: usageLoading, 
        forceRefresh: refreshUsageInfo 
    } = useUsageInfo(subscriptionStatus?.subscriptionLevel);

    // Map modal state
    const [showMap, setShowMap] = useState(false);
    const [selectedContactForMap, setSelectedContactForMap] = useState(null);
    const [mapSelectedGroupIds, setMapSelectedGroupIds] = useState([]);
    
// Add these states for search results and debugging
  const [searchResults, setSearchResults] = useState([]);
  const [searchMetadata, setSearchMetadata] = useState(null);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [debugMode, setDebugMode] = useState(true); // Set to false to hide debug panel

    // Enhanced search state with caching and history
    const [searchMode, setSearchMode] = useState('standard');
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [aiSearchResults, setAiSearchResults] = useState(null);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [searchStage, setSearchStage] = useState('idle');
    const [showSearchProgress, setShowSearchProgress] = useState(false);
    const [showSearchHistory, setShowSearchHistory] = useState(false); // NEW

    // Background job state for AI generation
    const [backgroundJobId, setBackgroundJobId] = useState(null);
    const [showJobProgress, setShowJobProgress] = useState(false);
    
    const groupManagerRef = useRef(null);

    // NEW: Handle background job updates
    const handleBackgroundJobUpdate = useCallback((jobId) => {
        setBackgroundJobId(jobId);
        setShowJobProgress(!!jobId);
    }, []);

    // Load subscription status and usage info
    useEffect(() => {
        if (subscriptionStatus?.subscriptionLevel) {
            refreshUsageInfo();
        }
    }, [subscriptionStatus, refreshUsageInfo]);



    const canUseBasicAiSearch = hasFeature(CONTACT_FEATURES.PREMIUM_SEMANTIC_SEARCH);
    const canUseFullAiSearch = hasFeature(CONTACT_FEATURES.BUSINESS_AI_SEARCH);
    const canUseAnyAiSearch = canUseBasicAiSearch || canUseFullAiSearch;

     const handleSearch = async (query) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setSearchMetadata(null);
      setCurrentQuery('');
      return;
    }

    try {
      setIsSearching(true);
      setCurrentQuery(query);
      
      // Your existing search options
      const searchOptions = {
        userId: currentUser?.uid, // Make sure this is defined
        subscriptionLevel: subscriptionStatus?.subscriptionLevel || 'premium',
        maxResults: 10,
        enhanceResults: true,
        useReranking: true,
        streamingMode: false
      };

      console.log('Starting search with options:', searchOptions);
      
      const result = await SemanticSearchService.search(query, searchOptions);
      
      console.log('Search completed:', result);
      
      // Store the results and metadata for the debug panel
      setSearchResults(result.results || []);
      setSearchMetadata(result.searchMetadata || null);
      
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
      setSearchMetadata(null);
    } finally {
      setIsSearching(false);
    }
  };

    // Clear search function
  const handleClearSearch = () => {
    setSearchResults([]);
    setSearchMetadata(null);
    setCurrentQuery('');
  };
 const handleEnhancedSearch = async (query, useAI = false) => {
        if (!query.trim()) {
            setAiSearchResults(null);
            setSearchTerm('');
            setSearchStage('idle');
            setShowSearchProgress(false);
            return;
        }

        if (useAI && canUseAnyAiSearch) {
            console.log('🚀 Starting Enhanced AI Search with progressive enhancement...');
            setIsAiSearching(true);
            setAiSearchResults([]); // Clear previous results
            setShowSearchProgress(true);
            setSearchStage('vector_search');

            try {
                const streamingMode = canUseFullAiSearch;
                console.log(`🔄 Using ${streamingMode ? 'streaming' : 'batch'} mode.`);

                const streamingCallbacks = streamingMode ? {
                    onProgress: handleEnhancedStreamingProgress,
                    onResult: handleEnhancedStreamingResult,
                    onError: handleStreamingError,
                } : {};
                
                // This call now returns IMMEDIATELY with the initial reranked results
                const searchResponse = await SemanticSearchService.search(query, {
                    maxResults: 10, // Ask for up to 20 initial results
                    enhanceResults: canUseFullAiSearch,
                    streamingMode: streamingMode,
                    userId: currentUser?.uid,
                    subscriptionLevel: subscriptionStatus?.subscriptionLevel,
                    useCache: true,
                    queryLanguage: locale,
                    ...streamingCallbacks
                });

                console.log('Initial search response received:', searchResponse);
                
                const initialResults = searchResponse?.results || [];
                const searchMetadata = searchResponse?.searchMetadata || {};

                // ====================================================================
                // THIS IS THE KEY FIX: Immediately set the state with initial results.
                // ====================================================================
                setAiSearchResults(initialResults);
                
                console.log(`✅ Displaying ${initialResults.length} initial results immediately.`);

                if (searchMetadata.vectorCategories) {
                    displayVectorSimilarityInfo(searchMetadata.vectorCategories);
                }
                
                if (streamingMode && searchMetadata.aiEnhancementPending) {
                    setSearchStage('ai_analysis');
                    toast.success(
                        `Found ${initialResults.length} potential matches. AI is now analyzing the top 10...`,
                        { duration: 5000 }
                    );
                    // isAiSearching remains true while the background stream runs
                } else {
                    setSearchStage('complete');
                    const cacheStatus = searchMetadata.fromCache ? ' (cached)' : '';
                    toast.success(
                        `🧠 Found ${initialResults.length} relevant contacts!${cacheStatus}`,
                        { duration: 4000 }
                    );
                    setIsAiSearching(false); // Batch mode is complete
                    setShowSearchProgress(false);
                }
                
            } catch (error) {
                console.error('❌ Enhanced AI Search failed:', error);
                setSearchStage('idle');
                toast.error(`🤖 AI search failed: ${error.message}`);
                setAiSearchResults([]);
                setIsAiSearching(false);
                setShowSearchProgress(false);
            }
        } else {
            // Standard keyword search logic (unchanged)
            setSearchTerm(query);
            setAiSearchResults(null);
            setSearchStage('idle');
            setShowSearchProgress(false);
        }
    };


    // NEW: Handle job selection from history
    const handleJobSelection = useCallback((jobData) => {
        console.log('📋 Loading search results from history:', jobData.originalJob?.query);
        
        setAiSearchQuery(jobData.query || jobData.originalJob?.query || '');
        setSearchMode('semantic');
        setAiSearchResults(jobData.results || []);
        setSearchStage('complete');
        
        toast.success(
            `Loaded ${jobData.results?.length || 0} cached results from "${jobData.originalJob?.query}"`,
            { duration: 4000 }
        );

        // Update search history to bring this query to the front
        if (jobData.query) {
            SemanticSearchService.addToSearchHistory(jobData.query);
        }
    }, []);

    // NEW: Handle history query click
    const handleHistoryQueryClick = useCallback((query) => {
        setAiSearchQuery(query);
        handleEnhancedSearch(query, true);
    }, [handleEnhancedSearch]);

    // Enhanced streaming progress handler with similarity context
    const handleEnhancedStreamingProgress = (progressData) => {
        setStreamingProgress(progressData);
        
        switch (progressData.type) {
            case 'start':
                console.log(`🚀 Starting enhanced AI analysis for ${progressData.total} contacts`);
                if (progressData.strategy) {
                    console.log(`📋 Processing strategy: ${progressData.strategy}`);
                }
                setSearchStage('ai_analysis');
                setIsStreamingActive(true);
                break;
                
            case 'processing':
                const similarityInfo = progressData.similarityTier 
                    ? ` (${progressData.similarityTier} similarity: ${(progressData.vectorScore * 100).toFixed(1)}%)`
                    : '';
                console.log(`⏳ Processing: ${progressData.contactName}${similarityInfo}`);
                break;
                
            case 'filtered':
                const filterInfo = progressData.similarityTier 
                    ? ` (${progressData.similarityTier} similarity, ${progressData.reason})`
                    : ` (${progressData.reason})`;
                console.log(`⚠️ Filtered: ${progressData.contactName}${filterInfo}`);
                break;
                
            case 'complete':
                console.log('🎉 Enhanced AI analysis complete:', progressData.stats);
                if (progressData.stats?.similarityBreakdown) {
                    console.log('📊 Final similarity breakdown:', progressData.stats.similarityBreakdown);
                }
                setSearchStage('complete');
                setIsStreamingActive(false);
                setIsAiSearching(false);
                setShowSearchProgress(false);
                setStreamingProgress(null);
                break;
        }
    };

   // MODIFICATION: `handleEnhancedStreamingResult` is now crucial for updating the UI
    const handleEnhancedStreamingResult = (resultData) => {
        const { contact, insight, processed, total, similarityContext } = resultData;
        
        const similarityInfo = similarityContext 
            ? ` (Vector: ${similarityContext.tier}, Hybrid: ${similarityContext.hybridScore?.toFixed(3)})`
            : '';
        
        console.log(`✅ Received AI-enhanced result: ${contact.name} (${processed}/${total})`);
        
        // Update the specific contact in the results array with its new AI insights
        setAiSearchResults(prevResults => {
            if (!prevResults) return [contact]; // Should not happen, but safe
            
            const newResults = [...prevResults];
            
            // Find the contact by ID and replace it with the enhanced version
            const existingIndex = newResults.findIndex(r => r.id === contact.id);
            
            if (existingIndex >= 0) {
                console.log(`Updating contact at index ${existingIndex} with AI data.`);
                newResults[existingIndex] = contact;
            } else {
                // This case is unlikely in the new flow but good to have
                console.log(`Contact not in initial list, adding.`);
                newResults.push(contact);
            }
            
            // Re-sort by hybrid score to ensure the best results float to the top
            newResults.sort((a, b) => {
                const scoreA = a.searchMetadata?.hybridScore || 
                              a.searchMetadata?.rerankScore || 
                              a._vectorScore || 0;
                const scoreB = b.searchMetadata?.hybridScore || 
                              b.searchMetadata?.rerankScore || 
                              b._vectorScore || 0;
                return scoreB - scoreA;
            });
            
            return newResults;
        });

        // Optional: Show a subtle toast for high-confidence results
        if (insight.confidence >= 8) {
            toast.success(
                `AI analysis for ${contact.name} is ready!`,
                { duration: 3000, icon: '✨' }
            );
        }
    };

    // Display vector similarity information
    const displayVectorSimilarityInfo = (vectorCategories) => {
        const totalContacts = Object.values(vectorCategories).reduce((sum, count) => sum + count, 0);
        
        if (totalContacts > 0) {
            const message = `Vector analysis: ${vectorCategories.high} high, ${vectorCategories.medium} medium, ${vectorCategories.low} low similarity`;
            
           toast(message, { 
                duration: 4000,
                icon: '📊'
            });
        }
    };

    // Clear search function with similarity context cleanup
    const clearEnhancedSearch = () => {
         setAiSearchResults(null);
        setAiSearchQuery('');
        setSearchMode('standard');
        setSearchStage('idle');
        setIsStreamingActive(false);
        setStreamingProgress(null);
        console.log('Cleared enhanced search state and similarity context');
    };

    // Streaming error handler
    const handleStreamingError = (errorData) => {
        console.error('Streaming error:', errorData);
        
        switch (errorData.type) {
            case 'contact_error':
                console.warn(`Failed to process ${errorData.contactName}: ${errorData.error}`);
                break;
                
            case 'stream_error':
                toast.error(`Streaming failed: ${errorData.error}`);
                setSearchStage('idle');
                setIsAiSearching(false);
                break;
        }
    };

    // Update the handleJobComplete function to refresh usage info
    const handleJobComplete = useCallback(async (result) => {
        console.log('[Page] Job completed, processing result:', result);
        
        // Clear the job state IMMEDIATELY
        setBackgroundJobId(null);
        setShowJobProgress(false);

        if (result && result.groups && result.groups.length > 0) {
            try {
                console.log('[Page] Forcing complete data reload after job completion...');
                
                // Reload data to get the new groups from the database
                await reloadData({ 
                    force: true, 
                    clearCache: true,
                    reason: 'ai_job_completion'
                });
                
                // Force refresh usage info after AI operation
                refreshUsageInfo();
                
                toast.success(
                    `AI generated ${result.groups.length} groups! You can see them in the Group Manager.`,
                    { duration: 8000 }
                );
                
                return result.groups;
            } catch (error) {
                console.error('[Page] Failed to reload data after job completion:', error);
                toast.error('Groups were created but failed to refresh. Please reload the page.');
                return [];
            }
        } else {
            // Still refresh usage info even if no groups were created
            refreshUsageInfo();
            toast.success('AI grouping completed but found no suitable groups for your contacts.');
            return [];
        }
    }, [reloadData, refreshUsageInfo]);

    const handleJobError = useCallback((error) => {
        setShowJobProgress(false);
        setBackgroundJobId(null);
        console.error("Background AI job failed:", error);
        
        // Refresh usage info in case partial charges occurred
        refreshUsageInfo();
        
        // Handle budget-specific errors
        if (error.message?.includes('budget exceeded')) {
            toast.error(
                'Monthly AI budget limit reached. Upgrade your plan to continue using AI features.',
                {
                    duration: 10000,
                    action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                    }
                }
            );
        } else if (error.message?.includes('runs exceeded')) {
            toast.error(
                'Monthly AI runs limit reached. Upgrade your plan for more AI operations.',
                {
                    duration: 10000,
                    action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                    }
                }
            );
        } else {
            toast.error(`AI grouping failed: ${error.message}`);
        }
    }, [refreshUsageInfo]);

    // Enhanced handleViewResults
    const handleViewResults = useCallback(async () => {
        console.log('[Page] View Generated Groups button clicked');
        
        // Open the group manager modal and switch to AI Groups tab
        setShowGroupManager(true);
        
        if (groupManagerRef.current && groupManagerRef.current.setActiveTab) {
            setTimeout(() => {
                groupManagerRef.current.setActiveTab('ai-create');
            }, 100);
        }
    }, [groupManagerRef]);

    // Handle contact actions
    const handleContactAction = async (action, data) => {
        const toastId = toast.loading('Updating contact...');
        try {
            if (action === 'update') {
                await updateContact(data.id, data); 
                setShowEditModal(false);
            }
            else if (action === 'delete') {
                if (!confirm('Are you sure you want to delete this contact?')) {
                    toast.dismiss(toastId);
                    return;
                }
                await deleteContact(data);
            }
            else if (action === 'statusUpdate') {
                await updateContactStatus(data.id, data.status);
            }
            
            toast.success('Contact updated!', { id: toastId });
            await reloadData();
        } catch (error) {
            const handled = ErrorHandler.handle(error, `contactAction.${action}`);
            toast.error(`Failed: ${handled.message}`, { id: toastId });
            throw handled;
        }
    };

    const handleMapGroupToggle = (groupId) => {
        setMapSelectedGroupIds(prev => {
            if (prev.length === 1 && prev[0] === groupId) {
                return [];
            }
            return [groupId];
        });
    };

    // Conditional rendering for loading/error states
    if (subscriptionLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading subscription...</span>
            </div>
        );
    }

    if (subscriptionError) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-500 mb-4">⚠️ {subscriptionError}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!hasFeature(CONTACT_FEATURES.BASIC_CONTACTS)) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-4">Contacts Feature Not Available</h2>
                    <p className="text-gray-600 mb-4">
                        Your current subscription plan doesn't include contact management features.
                    </p>
                    <button className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Upgrade Plan
                    </button>
                </div>
            </div>
        );
    }

    if (loading && contacts.length === 0 && !searchTerm) {
        return (
            <div className="flex items-center justify-center p-8 min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                <span className="ml-2">Loading contacts...</span>
            </div>
        );
    }

    // Main render
    return (
        <div className="flex-1 py-4 px-4 max-h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Contacts</h1>
                    <p className="text-gray-600">
                        Manage your contacts and networking connections
                    </p>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
                            <div className="text-sm text-gray-600">Total Contacts</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-green-600">{stats.byStatus?.new || 0}</div>
                            <div className="text-sm text-gray-600">New</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-yellow-600">{stats.byStatus?.viewed || 0}</div>
                            <div className="text-sm text-gray-600">Viewed</div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-gray-600">{stats.withLocation || 0}</div>
                            <div className="text-sm text-gray-600">With Location</div>
                        </div>
                    </div>
                )}

                {/* Usage Info Card (Non-Enterprise Users) */}
                {usageInfo && 
                 usageInfo.currentMonth && 
                 usageInfo.currentMonth.usage && 
                 subscriptionStatus?.subscriptionLevel !== 'enterprise' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {Math.round(usageInfo.currentMonth.percentageUsed || 0)}%
                                    </div>
                                    <div className="text-sm text-gray-600">AI Budget Used</div>
                                </div>
                                {usageLoading && (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                )}
                            </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-green-600">
                                {usageInfo.currentMonth.usage.totalRuns || 0}
                            </div>
                            <div className="text-sm text-gray-600">AI Runs This Month</div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-purple-600">
                                ${(usageInfo.currentMonth.usage.totalCost || 0).toFixed(4)}
                            </div>
                            <div className="text-sm text-gray-600">Total Cost</div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg shadow">
                            <div className="text-2xl font-bold text-orange-600">
                                ${(usageInfo.currentMonth.remaining?.budget || 0).toFixed(4)}
                            </div>
                            <div className="text-sm text-gray-600">Remaining Budget</div>
                        </div>
                    </div>
                )}

                <ImportExportModal
                    isOpen={showImportExportModal}
                    onClose={() => setShowImportExportModal(false)}
                    allContacts={allOriginalContacts}
                    currentFilters={{ status: filter, search: searchTerm }}
                    onActionComplete={reloadData}
                />
{/* Debug Mode Toggle - Remove this in production */}
      {debugMode && (
        <div className="mb-4 p-2 bg-yellow-100 border border-yellow-300 rounded">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            Enable Debug Mode (Vector Score Debugging)
          </label>
        </div>
      )} {/* Debug Panel - Only show when debugging and we have results */}
      {debugMode && searchResults.length > 0 && (
        <VectorDebugPanel
          results={searchResults}
          query={currentQuery}
          searchMetadata={searchMetadata}
        />
      )}



                {/* Controls */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-4">
                     {/* Search Header with Mode Indicator */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Search Contacts</h3>
                        <div className="flex items-center gap-2">
                            <SearchModeIndicator
                                searchMode={searchMode}
                                isSearching={isAiSearching}
                                subscriptionLevel={subscriptionStatus?.subscriptionLevel}
                                onModeChange={(mode) => {
                                    setSearchMode(mode);
                                    if (mode === 'standard') {
                                        setAiSearchQuery('');
                                        setAiSearchResults(null);
                                        setShowSearchHistory(false);
                                    } else {
                                        setSearchTerm('');
                                        setShowSearchHistory(true);
                                    }
                                }}
                            />
                            
                            {/* NEW: History Toggle Button */}
                            {searchMode === 'semantic' && (
                                <button
                                    onClick={() => setShowSearchHistory(!showSearchHistory)}
                                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                                        showSearchHistory 
                                            ? 'bg-blue-100 text-blue-700' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    History
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={
                                searchMode === 'semantic' 
                                    ? "Ask about your network: 'who knows React?' or 'marketing experts'"
                                    : "Search contacts by name, email, or company..."
                            }
                            value={searchMode === 'semantic' ? aiSearchQuery : searchTerm}
                            onChange={(e) => {
                                if (searchMode === 'semantic') {
                                    setAiSearchQuery(e.target.value);
                                } else {
                                    setSearchTerm(e.target.value);
                                }
                            }}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    if (searchMode === 'semantic') {
                                        handleEnhancedSearch(aiSearchQuery, true);
                                    } else {
                                        handleEnhancedSearch(e.target.value, false);
                                    }
                                }
                            }}
                            className="w-full px-4 py-3 pl-12 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isAiSearching}
                        />
                        
                        {/* Search Icon */}
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                            {isAiSearching ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            ) : (
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )}
                        </div>

                        {/* Search Button */}
                        <button
                            onClick={() => {
                                if (searchMode === 'semantic') {
                                    handleEnhancedSearch(aiSearchQuery, true);
                                } else {
                                    handleEnhancedSearch(searchTerm, false);
                                }
                            }}
                            disabled={isAiSearching}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {isAiSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>

                    {/* NEW: Search History Component */}
                    {searchMode === 'semantic' && showSearchHistory && (
                        <SearchHistory
                            onHistoryClick={handleHistoryQueryClick}
                            onJobSelect={handleJobSelection}
                            currentQuery={aiSearchQuery}
                        />
                    )}

                    {/* AI Search Features Explanation */}
                    {searchMode === 'semantic' && !showSearchHistory && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">🤖</span>
                                    <h4 className="font-semibold text-purple-800">
                                        {canUseFullAiSearch ? 'Two-Job AI Search System' : 'AI Semantic Search'}
                                    </h4>
                                </div>
                                
                                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    {/* Job #1 Explanation */}
                                    <div className="flex gap-3">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-600 font-semibold">1</span>
                                        </div>
                                        <div>
                                            <div className="font-medium text-blue-800">AI Librarian</div>
                                            <div className="text-blue-700 text-xs">
                                                Converts your question into vector embeddings and finds semantically similar contacts in your personal network
                                            </div>
                                        </div>
                                    </div>

                                    {/* Job #2 Explanation */}
                                    <div className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            canUseFullAiSearch ? 'bg-purple-100' : 'bg-gray-100'
                                        }`}>
                                            <span className={`font-semibold ${
                                                canUseFullAiSearch ? 'text-purple-600' : 'text-gray-400'
                                            }`}>2</span>
                                        </div>
                                        <div>
                                            <div className={`font-medium ${
                                                canUseFullAiSearch ? 'text-purple-800' : 'text-gray-600'
                                            }`}>
                                                AI Researcher {!canUseFullAiSearch && '(Business+)'}
                                            </div>
                                            <div className={`text-xs ${
                                                canUseFullAiSearch ? 'text-purple-700' : 'text-gray-500'
                                            }`}>
                                                {canUseFullAiSearch 
                                                    ? 'Analyzes your contacts and explains why each one matches your query'
                                                    : 'Upgrade to Business for AI-powered insights and explanations'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Examples */}
                                {aiSearchQuery.length === 0 && (
                                    <div className="pt-2 border-t border-purple-200">
                                        <div className="text-xs text-purple-600 mb-2">Try these examples:</div>
                                        <div className="flex flex-wrap gap-1">
                                            {[
                                                "serverless experts",
                                                "startup founders", 
                                                "marketing professionals",
                                                "React developers"
                                            ].map((example, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        setAiSearchQuery(example);
                                                        handleEnhancedSearch(example, true);
                                                    }}
                                                    className="px-2 py-1 text-xs bg-white border border-purple-300 rounded-full hover:bg-purple-50 text-purple-700 transition-colors"
                                                >
                                                    "{example}"
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                        
                        {/* Filter and Action Buttons - Grouped Together */}
                        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Status</option>
                                <option value="new">New</option>
                                <option value="viewed">Viewed</option>
                                <option value="archived">Archived</option>
                            </select>

                            {hasFeature(CONTACT_FEATURES.MAP_VISUALIZATION) && (
                                <button
                                    onClick={() => setShowMap(true)}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 flex items-center gap-2"
                                    disabled={contacts.filter(c => c.location?.latitude).length === 0}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                    Map View
                                </button>
                            )}

                            {hasFeature(CONTACT_FEATURES.EXPORT_DATA) && (
                                <button
                                    onClick={() => setShowImportExportModal(true)}
                                    className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    Import / Export
                                </button>
                            )}

                            {hasFeature(CONTACT_FEATURES.BUSINESS_CARD_SCANNER) && (
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    Scan Card
                                </button>
                            )}

                            <button
                                onClick={() => setShowGroupManager(true)}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                Manage Groups ({groups.length})
                            </button>
                        </div>
                    </div>

                    {/* Contacts List */}
                    {aiSearchResults !== null ? (
                       

                         <>
 <AiSearchResults 
          results={aiSearchResults}
          query={aiSearchQuery}
          searchTier={canUseFullAiSearch ? 'business' : 'premium'}
          onClearSearch={clearEnhancedSearch}
          onContactAction={handleContactAction}
          groups={groups}
          isStreaming={isStreamingActive}
          streamingProgress={streamingProgress}
          subscriptionLevel={subscriptionStatus?.subscriptionLevel}
          canUseSmartIcebreakers={canUseSmartIcebreakers}
          onUsageUpdate={refreshUsageInfo} // ✅ CORRECTED: Pass the correct function
        />

    {/* ✅ CORRECTED PROPS FOR VectorDebugPanel */}
    <VectorDebugPanel 
        results={aiSearchResults} 
        query={aiSearchQuery} 
        searchMetadata={{}} // Pass an empty object for now, or store metadata in state if needed
    />
  </>
                        
                ) : (
                    <ContactsList
                        contacts={contacts} 
                        selectionMode={selectionMode}
                        selectedContacts={selectedContacts}
                        onToggleSelection={(cid) => setSelectedContacts(p => p.includes(cid) ? p.filter(id => id !== cid) : [...p, cid])}
                        onEdit={(c) => { setEditingContact(c); setShowEditModal(true); }}
                        onStatusUpdate={(id, status) => handleContactAction('statusUpdate', { id, status })}
                        onDelete={(id) => handleContactAction('delete', id)}
                        onContactAction={(action, contact) => { 
                            if (action === 'email' && contact.email) window.open(`mailto:${contact.email}`);
                            if (action === 'phone' && contact.phone) window.open(`tel:${contact.phone}`);
                        }}
                        onMapView={(contact) => { 
                            setSelectedContactForMap(contact); 
                            setShowMap(true); 
                        }}
                        hasMore={pagination.hasMore}
                        onLoadMore={() => reloadData({ append: true })}
                        loading={loading}
                        groups={groups}
                    />
                )}

                <SearchProgressIndicator 
                    stage={searchStage}
                    isSearching={showSearchProgress}
                />

                {/* Groups Preview */}
                {groups.length > 0 && (
                    <div className="mt-6 bg-white p-4 rounded-lg shadow">
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Contact Groups</h3>
                        <div className="flex flex-wrap gap-2">
                            {groups.slice(0, 5).map((group) => (
                                <div key={group.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                    {group.name} ({group.contactIds?.length || 0})
                                </div>
                            ))}
                            {groups.length > 5 && (
                                <button
                                    onClick={() => setShowGroupManager(true)}
                                    className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200"
                                >
                                    +{groups.length - 5} more
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* All your existing modals - keeping the same structure */}
            <EditContactModal 
                contact={editingContact} 
                isOpen={showEditModal} 
                onClose={() => setShowEditModal(false)} 
                onSave={(updatedContact) => handleContactAction('update', updatedContact)} 
            />

            <GroupManagerModal 
                ref={groupManagerRef}
                isOpen={showGroupManager} 
                onClose={() => setShowGroupManager(false)} 
                groups={groups} 
                contacts={allOriginalContacts} 
                backgroundJobId={backgroundJobId}
                showJobProgress={showJobProgress}
                onBackgroundJobUpdate={handleBackgroundJobUpdate}
                usageInfo={usageInfo}
                usageLoading={usageLoading}
                onRefreshUsage={refreshUsageInfo}
                onGroupAction={async (action, data) => {
                    try {
                        const toastId = toast.loading('Processing group action...');
                        let result;
                        
                        switch (action) {
                            case 'create': 
                                result = await createContactGroup(data); 
                                break;
                            case 'delete': 
                                result = await deleteContactGroup(data); 
                                break;
                            case 'update': 
                                result = await updateContactGroup(data.id, data); 
                                break;
                                
                            case 'generateRules':
                                console.log("Rules-based group generation with options:", data);
                                
                                const rulesGroupService = ContactServiceFactory.getRulesGroupService();
                                result = await rulesGroupService.generateRulesBasedGroups(data);
                                
                                toast.dismiss(toastId);
                                if (result.success && result.groups?.length > 0) {
                                    toast.success(`Created ${result.groups.length} rules-based groups instantly!`, {
                                        duration: 6000
                                    });
                                } else {
                                    toast.success('Rules-based grouping completed but found no suitable groups.');
                                }
                     await reloadData({ 
                                    force: true, 
                                    clearCache: true,
                                    reason: 'rules_generation_complete'
                                });
                                
                                return result;
                                
                            case 'generateAsync': 
                                console.log("Starting async AI group generation with options:", data);
                                
                                const autoGroupService = ContactServiceFactory.getAutoGroupService();
                                result = await autoGroupService.generateAutoGroupsAsync(data);
                                
                                if (result.success && result.jobId) {
                                    setBackgroundJobId(result.jobId);
                                    setShowJobProgress(true);
                                    toast.dismiss(toastId);
                                    toast.success('AI group generation started! This will run in the background.');
                                    
                                    refreshUsageInfo();
                                }
                                
                                return result;
                                
                            case 'generate':
                                console.log("Converting legacy sync generate to async:", data);
                                const legacyService = ContactServiceFactory.getAutoGroupService();
                                result = await legacyService.generateAutoGroupsAsync(data);
                                
                                if (result.success && result.jobId) {
                                    setBackgroundJobId(result.jobId);
                                    setShowJobProgress(true);
                                    toast.dismiss(toastId);
                                    toast.success('AI group generation started! This will run in the background.');
                                    
                                    refreshUsageInfo();
                                }
                                
                                return result;
                                
                            case 'reload':
                                console.log('Group manager requested data reload');
                                await reloadData({ 
                                    force: true, 
                                    clearCache: true,
                                    reason: 'group_manager_reload'
                                });
                                
                                refreshUsageInfo();
                                
                                toast.dismiss(toastId);
                                return { success: true };
                                
                            default: 
                                throw new Error(`Unknown group action: ${action}`);
                        }
                        
                        toast.success('Group action successful!', { id: toastId });
                        
                        await reloadData({ 
                            force: true, 
                            clearCache: true,
                            reason: `after_${action}`
                        });
                        
                        if (['generateAsync', 'generate'].includes(action)) {
                            refreshUsageInfo();
                        }
                        
                        return result;
                        
                    } catch (error) {
                        console.error('Group action failed:', error);
                        
                        if (error.message?.includes('budget exceeded') || error.message?.includes('runs exceeded')) {
                            console.log('Budget limit error caught in group action handler');
                        } else {
                            toast.error(`Failed: ${ErrorHandler.getUserFriendlyMessage(error)}`);
                        }
                        
                        throw error;
                    }
                }}
                loading={loading}
                hasFeature={hasFeature}
                subscriptionStatus={subscriptionStatus}
            />

            <ShareContactsModal 
                isOpen={showShareModal} 
                onClose={() => { setShowShareModal(false); setSelectionMode(false); setSelectedContacts([]); }} 
                contacts={allOriginalContacts} 
                selectedContactIds={selectedContacts} 
                onShare={async (contactIds, teamMemberIds, permissions) => {
                    try {
                        const result = await shareContactsWithTeam(contactIds, teamMemberIds, permissions);
                        toast.success(`Shared ${contactIds.length} contact${contactIds.length !== 1 ? 's' : ''} with team!`);
                        setShowShareModal(false);
                        setSelectionMode(false);
                        setSelectedContacts([]);
                        return result;
                    } catch (error) {
                        toast.error(`Failed to share contacts: ${ErrorHandler.getUserFriendlyMessage(error)}`);
                        throw error;
                    }
                }}
                onGetTeamMembers={getTeamMembersForSharing}
                hasFeature={hasFeature}
            />
            
            <BusinessCardScanner 
                isOpen={showScanner} 
                onClose={() => setShowScanner(false)} 
                onContactParsed={(parsedFields) => { setScannedFields(parsedFields); setShowReviewModal(true); setShowScanner(false); }} 
                hasFeature={hasFeature}
            />

            <ContactReviewModal 
                isOpen={showReviewModal} 
                onClose={() => { setShowReviewModal(false); setScannedFields(null); }}
                parsedFields={scannedFields} 
                onSave={async (parsedFields) => {
                    try {
                        const toastId = toast.loading('Saving scanned contact...');
                        const result = await createContactFromScan(parsedFields);
                        toast.success('Contact saved from business card!', { id: toastId });
                        setShowReviewModal(false);
                        setScannedFields(null);
                        await reloadData();
                        return result;
                    } catch (error) {
                        toast.error(`Failed to save contact: ${ErrorHandler.getUserFriendlyMessage(error)}`);
                        throw error;
                    }
                }}
            />

            <ContactsMap
                isOpen={showMap}
                onClose={() => {
                    setShowMap(false);
                    setSelectedContactForMap(null);
                    setMapSelectedGroupIds([]);
                }}
                contacts={allOriginalContacts}
                groups={groups}
                selectedContactId={selectedContactForMap?.id}
                onMarkerClick={(contact) => {
                    console.log('Map marker clicked:', contact.name);
                }}
                onContactsUpdate={async () => {
                    await reloadData();
                }}
                selectedGroupIds={mapSelectedGroupIds}
                onGroupToggle={handleMapGroupToggle}
            />

            {/* Background Job Toast */}
            {showJobProgress && backgroundJobId && (
                <BackgroundJobToast
                    jobId={backgroundJobId}
                    onComplete={handleJobComplete}
                    onError={handleJobError}
                    onViewResults={handleViewResults}
                    title="Generating AI Groups"
                    position="top-right"
                />
            )}
        </div>
    );
}

// Sub-components (keeping your existing implementations)
function ContactsList({ 
    contacts, selectionMode, selectedContacts, onToggleSelection, 
    onEdit, onStatusUpdate, onDelete, onContactAction, onMapView,
    hasMore, onLoadMore, loading, groups = []
}) {
const { t, locale } = useTranslation();

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

function ContactCard({ contact, onEdit, onStatusUpdate, onDelete, onContactAction, onMapView, groups = [] }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const contactGroups = groups.filter(group => group.contactIds && group.contactIds.includes(contact.id));

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
        return new Date(dateString).toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const isDynamicContact = Array.isArray(contact.details);
    const headerName = contact.name || 'No Name';
    const headerEmail = contact.email || 'No Email';
    const isFromTeamMember = contact.sharedBy || contact.teamMemberSource;

    return (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="p-3 sm:p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${isFromTeamMember ? 'bg-gradient-to-br from-purple-400 to-blue-500' : 'bg-gradient-to-br from-blue-400 to-purple-500'}`}>
                            {headerName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{headerName}</h3>
                                <p className="text-xs text-gray-500 truncate">{headerEmail}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(contact.status)}`}>
                                        {t(`contacts.status_${contact.status}`) || contact.status}
                                    </span>
                                    {contact.location && <span className="text-xs text-green-600">📍</span>}
                                    {isFromTeamMember && <span className="text-xs text-purple-600">👥</span>}
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
                    <div className="p-3 sm:p-4 space-y-3">
                        
                        {contact.notes && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg className="w-4 h-4 text-yellow-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <h4 className="text-sm font-semibold text-yellow-800">Notes</h4>
                                </div>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{contact.notes}</p>
                            </div>
                        )}
                        
                        {!isDynamicContact && contact.message && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700 italic">&quot;{contact.message}&quot;</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100 mt-3">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('contacts.added') || 'Added'} {formatDate(contact.submittedAt)}</span>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 border-t border-gray-100">
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
                             <button 
                                onClick={() => onContactAction('email', contact)} 
                                className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span className="hidden sm:inline">{t('contacts.email') || 'Email'}</span>
                                <span className="sm:hidden">✉️</span>
                            </button>
                            {contact.phone && (
                                <button 
                                    onClick={() => onContactAction('phone', contact)} 
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
                                    onClick={() => onMapView(contact)} 
                                    className="flex items-center justify-center gap-1 px-2 py-2 text-xs text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">{t('contacts.map_button') || 'Map'}</span>
                                    <span className="sm:hidden">📍</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EditContactModal({ contact, isOpen, onClose, onSave }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({ 
        name: '', 
        email: '', 
        phone: '', 
        company: '', 
        message: '', 
        status: 'new' 
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData({ 
                name: contact.name || '', 
                email: contact.email || '', 
                phone: contact.phone || '', 
                company: contact.company || '', 
                message: contact.message || '', 
                status: contact.status || 'new' 
            });
        }
    }, [contact]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave({ ...contact, ...formData, lastModified: new Date().toISOString() });
            onClose();
        } catch (error) {
            console.error('Error updating contact:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-0 z-[10000] sm:items-center sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">{t('contacts.edit_contact') || 'Edit Contact'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.name') || 'Name'} *</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                            required 
                            disabled={isSubmitting} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.email') || 'Email'} *</label>
                        <input 
                            type="email" 
                            value={formData.email} 
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                            required 
                            disabled={isSubmitting} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.phone') || 'Phone'}</label>
                        <input 
                            type="tel" 
                            value={formData.phone} 
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                            disabled={isSubmitting} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.company') || 'Company'}</label>
                        <input 
                            type="text" 
                            value={formData.company} 
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                            disabled={isSubmitting} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.status') || 'Status'}</label>
                        <select 
                            value={formData.status} 
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" 
                            disabled={isSubmitting}
                        >
                            <option value="new">{t('contacts.status_new') || 'New'}</option>
                            <option value="viewed">{t('contacts.status_viewed') || 'Viewed'}</option>
                            <option value="archived">{t('contacts.status_archived') || 'Archived'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.message') || 'Message'}</label>
                        <textarea 
                            value={formData.message} 
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })} 
                            rows={3} 
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-base" 
                            disabled={isSubmitting} 
                        />
                    </div>
                    <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-base font-medium" 
                            disabled={isSubmitting}
                        >
                            {t('common.cancel') || 'Cancel'}
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium" 
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            )}
                            {isSubmitting ? (t('contacts.saving') || 'Saving...') : (t('contacts.save_changes') || 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}// app/dashboard/(dashboard pages)/contacts/page.jsx - UPDATED WITH CACHING & HISTORY