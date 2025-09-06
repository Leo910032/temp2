// components/BackgroundJobToast.jsx
"use client"
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from "@/contexts/AuthContext";

export function BackgroundJobToast({
    jobId,
    onComplete,
    onError,
    onViewResults,
    title = "Processing",
    position = "top-right"
}) {
    const { currentUser } = useAuth();
    const [job, setJob] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!jobId) return;

        let pollInterval;
        let mounted = true;

        const pollJobStatus = async () => {
            try {
                const token = await currentUser.getIdToken(true); // Force refresh token
                if (!token) {
                    throw new Error('No authentication token available');
                }

                const response = await fetch(`/api/user/contacts/groups/job-status/${jobId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                
                if (!mounted) return;

                setJob(result.job);

                if (result.job.status === 'completed') {
                    clearInterval(pollInterval);
                    handleJobComplete(result.job);
                } else if (result.job.status === 'failed') {
                    clearInterval(pollInterval);
                    handleJobError(result.job);
                }
            } catch (error) {
                console.error('Error polling job status:', error);
                if (mounted) {
                    clearInterval(pollInterval);
                    setError(error.message);
                    handleJobError({ error: error.message });
                }
            }
        };

        // Start polling
        pollJobStatus();
        pollInterval = setInterval(pollJobStatus, 2000);

        return () => {
            mounted = false;
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [jobId, onComplete, onError, currentUser]);

    const handleJobComplete = (completedJob) => {
        const result = completedJob.result;
        const groupsCreated = result?.totalSaved || result?.groups?.length || 0;
        const actualCost = result?.actualCost || 0;

        toast.success(
            <div>
                <div className="font-medium">{title} Complete!</div>
                <div className="text-sm text-gray-600">
                    Created {groupsCreated} groups
                    {actualCost > 0 && ` • Cost: $${actualCost.toFixed(6)}`}
                </div>
            </div>,
            { 
                duration: 8000,
                action: groupsCreated > 0 ? {
                    label: 'View Groups',
                    onClick: onViewResults
                } : undefined
            }
        );

        onComplete?.(completedJob.result);
    };

    const handleJobError = (failedJob) => {
        console.log('[Modal] Job error:', new Error(failedJob.error || 'Unknown error'));
        
        const errorMessage = failedJob.error || 'Unknown error occurred';
        
        // Handle budget-specific errors
        if (errorMessage.includes('budget exceeded') || errorMessage.includes('Budget limit')) {
            toast.error(
                <div>
                    <div className="font-medium">Monthly AI Budget Limit Reached</div>
                    <div className="text-sm text-gray-600">
                        Upgrade your plan to continue using AI features.
                    </div>
                </div>,
                {
                    duration: 10000,
                    action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                    }
                }
            );
        } else if (errorMessage.includes('runs exceeded')) {
            toast.error(
                <div>
                    <div className="font-medium">Monthly AI Runs Limit Reached</div>
                    <div className="text-sm text-gray-600">
                        Upgrade your plan for more AI operations.
                    </div>
                </div>,
                {
                    duration: 10000,
                    action: {
                        label: 'Upgrade',
                        onClick: () => window.open('/pricing', '_blank')
                    }
                }
            );
        } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
            toast.error(
                <div>
                    <div className="font-medium">Authentication Error</div>
                    <div className="text-sm text-gray-600">Please refresh the page and try again.</div>
                </div>,
                { duration: 8000 }
            );
        } else {
            toast.error(
                <div>
                    <div className="font-medium">{title} Failed</div>
                    <div className="text-sm text-gray-600">{errorMessage}</div>
                </div>,
                { duration: 8000 }
            );
        }

        console.log(`Background AI job failed:`, new Error(errorMessage));
        onError?.(new Error(errorMessage));
    };

    // Show progress toast while job is running
    if (!job || job.status === 'queued' || job.status === 'processing') {
        return (
            <div className={`fixed ${getPositionClasses(position)} z-50 m-4`}>
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
                    <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <div className="flex-1">
                            <div className="font-medium text-gray-900">{title}</div>
                            <div className="text-sm text-gray-500">
                                {job?.stages && Array.isArray(job.stages) ? getCurrentStageText(job.stages) : 'Starting...'}
                            </div>
                            {job?.progress !== undefined && (
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Progress</span>
                                        <span>{job.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${job.progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {job?.estimatedCost && (
                        <div className="mt-2 text-xs text-gray-500 border-t pt-2">
                            Estimated cost: ${job.estimatedCost.toFixed(6)}
                            {job.actualCost && ` • Actual: $${job.actualCost.toFixed(6)}`}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

// Fixed helper function with proper array checking
function getCurrentStageText(stages) {
    // Ensure stages is an array and has content
    if (!Array.isArray(stages) || stages.length === 0) {
        return 'Processing...';
    }
    
    const currentStage = stages.find(stage => stage.status === 'in_progress');
    if (currentStage) {
        return currentStage.name;
    }
    
    const completedStages = stages.filter(stage => stage.status === 'completed').length;
    return `${completedStages}/${stages.length} stages completed`;
}

function getPositionClasses(position) {
    switch (position) {
        case 'top-left':
            return 'top-0 left-0';
        case 'top-right':
            return 'top-0 right-0';
        case 'bottom-left':
            return 'bottom-0 left-0';
        case 'bottom-right':
            return 'bottom-0 right-0';
        case 'top-center':
            return 'top-0 left-1/2 transform -translate-x-1/2';
        case 'bottom-center':
            return 'bottom-0 left-1/2 transform -translate-x-1/2';
        default:
            return 'top-0 right-0';
    }
}