
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
import ContactsList from './components/ContactsList';
import EditContactModal from './components/EditContactModal';
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
// Around line 800-820, update the onContactParsed handler:
onContactParsed={(enhancedFields) => {
    // Handle the new enhanced structure
    if (enhancedFields.standardFields) {
        // If it's the new enhanced structure
        setScannedFields({
            standardFields: enhancedFields.standardFields || [],
            dynamicFields: enhancedFields.dynamicFields || [], // ✅ ENSURE THIS IS SET
            metadata: enhancedFields.metadata || {}
        });
    } else {
        // Fallback for old structure (array of fields)
        setScannedFields({
            standardFields: Array.isArray(enhancedFields) ? enhancedFields : [],
            dynamicFields: [], // ✅ EMPTY ARRAY FOR BACKWARD COMPATIBILITY
            metadata: {}
        });
    }
    setShowReviewModal(true); 
    setShowScanner(false);
}}
    hasFeature={hasFeature}
/>

            <ContactReviewModal 
                isOpen={showReviewModal} 
                onClose={() => { setShowReviewModal(false); setScannedFields(null); }}
                parsedFields={scannedFields} 
                onSave={async (parsedFields) => {
                    try {
                        const toastId = toast.loading('Saving scanned contact...');
            const result = await createContactFromScan(currentUser.uid, parsedFields);
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
