// components/BackgroundJobToast.jsx
"use client";
import { useState, useEffect } from 'react';
import { getCurrentUserToken } from '@/lib/auth/user';

export function BackgroundJobToast({ 
  jobId, 
  onComplete, 
  onError,
  onViewResults,
  title = "Processing...",
  position = "top-right" // or "bottom-right"
}) {
  const [job, setJob] = useState(null);
  const [isVisible, setIsVisible] = useState(!!jobId);
  const [isMinimized, setIsMinimized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showCompleteButton, setShowCompleteButton] = useState(false);

  useEffect(() => {
    if (!jobId || !isVisible) return;
    
    let pollInterval;
    const maxRetries = 5;
    
    const pollStatus = async () => {
      try {
        const token = await getCurrentUserToken();
        const response = await fetch(`/api/user/contacts/groups/job-status/${jobId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch job status`);
        }
        
        const data = await response.json();
        const jobData = data.job;
        
        setJob(jobData);
        setRetryCount(0);
        
        if (jobData.status === 'completed') {
          clearInterval(pollInterval);
          setShowCompleteButton(true);
          
          // Call the completion handler
          onComplete?.(jobData.result);
          
          // Auto-hide after 30 seconds if user doesn't interact
          setTimeout(() => {
            if (isVisible) setIsVisible(false);
          }, 30000);
          
        } else if (jobData.status === 'failed') {
          clearInterval(pollInterval);
          onError?.(new Error(jobData.error || 'Job failed'));
          
          // Auto-hide failed jobs after 10 seconds
          setTimeout(() => {
            setIsVisible(false);
          }, 10000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setRetryCount(prev => prev + 1);
        
        if (retryCount >= maxRetries) {
          onError?.(new Error(`Connection failed after ${maxRetries} attempts`));
          clearInterval(pollInterval);
          setIsVisible(false);
        }
      }
    };
    
    pollStatus();
    pollInterval = setInterval(pollStatus, 3000); // Poll every 3 seconds
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId, isVisible, onComplete, onError, retryCount]);

  if (!isVisible || !job) return null;

  const getPositionClasses = () => {
    switch (position) {
      case "bottom-right":
        return "fixed bottom-4 right-4";
      case "top-right":
      default:
        return "fixed top-20 right-4";
    }
  };

  const getStatusIcon = () => {
    if (job.status === 'completed') {
      return (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    } else if (job.status === 'failed') {
      return (
        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      );
    }
  };

  const getStatusColor = () => {
    if (job.status === 'completed') return 'bg-green-50 border-green-200';
    if (job.status === 'failed') return 'bg-red-50 border-red-200';
    return 'bg-blue-50 border-blue-200';
  };

  const getProgressColor = () => {
    if (job.status === 'completed') return 'bg-green-600';
    if (job.status === 'failed') return 'bg-red-600';
    return 'bg-blue-600';
  };

  return (
    <div className={`${getPositionClasses()} z-50 max-w-sm w-full`}>
      <div className={`rounded-xl shadow-lg border-2 ${getStatusColor()} bg-white transition-all duration-300 ${
        isMinimized ? 'h-16' : 'auto'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium text-gray-900 text-sm">
              {job.status === 'completed' ? 'AI Groups Ready!' : 
               job.status === 'failed' ? 'Generation Failed' : 
               'Generating AI Groups'}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} 
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-3 space-y-3">
            {/* Show EITHER the completion button OR the status/progress */}
            {job.status === 'completed' && showCompleteButton ? (
              // Replace entire content with the action button when completed
              <button
                onClick={() => {
                  console.log('[Toast] View Generated Groups button clicked');
                  onViewResults?.();
                  setIsVisible(false);
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2 shadow-md"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                View Generated Groups
              </button>
            ) : (
              // Show status and progress for in-progress or failed jobs
              <>
                <div className="text-sm text-gray-600">
                  {job.status === 'failed' ? (
                    <div className="text-red-600">
                      {job.error || 'An error occurred during processing'}
                    </div>
                  ) : (
                    <div>
                      AI is analyzing your contacts and creating intelligent groups.
                      {retryCount > 0 && (
                        <div className="text-xs text-yellow-600 mt-1">
                          Connection issues, retrying... ({retryCount}/5)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Bar - only show when not completed and not failed */}
                {job.status !== 'completed' && job.status !== 'failed' && (
                  <div className="space-y-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${getProgressColor()}`}
                        style={{ width: `${Math.max(job.progress || 0, 5)}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{job.progress || 0}% complete</span>
                      {job.currentChunk && job.totalChunks && (
                        <span>Batch {job.currentChunk}/{job.totalChunks}</span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing background jobs
export function useBackgroundJob() {
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobCallbacks, setJobCallbacks] = useState({});

  const startJob = (jobId, callbacks = {}) => {
    setActiveJobId(jobId);
    setJobCallbacks(callbacks);
  };

  const clearJob = () => {
    setActiveJobId(null);
    setJobCallbacks({});
  };

  return {
    activeJobId,
    jobCallbacks,
    startJob,
    clearJob
  };
}