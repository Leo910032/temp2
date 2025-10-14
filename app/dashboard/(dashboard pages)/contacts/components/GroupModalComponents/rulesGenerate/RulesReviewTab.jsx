// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/rulesGenerate/RulesReviewTab.jsx
// Review and edit rules-based generated groups before saving

"use client"
import { useState, useMemo } from 'react';

export default function RulesReviewTab({
    generatedGroups = [],
    allContacts = [],
    onSaveGroups,
    onBack,
    isSaving = false
}) {
    const [groups, setGroups] = useState(generatedGroups);
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [isAddingContacts, setIsAddingContacts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Get contact details by ID
    const getContactById = (contactId) => {
        return allContacts.find(c => c._id === contactId || c.id === contactId);
    };

    // Calculate statistics
    const stats = useMemo(() => {
        const totalGroups = groups.length;
        const totalContactsInGroups = new Set(groups.flatMap(g => g.contactIds)).size;
        const avgGroupSize = totalGroups > 0
            ? Math.round((totalContactsInGroups / totalGroups) * 10) / 10
            : 0;
        const groupSizes = groups.map(g => g.contactIds.length);
        const largestGroup = Math.max(...groupSizes, 0);
        const smallestGroup = totalGroups > 0 ? Math.min(...groupSizes) : 0;

        return {
            totalGroups,
            totalContactsInGroups,
            avgGroupSize,
            largestGroup,
            smallestGroup,
            coverage: allContacts.length > 0
                ? Math.round((totalContactsInGroups / allContacts.length) * 100)
                : 0
        };
    }, [groups, allContacts]);

    // Get contacts not in any group
    const ungroupedContacts = useMemo(() => {
        const groupedIds = new Set(groups.flatMap(g => g.contactIds));
        return allContacts.filter(c => !groupedIds.has(c._id || c.id));
    }, [groups, allContacts]);

    // Filter contacts for adding
    const filteredContactsToAdd = useMemo(() => {
        if (!selectedGroupId || !searchQuery) return ungroupedContacts;

        const query = searchQuery.toLowerCase();
        return ungroupedContacts.filter(c =>
            c.name?.toLowerCase().includes(query) ||
            c.email?.toLowerCase().includes(query) ||
            c.company?.toLowerCase().includes(query)
        );
    }, [ungroupedContacts, searchQuery, selectedGroupId]);

    // Handler functions
    const handleRenameGroup = (groupId, newName) => {
        setGroups(groups.map(g =>
            g.id === groupId ? { ...g, name: newName } : g
        ));
    };

    const handleDeleteGroup = (groupId) => {
        if (window.confirm('Are you sure you want to delete this group?')) {
            setGroups(groups.filter(g => g.id !== groupId));
            if (selectedGroupId === groupId) {
                setSelectedGroupId(null);
            }
        }
    };

    const handleRemoveContactFromGroup = (groupId, contactId) => {
        setGroups(groups.map(g =>
            g.id === groupId
                ? { ...g, contactIds: g.contactIds.filter(id => id !== contactId) }
                : g
        ).filter(g => g.contactIds.length > 0)); // Remove empty groups
    };

    const handleAddContactToGroup = (groupId, contactId) => {
        setGroups(groups.map(g =>
            g.id === groupId && !g.contactIds.includes(contactId)
                ? { ...g, contactIds: [...g.contactIds, contactId] }
                : g
        ));
    };

    const handleMergeGroups = (sourceGroupId, targetGroupId) => {
        const sourceGroup = groups.find(g => g.id === sourceGroupId);
        if (!sourceGroup) return;

        setGroups(groups.map(g => {
            if (g.id === targetGroupId) {
                // Merge contact IDs, avoiding duplicates
                const mergedContactIds = [...new Set([...g.contactIds, ...sourceGroup.contactIds])];
                return { ...g, contactIds: mergedContactIds };
            }
            return g;
        }).filter(g => g.id !== sourceGroupId)); // Remove source group

        if (selectedGroupId === sourceGroupId) {
            setSelectedGroupId(targetGroupId);
        }
    };

    const handleSave = async () => {
        // Validate groups before saving
        const validGroups = groups.filter(g => g.contactIds.length >= 2);

        if (validGroups.length === 0) {
            alert('No valid groups to save. Each group must have at least 2 contacts.');
            return;
        }

        if (validGroups.length < groups.length) {
            const proceed = window.confirm(
                `${groups.length - validGroups.length} group(s) have less than 2 contacts and will be excluded. Continue?`
            );
            if (!proceed) return;
        }

        await onSaveGroups(validGroups);
    };

    const selectedGroup = groups.find(g => g.id === selectedGroupId);

    if (groups.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Generated</h3>
                <p className="text-gray-600 mb-4">Go back and generate some groups first.</p>
                <button
                    onClick={onBack}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                    Back to Generate
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Stats */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Review Generated Groups</h3>
                        <p className="text-gray-600 text-sm">
                            Review, edit, and refine your groups before saving
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                        Back
                    </button>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-600">{stats.totalGroups}</div>
                        <div className="text-xs text-gray-600">Groups</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.totalContactsInGroups}</div>
                        <div className="text-xs text-gray-600">Contacts</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.avgGroupSize}</div>
                        <div className="text-xs text-gray-600">Avg Size</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-600">{stats.coverage}%</div>
                        <div className="text-xs text-gray-600">Coverage</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-indigo-600">{stats.largestGroup}</div>
                        <div className="text-xs text-gray-600">Largest</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-pink-600">{stats.smallestGroup}</div>
                        <div className="text-xs text-gray-600">Smallest</div>
                    </div>
                </div>

                {ungroupedContacts.length > 0 && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center text-sm text-yellow-800">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {ungroupedContacts.length} contact(s) not assigned to any group
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content: Groups List + Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Groups List */}
                <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 flex items-center justify-between">
                        <span>Groups ({groups.length})</span>
                        <span className="text-xs text-gray-500">Click to view details</span>
                    </h4>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {groups.map((group) => {
                            const isSelected = selectedGroupId === group.id;
                            return (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                        isSelected
                                            ? 'border-purple-500 bg-purple-50 shadow-md'
                                            : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={group.name}
                                                onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="font-medium text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:ring-0 w-full px-0"
                                            />
                                            <div className="text-sm text-gray-600 mt-1">
                                                {group.contactIds.length} contact(s) • {group.type?.replace('rules_', '') || 'custom'}
                                            </div>
                                            {group.description && (
                                                <div className="text-xs text-gray-500 mt-1">{group.description}</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteGroup(group.id);
                                            }}
                                            className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                            title="Delete group"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right: Group Details */}
                <div className="border rounded-lg p-4 bg-gray-50">
                    {selectedGroup ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium text-gray-900">Group Details</h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsAddingContacts(!isAddingContacts)}
                                        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        {isAddingContacts ? 'Done' : '+ Add Contacts'}
                                    </button>
                                </div>
                            </div>

                            {/* Add Contacts Interface */}
                            {isAddingContacts && (
                                <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Search contacts to add..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {filteredContactsToAdd.length > 0 ? (
                                            filteredContactsToAdd.map((contact) => (
                                                <div
                                                    key={contact._id || contact.id}
                                                    onClick={() => handleAddContactToGroup(selectedGroup.id, contact._id || contact.id)}
                                                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer text-sm"
                                                >
                                                    <div>
                                                        <div className="font-medium">{contact.name}</div>
                                                        <div className="text-xs text-gray-500">{contact.email}</div>
                                                    </div>
                                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-gray-500 text-center py-2">
                                                {ungroupedContacts.length === 0 ? 'All contacts are grouped' : 'No matches found'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Contacts in Group */}
                            <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                    Contacts ({selectedGroup.contactIds.length})
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 divide-y max-h-64 overflow-y-auto">
                                    {selectedGroup.contactIds.map((contactId) => {
                                        const contact = getContactById(contactId);
                                        if (!contact) return null;

                                        return (
                                            <div key={contactId} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 truncate">{contact.name}</div>
                                                    <div className="text-sm text-gray-600 truncate">{contact.email}</div>
                                                    {contact.company && (
                                                        <div className="text-xs text-gray-500">{contact.company}</div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveContactFromGroup(selectedGroup.id, contactId)}
                                                    className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                                    title="Remove from group"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Merge with Another Group */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="text-sm font-medium text-gray-700 mb-2">Merge with Another Group</div>
                                <select
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleMergeGroups(selectedGroup.id, e.target.value);
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    defaultValue=""
                                >
                                    <option value="">Select a group to merge into...</option>
                                    {groups
                                        .filter(g => g.id !== selectedGroup.id)
                                        .map(g => (
                                            <option key={g.id} value={g.id}>
                                                {g.name} ({g.contactIds.length} contacts)
                                            </option>
                                        ))
                                    }
                                </select>
                                <div className="text-xs text-gray-500 mt-1">
                                    This will merge contacts into the selected group and delete the current group
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p>Select a group to view and edit details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
                <button
                    onClick={onBack}
                    disabled={isSaving}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                    Back to Generate
                </button>

                <div className="flex gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || groups.length === 0}
                        className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Save {groups.length} Group(s)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
