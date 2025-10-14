// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/GroupManagerModal.jsx
"use client"

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { useContacts } from '../ContactsContext';
import { useDashboard } from '@/app/dashboard/DashboardContext';
import { CONTACT_FEATURES } from '@/lib/services/constants';
import { GroupService } from '@/lib/services/serviceContact/client/services/GroupService';
import { RulesGroupService } from '@/lib/services/serviceContact/client/services/RulesGroupService';

// Import tab components
import OverviewTab from './GroupModalComponents/OverviewTab.jsx';
import GroupsTab from './GroupModalComponents/GroupsTab';
import CreateGroupTab from './GroupModalComponents/CreateGroupTab';
// import AIGenerateTab from './GroupModalComponents/AIGenerateTab';
import RulesGenerateTab from './GroupModalComponents/rulesGenerate/RulesGenerateTab';
import RulesReviewTabEnhanced from './GroupModalComponents/rulesGenerate/RulesReviewTabEnhanced';
// import AIGroupsTab from './GroupModalComponents/AIGroupsTab';
// import GroupEditModal from './GroupModalComponents/GroupEditModal';
// import { BackgroundJobToast } from './BackgroundJobToast';
// import { useGroupActions } from './GroupModalComponents/hooks/useGroupActions';
// import { useFormState } from './GroupModalComponents/hooks/useFormState';
// import { useAIGeneration } from './GroupModalComponents/hooks/useAIGeneration';

