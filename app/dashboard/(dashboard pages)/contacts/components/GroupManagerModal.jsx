// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

//app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/GroupManagerModal.jsx
"use client"
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { BackgroundJobToast } from './BackgroundJobToast';
import { useGroupActions } from './GroupModalComponents/hooks//useGroupActions';
import { useFormState } from './GroupModalComponents/hooks/useFormState';
import { useAIGeneration } from './GroupModalComponents/hooks/useAIGeneration';

// Import tab components
import OverviewTab from './GroupModalComponents/OverviewTab';
import GroupsTab from './GroupModalComponents/GroupsTab';
import CreateGroupTab from './GroupModalComponents/CreateGroupTab';
import AIGenerateTab from './GroupModalComponents/AIGenerateTab';
import RulesGenerateTab from './GroupModalComponents/RulesGenerateTab'; // NEW
import AIGroupsTab from './GroupModalComponents/AIGroupsTab';
import GroupEditModal from './GroupModalComponents/GroupEditModal';
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
    groups, 
    contacts, 
    onGroupAction, 
    loading,
    hasFeature,
    subscriptionStatus,
    backgroundJobId: externalBackgroundJobId,
    showJobProgress: externalShowJobProgress,
    onBackgroundJobUpdate: externalOnBackgroundJobUpdate,
    usageInfo = null,
    usageLoading = false,
    onRefreshUsage = null
}, ref) { 
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview');
    const [isGeneratingRules, setIsGeneratingRules] = useState(false);
    
    useImperativeHandle(ref, () => ({
        setActiveTab: (tabId) => {
            console.log(`[Modal] Parent component set active tab to: ${tabId}`);
            setActiveTab(tabId);
        }
    }));
    // Extract subscription level
    const subscriptionLevel = subscriptionStatus?.subscriptionLevel || 'base';
    const isProOrHigher = ['pro', 'premium', 'business', 'enterprise'].includes(subscriptionLevel);
    const isPremiumOrHigher = ['premium', 'business', 'enterprise'].includes(subscriptionLevel);
    

    // Custom hooks for state management
    const { formState, updateFormState, resetFormState } = useFormState();
   const { 
        backgroundJobId: internalBackgroundJobId, 
        showJobProgress: internalShowJobProgress, 
        handleJobComplete, 
        handleJobError,
        setBackgroundJobId,
        setShowJobProgress 
    } = useAIGeneration();
    
    // FIXED: Use external job state if provided, otherwise use internal
     const backgroundJobId = externalBackgroundJobId || internalBackgroundJobId;
    const showJobProgress = externalShowJobProgress || internalShowJobProgress;
    
    const {
        handleCreateGroup,
        handleDeleteGroup,
        handleEditGroup,
        handleGenerateAIGroups,
        handleSaveCachedGroups,
        isSubmitting
    } = useGroupActions(onGroupAction, formState, updateFormState, resetFormState);
// NEW: Rules-based generation handler
    const handleGenerateRulesGroups = async (options) => {
        console.log('[Modal] Starting rules-based generation with options:', options);
        setIsGeneratingRules(true);
        
        try {
            const result = await onGroupAction('generateRules', options);
            console.log('[Modal] Rules generation completed:', result);
            
            if (result.success && result.groups?.length > 0) {
                // Immediate success - no background job needed
                toast.success(`Created ${result.groups.length} rules-based groups instantly!`, {
                    duration: 6000
                });
                
                // Force data reload to show new groups
                await onGroupAction('reload');
            } else {
                toast.success('Rules-based grouping completed but found no suitable groups.');
            }
            
            return result;
        } catch (error) {
            console.error('[Modal] Rules generation failed:', error);
            throw error;
        } finally {
            setIsGeneratingRules(false);
        }
    };
    // Calculate group statistics
    const groupStats = {
        total: groups.length,
        custom: groups.filter(g => g.type === 'custom').length,
        auto: groups.filter(g => ['auto', 'company', 'auto_company'].includes(g.type)).length,
        ai: groups.filter(g => g.type?.startsWith('ai_')).length,
        rules: groups.filter(g => g.type?.startsWith('rules_')).length,
        event: groups.filter(g => g.type === 'event').length
    };
   // ... inside GroupManagerModal.jsx ...
const handleJobCompleteWithNavigation = async (result) => {
        console.log('[Modal] Job completed, processing result:', result);
        
        try {
            const newGroups = result?.groups || [];
            
            if (newGroups.length > 0) {
                // Update the component's internal state immediately with the new groups
                updateFormState({
                    cachedGroups: newGroups,
                    selectedCachedGroups: []
                });
                
                // Force a complete data reload on the PARENT page
                console.log('[Modal] Forcing parent page data reload...');
                await onGroupAction('reload');
                
                // Update external job state if handler is provided
                if (externalOnBackgroundJobUpdate) {
                    externalOnBackgroundJobUpdate(null);
                }
            } else {
                if (externalOnBackgroundJobUpdate) {
                    externalOnBackgroundJobUpdate(null);
                }
            }
            
            return newGroups;

        } catch (error) {
            console.error('[Modal] Error handling job completion:', error);
            throw error;
        }
    };
// ... rest of the file
  // Proper error handler
   // Proper error handler
    const handleJobErrorWithNotification = (error) => {
        console.error('[Modal] Job error:', error);
        handleJobError(error);
        
        // Update external job state if handler is provided
        if (externalOnBackgroundJobUpdate) {
            externalOnBackgroundJobUpdate(null);
        }
    };

   
     // Enhanced view results handler with data reload
    const handleViewResults = async () => {
        console.log('[Modal] View results clicked, switching to AI groups tab');
        setActiveTab('ai-create');
    };
  // Enhanced AI generation handler (existing)
    const enhancedHandleGenerateAIGroups = async (options) => {
        try {
            console.log('[Modal] Starting AI group generation...');
            const result = await handleGenerateAIGroups(options);
            
            if (result.success && result.jobId) {
                // Update external job state if handler is provided
                if (externalOnBackgroundJobUpdate) {
                    externalOnBackgroundJobUpdate(result.jobId);
                } else {
                    // Use internal state
                    setBackgroundJobId(result.jobId);
                    setShowJobProgress(true);
                }
            }
            
            return result;
        } catch (error) {
            console.error('[Modal] Error generating AI groups:', error);
            throw error;
        }
    };

    // Reset state when modal closes
  useEffect(() => {
        if (!isOpen) {
            setActiveTab('overview');
            resetFormState();
            setIsGeneratingRules(false);
        }
    }, [isOpen, resetFormState]);

      useEffect(() => {
        if (externalBackgroundJobId !== undefined) {
            setBackgroundJobId(externalBackgroundJobId);
        }
        if (externalShowJobProgress !== undefined) {
            setShowJobProgress(externalShowJobProgress);
        }
    }, [externalBackgroundJobId, externalShowJobProgress, setBackgroundJobId, setShowJobProgress]);

    // Always render the background job toast, even when modal is closed
     const backgroundJobToast = showJobProgress && backgroundJobId ? (
        <BackgroundJobToast
            jobId={backgroundJobId}
            onComplete={handleJobCompleteWithNavigation}
            onError={handleJobErrorWithNotification}
            onViewResults={handleViewResults}
            title="Generating AI Groups"
            position="top-right"
        />
    ) : null;
    // If modal is closed, only render the background job toast
    if (!isOpen) {
        return backgroundJobToast;
    }

   
     return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col" 
                     style={{ 
                         marginTop: 'max(92px, calc(68px + env(safe-area-inset-top, 0px) + 24px))', 
                         maxHeight: 'calc(100vh - 110px)' 
                     }}>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">Enhanced Group Manager</h3>
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
                        <TabButton 
                            id="create"
                            label="Create Group"
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                        
                        {/* Rules-based Generation (Pro+) */}
                        {isProOrHigher && (
                            <TabButton 
                                id="rules-generate"
                                label="Rules Generator"
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                            />
                        )}
                        
                        {/* AI Generation (Premium+) */}
                        {isPremiumOrHigher && (
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
                                    badge={formState.cachedGroups.length + formState.selectedCachedGroups.length}
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                />
                            </>
                        )}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                groupStats={groupStats}
                                subscriptionLevel={subscriptionLevel}
                                onTabChange={setActiveTab}
                                groups={groups}
                                onDeleteGroup={handleDeleteGroup}
                                isPremiumOrHigher={isPremiumOrHigher}
                                isProOrHigher={isProOrHigher}
                            />
                        )}

                        {activeTab === 'groups' && (
                            <GroupsTab
                                groups={groups}
                                contacts={contacts}
                                onDeleteGroup={handleDeleteGroup}
                                onEditGroup={handleEditGroup}
                                onTabChange={setActiveTab}
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

                        {/* NEW: Rules-based Generation Tab */}
                        {activeTab === 'rules-generate' && isProOrHigher && (
                            <RulesGenerateTab
                                contacts={contacts}
                                formState={formState}
                                updateFormState={updateFormState}
                                subscriptionLevel={subscriptionLevel}
                                onGenerateRulesGroups={handleGenerateRulesGroups}
                                isGenerating={isGeneratingRules}
                            />
                        )}

                        {/* AI Generation Tab */}
                        {activeTab === 'ai-generate' && isPremiumOrHigher && (
                            <AIGenerateTab
                                contacts={contacts}
                                formState={formState}
                                updateFormState={updateFormState}
                                subscriptionLevel={subscriptionLevel}
                                backgroundJobId={backgroundJobId}
                                onGenerateAIGroups={enhancedHandleGenerateAIGroups}
                                onShowJobProgress={() => setShowJobProgress(true)}
                                usageInfo={usageInfo}
                                usageLoading={usageLoading}
                                onRefreshUsage={onRefreshUsage}
                            />
                        )}

                        {activeTab === 'ai-create' && isPremiumOrHigher && (
                            <AIGroupsTab
                                cachedGroups={formState.cachedGroups}
                                selectedCachedGroups={formState.selectedCachedGroups}
                                contacts={contacts}
                                updateFormState={updateFormState}
                                onSaveCachedGroups={handleSaveCachedGroups}
                                onTabChange={setActiveTab}
                                isSubmitting={isSubmitting}
                            />
                        )}
                    </div>
                </div>

                {/* Group Edit Modal */}
              {formState.editingGroup && (
                    <GroupEditModal
                        group={formState.editingGroup}
                        contacts={contacts}
                        onClose={() => updateFormState({ editingGroup: null })}
                        onSave={handleEditGroup}
                    />
                )}



                {/* Background Job Toast - Always render if there's an active job */}
                {backgroundJobToast}
            </div>
          </>
    );
// ✅ FIX #3: REMOVED THE EXTRA BRACE FROM HERE
});

// Tab Button Component

export default GroupManagerModal;
