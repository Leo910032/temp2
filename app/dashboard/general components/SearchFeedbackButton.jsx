// app/dashboard/general components/SearchFeedbackButton.jsx
"use client";

import { useState, useEffect } from 'react';
import { SearchFeedbackService } from '@/lib/services/serviceContact/client/services/SearchFeedbackService';
import { toast } from 'react-hot-toast';

/**
 * SearchFeedbackButton Component
 *
 * Displays thumbs up/down buttons for users to rate semantic search quality.
 * Feedback is stored in SessionUsage collection for analytics.
 *
 * @param {string} sessionId - The search session ID from the API response
 * @param {string} searchMode - The search mode ('semantic' or 'standard')
 * @param {boolean} isAiSearch - Whether this is an AI-powered search
 */
export default function SearchFeedbackButton({ sessionId, searchMode, isAiSearch }) {
    const [feedbackState, setFeedbackState] = useState('idle'); // 'idle' | 'submitting' | 'submitted'
    const [submittedValue, setSubmittedValue] = useState(null); // true (good) | false (not good)

    // Check localStorage on mount to see if feedback was already submitted
    useEffect(() => {
        if (!sessionId) return;

        const cachedFeedback = SearchFeedbackService.getFeedbackFromCache(sessionId);
        if (cachedFeedback) {
            setFeedbackState('submitted');
            setSubmittedValue(cachedFeedback.isPositive);
        }
    }, [sessionId]);

    // Don't show the button if:
    // 1. Not a semantic search
    // 2. No sessionId provided
    if (searchMode !== 'semantic' || !isAiSearch || !sessionId) {
        return null;
    }

    const handleFeedback = async (isPositive) => {
        if (feedbackState === 'submitting' || feedbackState === 'submitted') {
            return; // Prevent duplicate submissions
        }

        setFeedbackState('submitting');

        try {
            const result = await SearchFeedbackService.submitFeedback(sessionId, isPositive);

            if (result.success) {
                setFeedbackState('submitted');
                setSubmittedValue(isPositive);
                toast.success('Thank you for your feedback!');
            } else if (result.alreadySubmitted) {
                setFeedbackState('submitted');
                setSubmittedValue(isPositive);
                toast.info('Feedback already submitted for this search');
            } else {
                throw new Error(result.message || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            toast.error('Failed to submit feedback. Please try again.');
            setFeedbackState('idle'); // Allow retry
        }
    };

    // Submitted state - show which button was selected
    if (feedbackState === 'submitted') {
        return (
            <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-600">Search quality:</span>
                <div className="flex items-center gap-1">
                    <button
                        disabled
                        className={`p-1.5 rounded-md transition-colors ${
                            submittedValue === true
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-400'
                        }`}
                        title="Good search"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                    </button>
                    <button
                        disabled
                        className={`p-1.5 rounded-md transition-colors ${
                            submittedValue === false
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-400'
                        }`}
                        title="Not good search"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                        </svg>
                    </button>
                </div>
                <span className="text-xs text-gray-500">Thanks!</span>
            </div>
        );
    }

    // Active state - allow user to submit feedback
    return (
        <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-600">Was this search helpful?</span>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => handleFeedback(true)}
                    disabled={feedbackState === 'submitting'}
                    className="p-1.5 rounded-md hover:bg-green-50 hover:text-green-700 text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Good search"
                >
                    {feedbackState === 'submitting' ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                        </svg>
                    )}
                </button>
                <button
                    onClick={() => handleFeedback(false)}
                    disabled={feedbackState === 'submitting'}
                    className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-700 text-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Not good search"
                >
                    {feedbackState === 'submitting' ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                    ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}
