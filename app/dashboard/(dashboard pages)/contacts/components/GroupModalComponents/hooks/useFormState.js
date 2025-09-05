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
            useSmartCompanyMatching: true,
            useIndustryDetection: true,
            useRelationshipDetection: true
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

    const resetFormState = useCallback(() => {
        setFormState({
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
                useSmartCompanyMatching: true,
                useIndustryDetection: true,
                useRelationshipDetection: true
            },
            cachedGroups: [],
            selectedCachedGroups: [],
            editingGroup: null
        });
    }, []);

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