function TabButton({ id, label, activeTab, setActiveTab, badge = null }) {
    const isActive = activeTab === id;

    return (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                isActive
                    ? 'border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
            }`}
        >
            {label}
            {badge !== null && (
                <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                    {badge}
                </span>
            )}
        </button>
    );
}

const GroupManagerModal = forwardRef(function GroupManagerModal({
    isOpen,
    onClose,
    onRefreshData,
    onRefreshUsage,
    onShowLocation
}, ref) {
    const { t } = useTranslation();

    // Get data from context (uses cached data)
    const {
        contacts,
        groups,
        usageInfo,
        usageLoading,
        hasFeature,
        isLoading
    } = useContacts();

    // Get subscription level from DashboardContext
    const { subscriptionLevel } = useDashboard();

    const [activeTab, setActiveTab] = useState('overview');

    // Form state for Create Group tab
    const [formState, setFormState] = useState({
        newGroupName: '',
        newGroupType: 'custom',
        newGroupDescription: '',
        selectedContacts: [],
        useTimeFrame: false,
        startDate: '',
        endDate: '',
        timeFramePreset: '',
        eventLocation: null,
        showCreateModal: false,
        rulesOptions: {}
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingRules, setIsGeneratingRules] = useState(false);
    const [generatedRulesGroups, setGeneratedRulesGroups] = useState(null);
    const [showRulesReview, setShowRulesReview] = useState(false);

    useImperativeHandle(ref, () => ({
        setActiveTab: (tabId) => {
            console.log(`[Modal] Parent component set active tab to: ${tabId}`);
            setActiveTab(tabId);
        }
    }));

    // Update form state helper
    const updateFormState = (updates) => {
        setFormState(prev => ({ ...prev, ...updates }));
    };

    // Handler functions for group actions
    const handleDeleteGroup = async (groupId) => {
        try {
            console.log('Deleting group:', groupId);

            // Call the GroupService to delete the group
            await GroupService.deleteGroup(groupId);

            console.log('✅ Group deleted successfully');

            // After successful deletion, refresh data
            if (onRefreshData) {
                await onRefreshData();
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert(`Failed to delete group: ${error.message || 'Unknown error'}`);
        }
    };

    const handleEditGroup = (group) => {
        // TODO: Implement edit group functionality
        console.log('Edit group:', group);
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const groupData = {
                name: formState.newGroupName,
                type: formState.newGroupType,
                description: formState.newGroupDescription,
                contactIds: formState.selectedContacts,
                useTimeFrame: formState.useTimeFrame,
                startDate: formState.startDate,
                endDate: formState.endDate,
                eventLocation: formState.eventLocation
            };

            console.log('Creating group with data:', groupData);

            // Call the GroupService to create the group
            await GroupService.createGroup({ groupData });

            console.log('✅ Group created successfully');

            // Reset form after successful creation
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
                showCreateModal: false,
                rulesOptions: {}
            });

            // Refresh data
            if (onRefreshData) {
                await onRefreshData();
            }

            // Switch to groups tab to see the new group
            setActiveTab('groups');
        } catch (error) {
            console.error('Error creating group:', error);
            // TODO: Show error toast/notification to user
            alert(`Failed to create group: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGenerateRulesGroups = async (rulesOptions) => {
        setIsGeneratingRules(true);

        try {
            console.log('[GroupManagerModal] Generating rules-based groups with options:', rulesOptions);

            // Call the RulesGroupService to generate groups
            const result = await RulesGroupService.generateRulesBasedGroups(rulesOptions);

            console.log('✅ Rules-based groups generated successfully:', result);

            // Store the generated groups and show review interface
            if (result.success && result.groups) {
                setGeneratedRulesGroups(result.groups);
                setShowRulesReview(true);
            } else {
                throw new Error(result.error || 'No groups were generated');
            }

            return result;
        } catch (error) {
            console.error('Error generating rules-based groups:', error);
            alert(`Failed to generate groups: ${error.message || 'Unknown error'}`);
            return { success: false, error: error.message };
        } finally {
            setIsGeneratingRules(false);
        }
    };

    const handleSaveReviewedGroups = async (reviewedGroups) => {
        setIsSubmitting(true);

        try {
            console.log('[GroupManagerModal] Saving reviewed groups:', reviewedGroups);

            // Save each group via the GroupService
            for (const group of reviewedGroups) {
                const groupData = {
                    name: group.name,
                    type: group.type || 'rules_custom',
                    description: group.description || `Generated via rules-based grouping`,
                    contactIds: group.contactIds
                };

                await GroupService.createGroup({ groupData });
            }

            console.log('✅ All groups saved successfully');

            // Reset review state
            setGeneratedRulesGroups(null);
            setShowRulesReview(false);

            // Refresh data to show the new groups
            if (onRefreshData) {
                await onRefreshData();
            }

            // Switch to groups tab to see the results
            setActiveTab('groups');

            alert(`Successfully saved ${reviewedGroups.length} group(s)!`);
        } catch (error) {
            console.error('Error saving reviewed groups:', error);
            alert(`Failed to save groups: ${error.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackFromReview = () => {
        setShowRulesReview(false);
        setGeneratedRulesGroups(null);
    };

    // Feature flags based on permissions
    const hasBasicGroups = hasFeature(CONTACT_FEATURES.BASIC_GROUPS);
    const hasAdvancedGroups = hasFeature(CONTACT_FEATURES.ADVANCED_GROUPS);
    const hasAIGroups = hasFeature(CONTACT_FEATURES.AI_GROUPS);
    const hasRulesBasedGroups = hasFeature(CONTACT_FEATURES.RULES_BASED_GROUPS);

    // Calculate group statistics
    const groupStats = {
        total: groups.length,
        custom: groups.filter(g => g.type === 'custom').length,
        auto: groups.filter(g => ['auto', 'company', 'auto_company'].includes(g.type)).length,
        ai: groups.filter(g => g.type?.startsWith('ai_')).length,
        rules: groups.filter(g => g.type?.startsWith('rules_')).length,
        event: groups.filter(g => g.type === 'event').length
    };

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setActiveTab('overview');
            // Reset form state
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
                showCreateModal: false,
                rulesOptions: {}
            });
            // Reset rules generation state
            setGeneratedRulesGroups(null);
            setShowRulesReview(false);
        }
    }, [isOpen]);

    // If modal is closed, don't render anything
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col"
                 style={{
                     marginTop: 'max(92px, calc(68px + env(safe-area-inset-top, 0px) + 24px))',
                     maxHeight: 'calc(100vh - 110px)'
                 }}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-900">Group Manager</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b flex-shrink-0 overflow-x-auto">
                    <TabButton
                        id="overview"
                        label="Overview"
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />

                    <TabButton
                        id="groups"
                        label="Groups"
                        badge={groups.length}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                    />

                    {hasBasicGroups && (
                        <TabButton
                            id="create"
                            label="Create Group"
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {hasRulesBasedGroups && (
                        <TabButton
                            id="rules-generate"
                            label="Rules Generator"
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                    )}

                    {/* {hasAIGroups && (
                        <>
                            <TabButton
                                id="ai-generate"
                                label="AI Generator"
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                            <TabButton
                                id="ai-create"
                                label="AI Groups"
                                badge={0}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                        </>
                    )} */}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            groupStats={groupStats}
                            onTabChange={setActiveTab}
                            groups={groups}
                            contacts={contacts}
                            hasFeature={hasFeature}
                            usageInfo={usageInfo}
                            usageLoading={usageLoading}
                            isLoading={isLoading}
                        />
                    )}

                    {activeTab === 'groups' && (
                        <GroupsTab
                            groups={groups}
                            contacts={contacts}
                            onDeleteGroup={handleDeleteGroup}
                            onEditGroup={handleEditGroup}
                            onTabChange={setActiveTab}
                            onShowLocation={onShowLocation}
                        />
                    )}

                    {activeTab === 'create' && (
                        <CreateGroupTab
                            contacts={contacts}
                            formState={formState}
                            updateFormState={updateFormState}
                            onCreateGroup={handleCreateGroup}
                            isSubmitting={isSubmitting}
                        />
                    )}

                    {activeTab === 'rules-generate' && (
                        <>
                            {showRulesReview && generatedRulesGroups ? (
                                <RulesReviewTabEnhanced
                                    generatedGroups={generatedRulesGroups}
                                    allContacts={contacts}
                                    onSaveGroups={handleSaveReviewedGroups}
                                    onBack={handleBackFromReview}
                                    isSaving={isSubmitting}
                                />
                            ) : (
                                <RulesGenerateTab
                                    contacts={contacts}
                                    formState={formState}
                                    updateFormState={updateFormState}
                                    subscriptionLevel={subscriptionLevel}
                                    onGenerateRulesGroups={handleGenerateRulesGroups}
                                    isGenerating={isGeneratingRules}
                                />
                            )}
                        </>
                    )}

                    {/* Add other tabs back progressively */}
                </div>
            </div>
        </div>
    );
});

export default GroupManagerModal;
