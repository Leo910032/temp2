// app/dashboard/(dashboard pages)/contacts/components/SmartIcebreakerModal.jsx
// React component for Smart Icebreaker generation with real-time web research

"use client"
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { SmartIcebreakerClientService } from '@/lib/services/serviceContact/client/services/SmartIcebreakerService';

export default function SmartIcebreakerModal({ 
  isOpen, 
  onClose, 
  contact, 
  strategicQuestions,
  subscriptionLevel = 'base',
  onUsageUpdate 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [icebreakers, setIcebreakers] = useState([]);
  const [generationStep, setGenerationStep] = useState('idle');
  const [costs, setCosts] = useState(null);
  const [searchSummary, setSearchSummary] = useState(null);
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState({});

  const icebreakerService = new SmartIcebreakerClientService();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIcebreakers([]);
      setCosts(null);
      setSearchSummary(null);
      setError(null);
      setGenerationStep('idle');
      setCopyFeedback({});
    }
  }, [isOpen]);

  // Check if user can use smart icebreakers
  const canUseFeature = icebreakerService.canUseSmartIcebreakers(subscriptionLevel);

  // Estimate costs
  const costEstimate = icebreakerService.estimateCost(3, 'serpapi');

  const handleGenerateIcebreakers = async () => {
    if (!canUseFeature) {
      toast.error(icebreakerService.getUpgradeMessage(subscriptionLevel));
      return;
    }

    if (!strategicQuestions || strategicQuestions.length === 0) {
      toast.error('Strategic questions are required for icebreaker generation');
      return;
    }

    const validation = icebreakerService.validateStrategicQuestions(strategicQuestions);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationStep('searching');

    try {
      console.log('🚀 Starting smart icebreaker generation for:', contact.name);

      const result = await icebreakerService.generateSmartIcebreakers(
        contact.id,
        strategicQuestions,
        {
          trackCosts: true,
          searchProvider: 'serpapi',
          maxSearches: 3
        }
      );

      console.log('✅ Icebreakers generated:', result);

      setGenerationStep('synthesizing');
      
      // Simulate a brief delay for the synthesis step
      setTimeout(() => {
        setIcebreakers(result.icebreakers || []);
        setCosts(result.costs);
        setSearchSummary(result.searchSummary);
        setGenerationStep('complete');
        
        if (onUsageUpdate) {
          onUsageUpdate();
        }

        toast.success(
          `Generated ${result.icebreakers?.length || 0} smart icebreakers! Cost: ${icebreakerService.formatCost(result.costs?.total || 0)}`,
          { duration: 5000 }
        );
      }, 1000);

    } catch (error) {
      console.error('❌ Icebreaker generation failed:', error);
      setError(error.message);
      setGenerationStep('error');
      toast.error(error.message || 'Failed to generate smart icebreakers');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyIcebreaker = async (icebreaker, index) => {
    try {
      await navigator.clipboard.writeText(icebreaker.text);
      setCopyFeedback({ ...copyFeedback, [index]: true });
      
      setTimeout(() => {
        setCopyFeedback(prev => ({ ...prev, [index]: false }));
      }, 2000);
      
      toast.success('Icebreaker copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                🧠 Smart Icebreakers
                <span className="text-sm bg-white bg-opacity-20 px-2 py-1 rounded-full">
                  Real-time Research
                </span>
              </h2>
              <p className="text-indigo-100 mt-1">
                AI-powered conversation starters for {contact.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <span className="ml-2 font-medium">{contact.name}</span>
              </div>
              <div>
                <span className="text-gray-600">Company:</span>
                <span className="ml-2 font-medium">{contact.company || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-gray-600">Title:</span>
                <span className="ml-2 font-medium">{contact.jobTitle || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>
                <span className="ml-2 font-medium">{contact.email || 'Not provided'}</span>
              </div>
            </div>
          </div>

          {/* Strategic Questions Preview */}
          {strategicQuestions && strategicQuestions.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-3">Strategic Research Questions</h3>
              <div className="space-y-2">
                {strategicQuestions.map((q, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-blue-800 font-medium text-sm">{q.question}</p>
                      <p className="text-blue-600 text-xs mt-1">Search: "{q.searchQuery}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscription Check */}
          {!canUseFeature && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="text-yellow-600">⚠️</div>
                <div>
                  <h3 className="font-semibold text-yellow-800">Upgrade Required</h3>
                  <p className="text-yellow-700 text-sm mt-1">
                    {icebreakerService.getUpgradeMessage(subscriptionLevel)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cost Estimate */}
          {canUseFeature && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">Cost Estimate</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-green-600">Web Searches:</span>
                  <span className="ml-2 font-medium">{icebreakerService.formatCost(costEstimate.searchCost)}</span>
                </div>
                <div>
                  <span className="text-green-600">AI Analysis:</span>
                  <span className="ml-2 font-medium">{icebreakerService.formatCost(costEstimate.llmCost)}</span>
                </div>
                <div>
                  <span className="text-green-600">Total:</span>
                  <span className="ml-2 font-bold">{icebreakerService.formatCost(costEstimate.totalCost)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Generation Progress */}
          {isGenerating && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                <h3 className="font-semibold text-indigo-800">
                  {generationStep === 'searching' && 'Researching real-time information...'}
                  {generationStep === 'synthesizing' && 'Generating personalized icebreakers...'}
                </h3>
              </div>
              
              <div className="space-y-2 text-sm text-indigo-700">
                <div className={`flex items-center gap-2 ${generationStep === 'searching' ? 'text-indigo-800 font-medium' : ''}`}>
                  <div className="w-2 h-2 rounded-full bg-indigo-300"></div>
                  Performing web searches for strategic questions
                </div>
                <div className={`flex items-center gap-2 ${generationStep === 'synthesizing' ? 'text-indigo-800 font-medium' : ''}`}>
                  <div className="w-2 h-2 rounded-full bg-indigo-300"></div>
                  Analyzing search results with AI
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-300"></div>
                  Creating personalized conversation starters
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="text-red-600">❌</div>
                <div>
                  <h3 className="font-semibold text-red-800">Generation Failed</h3>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Generated Icebreakers */}
          {icebreakers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Generated Icebreakers ({icebreakers.length})
                </h3>
                {costs && (
                  <div className="text-sm text-gray-600">
                    Total cost: <span className="font-medium">{icebreakerService.formatCost(costs.total)}</span>
                  </div>
                )}
              </div>

              {icebreakers.map((icebreaker, index) => {
                const formatted = icebreakerService.formatIcebreaker(icebreaker);
                return (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            formatted.category === 'company_news' ? 'bg-blue-100 text-blue-800' :
                            formatted.category === 'industry_trends' ? 'bg-green-100 text-green-800' :
                            formatted.category === 'personal_updates' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {formatted.categoryLabel}
                          </span>
                          <span className={`text-xs font-medium ${formatted.confidenceColor}`}>
                            {formatted.confidenceLabel} ({icebreaker.confidence}/10)
                          </span>
                        </div>
                        <p className="text-gray-900 leading-relaxed">{formatted.displayText}</p>
                        {icebreaker.source && (
                          <p className="text-xs text-gray-500 mt-2">
                            Source: {icebreaker.source}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyIcebreaker(icebreaker, index)}
                        className={`flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                          copyFeedback[index]
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {copyFeedback[index] ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Search Summary */}
              {searchSummary && (
                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Research Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span>Questions Processed:</span>
                      <span className="ml-2 font-medium">{searchSummary.questionsProcessed}</span>
                    </div>
                    <div>
                      <span>Successful Searches:</span>
                      <span className="ml-2 font-medium text-green-600">{searchSummary.successfulSearches}</span>
                    </div>
                    <div>
                      <span>Failed Searches:</span>
                      <span className="ml-2 font-medium text-red-600">{searchSummary.failedSearches}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {canUseFeature ? (
                <span>
                  Powered by real-time web research • Estimated cost: {icebreakerService.formatCost(costEstimate.totalCost)}
                </span>
              ) : (
                <span>
                  Upgrade to Business for real-time icebreaker generation
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {canUseFeature && (
                <button
                  onClick={handleGenerateIcebreakers}
                  disabled={isGenerating || !strategicQuestions || strategicQuestions.length === 0}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isGenerating
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      🚀 Generate Smart Icebreakers
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}