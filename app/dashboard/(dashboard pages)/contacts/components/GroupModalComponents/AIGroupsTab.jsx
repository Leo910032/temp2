// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/AIGroupsTab.jsx
"use client"

export default function AIGroupsTab({
    cachedGroups,
    selectedCachedGroups,
    contacts,
    updateFormState,
    onSaveCachedGroups,
    onTabChange,
    isSubmitting
}) {
    const handleSelectCachedGroup = (group) => {
        updateFormState({
            selectedCachedGroups: [...selectedCachedGroups, group],
            cachedGroups: cachedGroups.filter(g => g.id !== group.id)
        });
    };

    const handleDeselectGroup = (group) => {
        updateFormState({
            cachedGroups: [...cachedGroups, group],
            selectedCachedGroups: selectedCachedGroups.filter(g => g.id !== group.id)
        });
    };

    const handleEditCachedGroup = (group) => {
        updateFormState({ editingGroup: group });
    };

    const handleDiscardGroup = (groupId) => {
        updateFormState({
            cachedGroups: cachedGroups.filter(g => g.id !== groupId)
        });
    };

    const totalGroups = cachedGroups.length + selectedCachedGroups.length;

    if (totalGroups === 0) {
        return <EmptyAIGroupsState onTabChange={onTabChange} />;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Generated Groups (Left Side) */}
                <GeneratedGroupsSection
                    cachedGroups={cachedGroups}
                    onSelectGroup={handleSelectCachedGroup}
                    onEditGroup={handleEditCachedGroup}
                    onDiscardGroup={handleDiscardGroup}
                />

                {/* Selected Groups (Right Side) */}
                <SelectedGroupsSection
                    selectedCachedGroups={selectedCachedGroups}
                    onDeselectGroup={handleDeselectGroup}
                    onEditGroup={handleEditCachedGroup}
                    onSaveGroups={onSaveCachedGroups}
                    isSubmitting={isSubmitting}
                />
            </div>
        </div>
    );
}

function EmptyAIGroupsState({ onTabChange }) {
    return (
        <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Groups Generated Yet</h3>
            <p className="text-gray-500 mb-4">
                Use the AI Generator to create smart groups from your contacts
            </p>
            <button 
                onClick={() => onTabChange('ai-generate')} 
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
                Generate AI Groups
            </button>
        </div>
    );
}

function GeneratedGroupsSection({ cachedGroups, onSelectGroup, onEditGroup, onDiscardGroup }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Generated Groups</h3>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                    {cachedGroups.length} groups
                </span>
            </div>
            
            {cachedGroups.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">All groups have been reviewed!</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {cachedGroups.map(group => (
                        <AIGroupCard
                            key={group.id}
                            group={group}
                            type="generated"
                            onSelect={() => onSelectGroup(group)}
                            onEdit={() => onEditGroup(group)}
                            onDiscard={() => onDiscardGroup(group.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function SelectedGroupsSection({ selectedCachedGroups, onDeselectGroup, onEditGroup, onSaveGroups, isSubmitting }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Selected Groups</h3>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded-full">
                    {selectedCachedGroups.length} selected
                </span>
            </div>

            {selectedCachedGroups.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-gray-400 mb-2">👈</div>
                    <p className="text-gray-500">Select groups from the left to save them</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedCachedGroups.map(group => (
                        <AIGroupCard
                            key={group.id}
                            group={group}
                            type="selected"
                            onEdit={() => onEditGroup(group)}
                            onRemove={() => onDeselectGroup(group)}
                        />
                    ))}
                </div>
            )}

            {selectedCachedGroups.length > 0 && (
                <div className="sticky bottom-0 bg-white border-t pt-4">
                    <button 
                        onClick={onSaveGroups}
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Creating Groups...</span>
                            </>
                        ) : (
                            <>
                                <span className="text-lg">💾</span>
                                <span>Create {selectedCachedGroups.length} Group{selectedCachedGroups.length !== 1 ? 's' : ''}</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

function AIGroupCard({ group, type, onSelect, onEdit, onDiscard, onRemove }) {
    const isGenerated = type === 'generated';
    const baseStyles = isGenerated 
        ? "bg-white border border-gray-200" 
        : "bg-green-50 border border-green-200";

    return (
        <div className={`${baseStyles} rounded-lg p-4`}>
            <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{group.name}</h4>
                        {group.metadata?.aiGenerated && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                {group.metadata.feature?.replace('_', ' ')}
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    <div className="text-xs text-gray-500 mt-2">
                        {group.contactIds?.length || 0} contacts
                        {group.metadata?.confidence && (
                            <> • Confidence: {Math.round((group.metadata.confidence || 0.8) * 100)}%</>
                        )}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 mt-3">
                {isGenerated ? (
                    <GeneratedGroupActions 
                        onSelect={onSelect}
                        onEdit={onEdit}
                        onDiscard={onDiscard}
                    />
                ) : (
                    <SelectedGroupActions 
                        onEdit={onEdit}
                        onRemove={onRemove}
                    />
                )}
            </div>
        </div>
    );
}

function GeneratedGroupActions({ onSelect, onEdit, onDiscard }) {
    return (
        <>
            <button 
                onClick={onSelect}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
                Keep Group
            </button>
            <button 
                onClick={onEdit}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
                Edit
            </button>
            <button 
                onClick={onDiscard}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
                Discard
            </button>
        </>
    );
}

function SelectedGroupActions({ onEdit, onRemove }) {
    return (
        <>
            <button 
                onClick={onEdit}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
                Edit Group
            </button>
            <button 
                onClick={onRemove}
                className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
                Remove
            </button>
        </>
    );
}