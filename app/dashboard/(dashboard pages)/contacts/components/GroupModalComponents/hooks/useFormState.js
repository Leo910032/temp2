// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/hooks/useFormState.js
import { useState, useCallback } from 'react';

export function useFormState() {
    const [formState, setFormState] = useState({
        // Create Group Tab State
        newGroupName: '',
        newGroupType: 'custom',
        newGroupDescription: '',
        selectedContacts: [],
        useTimeFrame: false,
        startDate: '',
        endDate: '',
        timeFramePreset: '',
        eventLocation: null,
        
        // AI Generation State
        aiOptions: {
            groupByCompany: true,
            groupByTime: true,
            groupByLocation: false,
            groupByEvents: false,
            minGroupSize: 2,
            maxGroups: 10,
            // ✅ THE FIX IS HERE: Default these to false
            useSmartCompanyMatching: false,
            useIndustryDetection: false,
            useRelationshipDetection: false,
            useDeepAnalysis: false // Default deep analysis to false as well
        },
        
        // AI Groups State
        cachedGroups: [],
        selectedCachedGroups: [],
        editingGroup: null
    });

    const updateFormState = useCallback((updates) => {
        setFormState(prev => ({
            ...prev,
            ...updates
        }));
    }, []);

    const updateAIOptions = useCallback((updates) => {
        setFormState(prev => ({
            ...prev,
            aiOptions: {
                ...prev.aiOptions,
                ...updates
            }
        }));
    }, []);

    // Also fix the reset function to use the same correct defaults
    const resetFormState = useCallback(() => {
        updateFormState({ // Use updateFormState to avoid re-writing the whole object
            newGroupName: '',
            newGroupType: 'custom',
            newGroupDescription: '',
            selectedContacts: [],
            useTimeFrame: false,
            startDate: '',
            endDate: '',
            timeFramePreset: '',
            eventLocation: null,
            aiOptions: {
                groupByCompany: true,
                groupByTime: true,
                groupByLocation: false,
                groupByEvents: false,
                minGroupSize: 2,
                maxGroups: 10,
                // ✅ AND FIX IT HERE TOO
                useSmartCompanyMatching: false,
                useIndustryDetection: false,
                useRelationshipDetection: false,
                useDeepAnalysis: false
            },
            cachedGroups: [],
            selectedCachedGroups: [],
            editingGroup: null
        });
    }, [updateFormState]);

    const resetCreateGroupForm = useCallback(() => {
        updateFormState({
            newGroupName: '',
            newGroupType: 'custom',
            newGroupDescription: '',
            selectedContacts: [],
            useTimeFrame: false,
            startDate: '',
            endDate: '',
            timeFramePreset: '',
            eventLocation: null
        });
    }, [updateFormState]);

    return {
        formState,
        updateFormState,
        updateAIOptions,
        resetFormState,
        resetCreateGroupForm
    };
}