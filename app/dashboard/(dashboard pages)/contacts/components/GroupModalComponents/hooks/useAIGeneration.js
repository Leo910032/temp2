// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/hooks/useAIGeneration.js
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';

export function useAIGeneration() {
    const [backgroundJobId, setBackgroundJobId] = useState(null);
    const [showJobProgress, setShowJobProgress] = useState(false);

    const handleJobComplete = useCallback(async (result) => {
        setShowJobProgress(false);
        setBackgroundJobId(null);
        
        if (result && result.groups && result.groups.length > 0) {
            toast.success(
                `AI generated ${result.groups.length} potential groups! Click "View Generated Groups" to review them.`,
                { duration: 8000 }
            );
            return result.groups;
        } else {
            toast.success('AI grouping completed but found no suitable groups for your contacts.');
            return [];
        }
    }, []);

    const handleJobError = useCallback((error) => {
        setShowJobProgress(false);
        setBackgroundJobId(null);
        console.error("Background AI job failed:", error);
        toast.error(`AI grouping failed: ${error.message}`);
    }, []);

    const startAIGeneration = useCallback(async (onGroupAction, aiOptions) => {
        try {
            console.log("Starting background AI group generation");
            
            const result = await onGroupAction('generateAsync', aiOptions);
            
            if (result.success && result.jobId) {
                setBackgroundJobId(result.jobId);
                setShowJobProgress(true);
                
                toast.success(
                    'AI group generation started! This will run in the background - you can continue using the app.',
                    { duration: 4000 }
                );
                
                return { success: true };
            } else {
                throw new Error('Failed to start background job');
            }
        } catch (error) {
            console.error("Failed to start AI group generation:", error);
            toast.error("Failed to start AI grouping. Please try again.");
            throw error;
        }
    }, []);

    const clearJob = useCallback(() => {
        setBackgroundJobId(null);
        setShowJobProgress(false);
    }, []);

    return {
        backgroundJobId,
        showJobProgress,
        handleJobComplete,
        handleJobError,
        setBackgroundJobId,
        setShowJobProgress,
        startAIGeneration,
        clearJob
    };
}