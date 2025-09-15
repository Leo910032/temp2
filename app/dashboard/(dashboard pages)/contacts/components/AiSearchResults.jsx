/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
// app/dashboard/(dashboard pages)/contacts/components/AiSearchResults.jsx - UPDATED WITH SMART ICEBREAKERS
"use client"
import React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import SmartIcebreakerModal from './SmartIcebreakerModal';
import { hasContactFeature, CONTACT_FEATURES } from '../../../../../lib/services/serviceContact/client/constants/contactConstants.js';

// Updated AiSearchResultCard with Smart Icebreaker integration
const AiSearchResultCard = React.memo(function AiSearchResultCard({ 
     contact, 
    index, 
    searchTier, 
    isExpanded, 
    onToggleExpanded, 
    onContactAction,
    getRelevanceColor,
    getRelevanceText,
    formatDate,
    groups,
    hasReranking = false,
    isNewResult = false,
    isEnhancementEligible = false,
    subscriptionLevel = 'base',
    canUseSmartIcebreakers = false, // ✅ ADD THIS PROP
    onUsageUpdate
}) {
    
// 1. Define the status variables at the top of the component
    // 1. Define the status variables at the top of the component
    const aiAnalysis = contact.searchMetadata?.aiAnalysis;
    const hasAiInsights = searchTier === 'business' && !!aiAnalysis;
    const isFiltered = contact.searchMetadata?.aiAnalysisStatus === 'filtered';
    const isPendingAI = isEnhancementEligible && !hasAiInsights && !isFiltered;
    const vectorScore = contact._vectorScore || contact.searchMetadata?.vectorSimilarity || 0;
    const rerankScore = contact.searchMetadata?.rerankScore;
    const hybridScore = contact.searchMetadata?.hybridScore;
    
    // Smart Icebreaker integration
    const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
    
    // Generate strategic questions from AI analysis
    const strategicQuestions = useMemo(() => {
        if (!hasAiInsights || !aiAnalysis) {
            // Fallback strategic questions if no AI analysis
            return [
                {
                    question: `What recent announcements has ${contact.company || 'their company'} made?`,
                    searchQuery: `"${contact.company}" recent news announcements 2024`,
                    category: 'company_updates'
                },
                {
                    question: `What are the latest trends in ${contact.jobTitle ? contact.jobTitle + ' role' : 'their industry'}?`,
                    searchQuery: `${contact.jobTitle || 'business'} trends 2024`,
                    category: 'industry_trends'
                },
                {
                    question: `Has ${contact.name} been mentioned in recent professional news?`,
                    searchQuery: `"${contact.name}" "${contact.company}" recent news`,
                    category: 'personal_updates'
                }
            ];
        }

        // Convert AI analysis factors into strategic questions
        const questions = [];
        
        // Company-related question
        if (contact.company) {
            questions.push({
                question: `What recent developments or announcements has ${contact.company} made?`,
                searchQuery: `"${contact.company}" recent news announcements 2024`,
                category: 'company_updates'
            });
        }
        
        // Role/Industry question
        const jobContext = contact.jobTitle || 'their role';
        questions.push({
            question: `What are the current trends and challenges in ${jobContext}?`,
            searchQuery: `${contact.jobTitle || contact.company || 'business'} industry trends challenges 2024`,
            category: 'industry_trends'
        });
        
        // Personal/Professional question
        questions.push({
            question: `Has ${contact.name} been featured in recent industry news or achievements?`,
            searchQuery: `"${contact.name}" "${contact.company}" professional news achievements`,
            category: 'personal_updates'
        });
        
        return questions;
    }, [hasAiInsights, aiAnalysis, contact]);

    const handleSmartIcebreakers = () => {
        if (!canUseSmartIcebreakers) {
            // Show upgrade message
            return;
        }
        setShowIcebreakerModal(true);
    };

    // This is the key logic: is it eligible for enhancement but doesn't have the data yet?

// TEMPORARY DEBUG - add this block
console.log(`[DEBUG] Contact ${contact.name}:`, {
    contactId: contact.id,
    aiAnalysisStatus: contact.searchMetadata?.aiAnalysisStatus,
    isFiltered,
    isPendingAI,
    hasAiInsights,
    isEnhancementEligible,
    confidence: contact.searchMetadata?.confidence,
    confidenceThreshold: contact.searchMetadata?.confidenceThreshold
});
                   
const SmartIcebreakerDebugPanel = ({ subscriptionLevel, contact, hasAiInsights }) => {
  const canUseSmartIcebreakers = ['business', 'enterprise'].includes(subscriptionLevel?.toLowerCase());
  
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg mb-4">
      <h4 className="font-bold text-yellow-800 mb-2">🐛 Smart Icebreaker Debug Panel</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h5 className="font-semibold text-yellow-700">Subscription Data:</h5>
          <ul className="text-yellow-600 space-y-1">
            <li>Raw subscriptionLevel: <code>"{subscriptionLevel}"</code></li>
            <li>Type: <code>{typeof subscriptionLevel}</code></li>
            <li>Lowercase: <code>"{subscriptionLevel?.toLowerCase()}"</code></li>
            <li>canUseSmartIcebreakers: <code>{canUseSmartIcebreakers.toString()}</code></li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-semibold text-yellow-700">Contact State:</h5>
          <ul className="text-yellow-600 space-y-1">
            <li>Contact ID: <code>{contact?.id}</code></li>
            <li>hasAiInsights: <code>{hasAiInsights.toString()}</code></li>
            <li>AI Analysis exists: <code>{!!contact?.searchMetadata?.aiAnalysis}</code></li>
            <li>Confidence: <code>{contact?.searchMetadata?.aiAnalysis?.confidenceScore}</code></li>
          </ul>
        </div>
      </div>
      
      <div className="mt-3 p-2 bg-yellow-100 rounded">
        <h5 className="font-semibold text-yellow-700">Expected vs Actual:</h5>
        <p className="text-yellow-600 text-xs">
          Expected: Business subscription should show Smart Icebreaker button<br/>
          Actual: {canUseSmartIcebreakers ? '✅ Should show button' : '❌ Button hidden - subscription insufficient'}
        </p>
      </div>
      
      <div className="mt-3 p-2 bg-blue-100 rounded">
        <h5 className="font-semibold text-blue-700">Quick Fix Test:</h5>
        <button 
          onClick={() => console.log('Debug button clicked - subscription check bypassed')}
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded"
        >
          Test Smart Icebreaker (Debug)
        </button>
      </div>
    </div>
  );
};
   return (
    <>
        <div className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${
            isNewResult ? 'animate-slide-in-from-top border-green-300 shadow-green-100' : ''
        } ${isPendingAI ? 'border-dashed border-purple-300' : ''}`}>
            {isNewResult && (
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-t-lg text-center font-medium border-b border-green-200">
                    ✨ New Result
                </div>
            )}
            
            <div className="p-4 cursor-pointer" onClick={onToggleExpanded}>
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {index + 1}
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 text-sm truncate">{contact.name || 'No Name'}</h3>
                                <p className="text-xs text-gray-500 truncate">{contact.email || 'No Email'}</p>
                                {contact.company && <p className="text-xs text-blue-600 truncate mt-1">{contact.company}</p>}
                                
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className={`text-xs font-medium ${getRelevanceColor(hybridScore || rerankScore || vectorScore)}`}>
                                        {getRelevanceText(hybridScore || rerankScore || vectorScore)}
                                    </span>
                                    {hasAiInsights && (
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                            AI Enhanced
                                        </span>
                                    )}
                                    {/* FIXED: Only show "AI Analyzing..." if not filtered */}
{isPendingAI && !isFiltered && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                            AI Analyzing...
                                        </span>
                                    )}
                                    {/* ADDED: Show filtered status badge */}
{isFiltered && (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                            Low Confidence
                                        </span>
                                    )}
                                    {hasReranking && rerankScore !== undefined && (
                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                                            Reranked
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="ml-2">
                                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>

                      {/* FIRST: Check for filtered status (highest priority) */}

                        {/* This entire block controls the preview shown when the card is COLLAPSED */}
                   
                    </div>
                </div>
            </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="border-t border-gray-100">
                        <div className="p-4 space-y-4">
                            
                            {/* Enhanced Analysis Results - Now includes rerank scores */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-700">Analysis Results:</span>
                                <div className="flex items-center gap-4 flex-wrap">
                                    {/* AI Confidence */}
                                    {hasAiInsights && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600">AI Confidence:</span>
                                            <div className="w-16 bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-2 rounded-full transition-all duration-300 ${
                                                        aiAnalysis.confidenceScore >= 8 ? 'bg-green-500' :
                                                        aiAnalysis.confidenceScore >= 6 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${(aiAnalysis.confidenceScore / 10) * 100}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs font-bold text-gray-900">
                                                {aiAnalysis.confidenceScore}/10
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Rerank Score */}
                                    {hasReranking && rerankScore !== undefined && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600">Rerank:</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                                rerankScore >= 0.8 ? 'bg-teal-100 text-teal-700' :
                                                rerankScore >= 0.6 ? 'bg-blue-100 text-blue-700' :
                                                rerankScore >= 0.4 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-orange-100 text-orange-700'
                                            }`}>
                                                {(rerankScore * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Vector Similarity Score */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600">Vector:</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                            vectorScore >= 0.75 ? 'bg-green-100 text-green-700' :
                                            vectorScore >= 0.60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-orange-100 text-orange-700'
                                        }`}>
                                            {(vectorScore * 100).toFixed(0)}%
                                        </span>
                                    </div>

                                    {/* Hybrid Score (if available) */}
                                                                    {/* Hybrid Score (if available and is a valid number) */}
                                    {typeof hybridScore === 'number' && !isNaN(hybridScore) && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-600">Final:</span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                                hybridScore >= 0.8 ? 'bg-indigo-100 text-indigo-700' :
                                                hybridScore >= 0.6 ? 'bg-purple-100 text-purple-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                                {(hybridScore * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* AI Insights (Business tier) */}
                            {hasAiInsights && (
                                <div className="space-y-3">
                                    {/* Explanation */}
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                        <h4 className="text-sm font-semibold text-purple-800 mb-1">💡 Why this contact matches:</h4>
                                        <p className="text-sm text-purple-700">{aiAnalysis.matchExplanation}</p>
                                    </div>

                                    {/* Key Relevance Factors */}
                                    {aiAnalysis.relevanceFactors && (
                                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                            <h4 className="text-sm font-semibold text-blue-800 mb-2">🔑 Key Relevance Factors:</h4>
                                            <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                                                {aiAnalysis.relevanceFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Smart Icebreaker Generation - NEW */}
                                    {canUseSmartIcebreakers && (
                                        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-indigo-800 mb-1">🧠 Smart Icebreakers</h4>
                                                    <p className="text-xs text-indigo-600">Generate real-time conversation starters</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSmartIcebreakers();
                                                    }}
                                                    className="px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                                                >
                                                    Generate Icebreakers
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Upgrade Prompt for non-Business users */}
                                    {!canUseSmartIcebreakers && hasAiInsights && (
                                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-yellow-800 mb-1">🚀 Smart Icebreakers</h4>
                                                    <p className="text-xs text-yellow-700">Upgrade to Business for real-time conversation starters</p>
                                                </div>
                                                <button className="px-3 py-2 bg-yellow-600 text-white text-xs rounded-lg hover:bg-yellow-700 transition-colors font-medium">
                                                    Upgrade
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {contact.notes && (
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <h4 className="text-sm font-semibold text-yellow-800 mb-2">📝 Notes:</h4>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{contact.notes}</p>
                                </div>
                            )}
                            
                            {contact.message && (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-2">💬 Message:</h4>
                                    <p className="text-sm text-gray-700 italic">"{contact.message}"</p>
                                </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100 flex-wrap">
                                <span>Added {formatDate(contact.submittedAt)}</span>
                                <span className="capitalize">{contact.source?.replace('_', ' ') || 'Manual'}</span>
                                {hasAiInsights && (
                                    <span className="text-purple-600">Enhanced with AI</span>
                                )}
                                {hasReranking && rerankScore !== undefined && (
                                    <span className="text-teal-600">Reranked for accuracy</span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="p-4 border-t border-gray-100">
                            <div className="grid grid-cols-3 gap-2">
                                <button className="px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                    Email
                                </button>
                                <button className="px-3 py-2 text-xs bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                                    Call
                                </button>
                                <button className="px-3 py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors">
                                    View
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Smart Icebreaker Modal */}
            <SmartIcebreakerModal
                isOpen={showIcebreakerModal}
                onClose={() => setShowIcebreakerModal(false)}
                contact={contact}
                strategicQuestions={strategicQuestions}
                subscriptionLevel={subscriptionLevel}
                onUsageUpdate={onUsageUpdate}
            />
        </>
    );
});

// Export the main component with Smart Icebreaker integration
export default function AiSearchResults({ 
    results,
    query, 
    searchTier, 
    onClearSearch, 
    onContactAction, 
    groups = [],
    isStreaming = false,
    streamingProgress = null,
    subscriptionLevel = 'base',
    canUseSmartIcebreakers = false, // ✅ ADD THIS
    onUsageUpdate
}) {
    const { t } = useTranslation();
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [displayedResults, setDisplayedResults] = useState([]);
    const [selectedSimilarityFilter, setSelectedSimilarityFilter] = useState('all');
    
    const lastQueryRef = useRef('');
    const lastResultsHashRef = useRef('');
    const filterInitializedRef = useRef(false);
    
    // Check if reranking was used in these results
    const hasReranking = useMemo(() => {
        return results.some(result => result.searchMetadata?.rerankScore !== undefined);
    }, [results]);

    const getResultsHash = useCallback((resultsCount, query) => {
        return `${query}-${resultsCount}`;
    }, []);

    useEffect(() => {
        if (query !== lastQueryRef.current) {
            console.log('Query changed, resetting state:', { from: lastQueryRef.current, to: query });
            filterInitializedRef.current = false;
            setSelectedSimilarityFilter('all');
            setExpandedCards(new Set());
            setDisplayedResults([]);
            lastQueryRef.current = query;
            lastResultsHashRef.current = '';
        }
    }, [query]);

    const categorizedResults = useMemo(() => {
        const categories = { high: [], medium: [], low: [] };
        if (!Array.isArray(results)) return categories;
        
        results.forEach(contact => {
            if (!contact) return;
            const tier = contact.similarityTier || contact.searchMetadata?.similarityTier || 'low';
            if (categories[tier]) {
                categories[tier].push(contact);
            } else if (tier === 'filtered') {
                categories.low.push(contact);
            }
        });

        // Ensure each category is sorted internally
        Object.keys(categories).forEach(key => {
            categories[key].sort((a, b) => {
                const scoreA = a.searchMetadata?.hybridScore || a.searchMetadata?.rerankScore || a._vectorScore || 0;
                const scoreB = b.searchMetadata?.hybridScore || b.searchMetadata?.rerankScore || b._vectorScore || 0;
                return scoreB - scoreA;
            });
        });
        return categories;
    }, [results]);
    
    useEffect(() => {
        const currentHash = getResultsHash((results || []).length, query);
        const hasResults = (results || []).length > 0;
        
        if (!filterInitializedRef.current && hasResults) {
            console.log('Initializing filter for new results:', currentHash);
            const counts = {
                high: categorizedResults.high.length,
                medium: categorizedResults.medium.length,
                low: categorizedResults.low.length
            };
            const defaultCategory = ['high', 'medium', 'low'].find(cat => counts[cat] > 0) || 'all';
            setSelectedSimilarityFilter(defaultCategory);
            filterInitializedRef.current = true;
        }
        lastResultsHashRef.current = currentHash;
    }, [categorizedResults, results, query, getResultsHash]);
    
    const filteredAndSortedResults = useMemo(() => {
        let combinedResults = [];
        if (selectedSimilarityFilter === 'all') {
            combinedResults = [...categorizedResults.high, ...categorizedResults.medium, ...categorizedResults.low];
        } else {
            combinedResults = categorizedResults[selectedSimilarityFilter] || [];
        }
        // The final results are already pre-sorted by hybrid/rerank score from the service,
        // but an extra sort here ensures consistency if the state updates out of order.
        return combinedResults.sort((a, b) => {
            const scoreA = a.searchMetadata?.hybridScore || a.searchMetadata?.rerankScore || a._vectorScore || 0;
            const scoreB = b.searchMetadata?.hybridScore || b.searchMetadata?.rerankScore || b._vectorScore || 0;
            return scoreB - scoreA;
        });
    }, [categorizedResults, selectedSimilarityFilter]);

    useEffect(() => {
        if (!Array.isArray(filteredAndSortedResults)) return;

        setDisplayedResults([...filteredAndSortedResults]);

        if (filteredAndSortedResults.length > 0 && expandedCards.size === 0) {
            const firstWithInsights = filteredAndSortedResults.find(r => r.searchMetadata?.aiAnalysis);
            if (firstWithInsights) {
                setExpandedCards(new Set([firstWithInsights.id]));
            }
        }
    }, [filteredAndSortedResults]);

    const toggleExpanded = useCallback((contactId) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            newSet.has(contactId) ? newSet.delete(contactId) : newSet.add(contactId);
            return newSet;
        });
    }, []);

    const getRelevanceColor = useCallback((score) => {
        if (!score) return 'text-gray-500';
        if (score >= 0.9) return 'text-green-600';
        if (score >= 0.8) return 'text-blue-600';
        if (score >= 0.7) return 'text-yellow-600';
        return 'text-orange-600';
    }, []);
    
    const getRelevanceText = useCallback((score) => {
        if (!score) return 'Relevant';
        if (score >= 0.85) return 'Highly Relevant';
        if (score >= 0.75) return 'Relevant';
        return 'Possibly Relevant';
    }, []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric'
        });
    }, []);

    return (
        <div className="space-y-6">
            {/* Header and Progress Indicator */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            {isStreaming ? (
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="text-2xl">🤖</span>
                                    {hasReranking && <span className="text-lg">📊</span>}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-lg font-semibold text-gray-900">
                                AI Search Results for "{query}"
                            </h3>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-600">
                                    Found {results.length} relevant contacts using {searchTier === 'business' ? 'AI-powered analysis' : 'semantic search'}
                                </p>
                                {hasReranking && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                        + Reranked
                                    </span>
                                )}
                                {searchTier === 'business' && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                        🧠 Smart Icebreakers Available
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={onClearSearch}
                        className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Clear Search
                    </button>
                </div>
                {isStreaming && streamingProgress && (
                    <div className="mt-4 p-3 bg-white rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="animate-pulse w-2 h-2 bg-purple-500 rounded-full"></div>
                            <span className="text-sm font-medium text-purple-700">
                                Live AI Analysis {hasReranking ? '(Reranked Results)' : ''}
                            </span>
                        </div>
                        {streamingProgress.type === 'processing' && (
                            <div className="text-sm text-gray-600">
                                Analyzing: {streamingProgress.contactName} ({streamingProgress.processed}/{streamingProgress.total})
                                {streamingProgress.rerankScore && (
                                    <span className="ml-2 text-teal-600">
                                        Rerank: {(streamingProgress.rerankScore * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        )}
                        {streamingProgress.percentage && (
                            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${streamingProgress.percentage}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Similarity Filter Navigation */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Filter by relevance:</span>
                    <div className="flex flex-wrap gap-2">
                        <SimilarityFilterButton 
                            type="high" 
                            label="High Relevance"
                            count={categorizedResults.high.length} 
                            isSelected={selectedSimilarityFilter === 'high'} 
                            onClick={() => setSelectedSimilarityFilter('high')}
                        />
                        <SimilarityFilterButton 
                            type="medium" 
                            label="Medium Relevance"
                            count={categorizedResults.medium.length} 
                            isSelected={selectedSimilarityFilter === 'medium'} 
                            onClick={() => setSelectedSimilarityFilter('medium')}
                        />
                        <SimilarityFilterButton 
                            type="low" 
                            label="Lower Relevance"
                            count={categorizedResults.low.length} 
                            isSelected={selectedSimilarityFilter === 'low'} 
                            onClick={() => setSelectedSimilarityFilter('low')}
                        />
                        <SimilarityFilterButton 
                            type="all" 
                            label="All Results"
                            count={results.length}
                            isSelected={selectedSimilarityFilter === 'all'} 
                            onClick={() => setSelectedSimilarityFilter('all')}
                        />
                    </div>
                </div>
            </div>

            {/* No Results Message */}
            {results.length > 0 && filteredAndSortedResults.length === 0 && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-4xl mb-2">🤷</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found in this similarity level</h3>
                    <p className="text-gray-600">
                        Try selecting a different similarity filter or clearing the search.
                    </p>
                </div>
            )}

            {/* Results List */}
            <div className="space-y-4">
                {filteredAndSortedResults.map((contact) => {
                    const originalIndex = results.findIndex(r => r.id === contact.id);
                    const isEligible = searchTier === 'business' && originalIndex !== -1 && originalIndex < 10;

                    return (
                       <AiSearchResultCard 
        key={contact.id}
        contact={contact}
        index={originalIndex}
        searchTier={searchTier}
        isExpanded={expandedCards.has(contact.id)}
        onToggleExpanded={() => toggleExpanded(contact.id)}
        onContactAction={onContactAction}
        getRelevanceColor={getRelevanceColor}
        getRelevanceText={getRelevanceText}
        formatDate={formatDate}
        groups={groups}
        hasReranking={hasReranking}
        isNewResult={isStreaming && contact.searchMetadata?.aiAnalysis && !expandedCards.has(contact.id)}
        isEnhancementEligible={isEligible}
        subscriptionLevel={subscriptionLevel}
        canUseSmartIcebreakers={canUseSmartIcebreakers} // ✅ ADD THIS PROP
        onUsageUpdate={onUsageUpdate}
    />
                    )
                })}
            </div>
        </div>
    );
}

// Helper component for similarity filter buttons
const SimilarityFilterButton = React.memo(function SimilarityFilterButton({ type, label, count, isSelected, onClick }) {
    const getButtonConfig = (type) => {
        switch (type) {
            case 'high':
                return {
                    label: 'High Similarity',
                    color: 'green',
                    icon: '🎯',
                    bgClass: isSelected ? 'bg-green-500' : 'bg-green-100',
                    textClass: isSelected ? 'text-white' : 'text-green-700',
                    borderClass: 'border-green-300',
                    hoverClass: 'hover:bg-green-200'
                };
            case 'medium':
                return {
                    label: 'Medium Similarity',
                    color: 'yellow',
                    icon: '⚡',
                    bgClass: isSelected ? 'bg-yellow-500' : 'bg-yellow-100',
                    textClass: isSelected ? 'text-white' : 'text-yellow-700',
                    borderClass: 'border-yellow-300',
                    hoverClass: 'hover:bg-yellow-200'
                };
            case 'low':
                return {
                    label: 'Low Similarity',
                    color: 'orange',
                    icon: '🔍',
                    bgClass: isSelected ? 'bg-orange-500' : 'bg-orange-100',
                    textClass: isSelected ? 'text-white' : 'text-orange-700',
                    borderClass: 'border-orange-300',
                    hoverClass: 'hover:bg-orange-200'
                };
            case 'all':
                return {
                    label: 'All Results',
                    color: 'blue',
                    icon: '📊',
                    bgClass: isSelected ? 'bg-blue-500' : 'bg-blue-100',
                    textClass: isSelected ? 'text-white' : 'text-blue-700',
                    borderClass: 'border-blue-300',
                    hoverClass: 'hover:bg-blue-200'
                };
        }
    };

    const config = getButtonConfig(type);

    return (
        <button
            onClick={onClick}
            disabled={count === 0}
            className={`
                relative px-4 py-2 rounded-lg border transition-all duration-300 transform
                ${config.bgClass} ${config.textClass} ${config.borderClass}
                ${!isSelected && count > 0 ? config.hoverClass : ''}
                ${isSelected ? 'scale-105 shadow-lg' : 'hover:scale-102'}
                ${count === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
                flex items-center gap-2 text-sm font-medium
            `}
        >
            <span className="text-base">{config.icon}</span>
            <span>{config.label}</span>
            <span className={`
                px-2 py-0.5 rounded-full text-xs font-bold
                ${isSelected ? 'bg-white bg-opacity-30' : 'bg-white bg-opacity-60'}
            `}>
                {count}
            </span>
            
            {isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-current rounded-full"></div>
                </div>
            )}
        </button>
    );
});

// CSS for animations
const styles = `
@keyframes slide-in-from-top {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in-from-top {
  animation: slide-in-from-top 0.5s ease-out;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hover\\:scale-102:hover {
  transform: scale(1.02);
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.querySelector('#ai-search-results-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-search-results-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}