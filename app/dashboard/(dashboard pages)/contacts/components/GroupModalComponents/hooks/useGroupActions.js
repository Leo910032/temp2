// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/hooks/useGroupActions.js
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ErrorHandler } from '@/lib/services/serviceContact';

export function useGroupActions(onGroupAction, formState, updateFormState, resetCreateGroupForm) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCreateGroup = useCallback(async (e) => {
        e.preventDefault();
        if (!formState.newGroupName.trim() || formState.selectedContacts.length === 0) return;
        
        setIsSubmitting(true);
        try {
            const groupData = {
                name: formState.newGroupName.trim(),
                type: formState.newGroupType,
                description: formState.newGroupDescription.trim() || (formState.useTimeFrame 
                    ? `Time-based group with ${formState.selectedContacts.length} contacts`
                    : `Custom group with ${formState.selectedContacts.length} contacts`),
                contactIds: formState.selectedContacts
            };
            
            if (formState.useTimeFrame && formState.startDate && formState.endDate) {
                groupData.timeFrame = { 
                    startDate: formState.startDate, 
                    endDate: formState.endDate, 
                    preset: formState.timeFramePreset || 'custom' 
                };
            }

            if (formState.eventLocation) {
                groupData.eventLocation = {
                    placeId: formState.eventLocation.placeId,
                    name: formState.eventLocation.name,
                    address: formState.eventLocation.address,
                    lat: formState.eventLocation.lat,
                    lng: formState.eventLocation.lng
                };
            }
            
            await onGroupAction('create', groupData);
            resetCreateGroupForm();
            
        } catch (error) {
            console.error("Failed to create group:", error);
            toast.error("Could not create group. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }, [formState, onGroupAction, resetCreateGroupForm]);

    const handleDeleteGroup = useCallback(async (groupId) => {
        if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
            return;
        }
        
        try {
            await onGroupAction('delete', groupId);
        } catch (error) {
            console.error("Failed to delete group:", error);
            toast.error("Could not delete group. Please try again.");
        }
    }, [onGroupAction]);

    const handleEditGroup = useCallback(async (updatedGroup) => {
        try {
            await onGroupAction('update', updatedGroup);
            updateFormState({ editingGroup: null });
        } catch (error) {
            console.error("Failed to update group:", error);
            toast.error("Could not update group. Please try again.");
        }
    }, [onGroupAction, updateFormState]);

    const handleGenerateAIGroups = useCallback(async () => {
        try {
            console.log("Starting background AI group generation");
            
            const result = await onGroupAction('generateAsync', formState.aiOptions);
            
            if (result.success && result.jobId) {
                // Update background job state will be handled by the AI hook
                return { success: true, jobId: result.jobId };
            } else {
                throw new Error('Failed to start background job');
            }
        } catch (error) {
            console.error("Failed to start AI group generation:", error);
            toast.error("Failed to start AI grouping. Please try again.");
            throw error;
        }
    }, [onGroupAction, formState.aiOptions]);

    const handleSaveCachedGroups = useCallback(async () => {
        if (formState.selectedCachedGroups.length === 0) {
            toast.error('Please select at least one group to save.');
            return;
        }

        setIsSubmitting(true);
        try {
            const promises = formState.selectedCachedGroups.map(async (group, index) => {
                try {
                    console.log(`Creating group ${index + 1}/${formState.selectedCachedGroups.length}:`, group);
                    
                    const sanitizedGroup = {
                        name: group.name || `AI Group ${index + 1}`,
                        description: group.description || `AI-generated group with ${group.contactIds?.length || 0} contacts`,
                        contactIds: group.contactIds || [],
                        type: group.type || 'ai_generated',
                        metadata: {
                            ...group.metadata,
                            aiGenerated: true,
                            createdAt: new Date().toISOString()
                        }
                    };

                    const result = await onGroupAction('create', sanitizedGroup);
                    return { success: true, group: sanitizedGroup, result };
                } catch (error) {
                    console.error(`Failed to create group "${group.name}":`, error);
                    return { success: false, group, error: error.message };
                }
            });
            
            const results = await Promise.all(promises);
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            if (successful.length > 0) {
                toast.success(`Successfully created ${successful.length} group${successful.length !== 1 ? 's' : ''}!`);
            }

            if (failed.length > 0) {
                console.error('Failed groups:', failed);
                toast.error(`Failed to create ${failed.length} group${failed.length !== 1 ? 's' : ''}. Check console for details.`);
            }
            
            if (successful.length > 0) {
                updateFormState({
                    cachedGroups: [],
                    selectedCachedGroups: []
                });
            }
            
        } catch (error) {
            console.error("Failed to save cached groups:", error);
            toast.error("Failed to save groups. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }, [formState.selectedCachedGroups, onGroupAction, updateFormState]);

    const handleSelectCachedGroup = useCallback((group) => {
        updateFormState({
            selectedCachedGroups: [...formState.selectedCachedGroups, group],
            cachedGroups: formState.cachedGroups.filter(g => g.id !== group.id)
        });
    }, [formState, updateFormState]);

    const handleDeselectGroup = useCallback((group) => {
        updateFormState({
            cachedGroups: [...formState.cachedGroups, group],
            selectedCachedGroups: formState.selectedCachedGroups.filter(g => g.id !== group.id)
        });
    }, [formState, updateFormState]);

    const handleEditCachedGroup = useCallback((group) => {
        updateFormState({ editingGroup: group });
    }, [updateFormState]);

    return {
        handleCreateGroup,
        handleDeleteGroup,
        handleEditGroup,
        handleGenerateAIGroups,
        handleSaveCachedGroups,
        handleSelectCachedGroup,
        handleDeselectGroup,
        handleEditCachedGroup,
        isSubmitting
    };
}