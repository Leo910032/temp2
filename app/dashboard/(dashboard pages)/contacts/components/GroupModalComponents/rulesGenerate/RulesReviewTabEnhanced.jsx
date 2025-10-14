// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/rulesGenerate/RulesReviewTabEnhanced.jsx
// Enhanced review interface with bulk operations, smart suggestions, undo/redo, drag-drop, validation, and performance optimizations

"use client"
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import LocationSelector from '../creategroup/LocationSelector';

// Group color palette
const GROUP_COLORS = [
    { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100' },
    { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100' },
    { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', badge: 'bg-green-100' },
    { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', badge: 'bg-yellow-100' },
    { bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', badge: 'bg-pink-100' },
    { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', badge: 'bg-indigo-100' },
    { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', badge: 'bg-red-100' },
    { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-100' },
];

export default function RulesReviewTabEnhanced({
    generatedGroups = [],
    allContacts = [],
    onSaveGroups,
    onBack,
    isSaving = false
}) {
    // Main state with history for undo/redo
    const [groups, setGroups] = useState(() =>
        generatedGroups.map((g, idx) => ({
            ...g,
            color: GROUP_COLORS[idx % GROUP_COLORS.length]
        }))
    );
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // UI state
    const [selectedGroupId, setSelectedGroupId] = useState(null);
    const [selectedGroups, setSelectedGroups] = useState(new Set());
    const [isAddingContacts, setIsAddingContacts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [draggedContact, setDraggedContact] = useState(null);
    const [dragOverGroup, setDragOverGroup] = useState(null);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [sortBy, setSortBy] = useState('size'); // size, name, type
    const [filterType, setFilterType] = useState('all');
    const [groupLocations, setGroupLocations] = useState({}); // groupId -> location data

    // Save current state to history
    const saveToHistory = useCallback((newGroups) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            newHistory.push(JSON.parse(JSON.stringify(groups)));
            return newHistory.slice(-50); // Keep last 50 states
        });
        setHistoryIndex(prev => Math.min(prev + 1, 49));
        setGroups(newGroups);
    }, [groups, historyIndex]);

    // Undo/Redo
    const undo = useCallback(() => {
        if (historyIndex >= 0) {
            setGroups(JSON.parse(JSON.stringify(history[historyIndex])));
            setHistoryIndex(prev => prev - 1);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setGroups(JSON.parse(JSON.stringify(history[historyIndex + 1])));
        }
    }, [history, historyIndex]);

    // Initialize groupLocations from existing group data
    useEffect(() => {
        const initialLocations = {};
        generatedGroups.forEach(group => {
            if (group.eventLocation || group.metadata?.eventLocation) {
                initialLocations[group.id] = group.eventLocation || group.metadata.eventLocation;
            }
        });
        if (Object.keys(initialLocations).length > 0) {
            setGroupLocations(initialLocations);
        }
    }, [generatedGroups]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Get contact details by ID
    const getContactById = useCallback((contactId) => {
        return allContacts.find(c => c._id === contactId || c.id === contactId);
    }, [allContacts]);

    // Calculate similarity between two contacts
    const calculateContactSimilarity = useCallback((contact1, contact2) => {
        let score = 0;

        if (contact1.company && contact2.company &&
            contact1.company.toLowerCase() === contact2.company.toLowerCase()) {
            score += 50;
        }

        if (contact1.email && contact2.email) {
            const domain1 = contact1.email.split('@')[1];
            const domain2 = contact2.email.split('@')[1];
            if (domain1 === domain2) score += 30;
        }

        if (contact1.location && contact2.location &&
            contact1.location.latitude && contact2.location.latitude) {
            const distance = Math.sqrt(
                Math.pow(contact1.location.latitude - contact2.location.latitude, 2) +
                Math.pow(contact1.location.longitude - contact2.location.longitude, 2)
            );
            if (distance < 0.01) score += 20; // Very close
        }

        return score;
    }, []);

    // Calculate group similarity (for merge suggestions)
    const calculateGroupSimilarity = useCallback((group1, group2) => {
        const contacts1 = group1.contactIds.map(getContactById).filter(Boolean);
        const contacts2 = group2.contactIds.map(getContactById).filter(Boolean);

        let totalScore = 0;
        let count = 0;

        contacts1.forEach(c1 => {
            contacts2.forEach(c2 => {
                totalScore += calculateContactSimilarity(c1, c2);
                count++;
            });
        });

        return count > 0 ? totalScore / count : 0;
    }, [getContactById, calculateContactSimilarity]);

    // Get contacts not in any group (MUST BE BEFORE suggestions)
    const ungroupedContacts = useMemo(() => {
        const groupedIds = new Set(groups.flatMap(g => g.contactIds));
        return allContacts.filter(c => !groupedIds.has(c._id || c.id));
    }, [groups, allContacts]);

    // Smart suggestions
    const suggestions = useMemo(() => {
        const result = {
            merges: [],
            contactsToAdd: {},
            qualityIssues: [],
            duplicateNames: []
        };

        // Find groups that should be merged
        for (let i = 0; i < groups.length; i++) {
            for (let j = i + 1; j < groups.length; j++) {
                const similarity = calculateGroupSimilarity(groups[i], groups[j]);
                if (similarity > 40) {
                    result.merges.push({
                        group1: groups[i],
                        group2: groups[j],
                        similarity: Math.round(similarity),
                        reason: similarity > 60 ? 'High similarity' : 'Moderate similarity'
                    });
                }
            }
        }

        // Find contacts that might belong to groups
        const ungroupedIds = new Set(ungroupedContacts.map(c => c._id || c.id));
        groups.forEach(group => {
            const groupContacts = group.contactIds.map(getContactById).filter(Boolean);
            const suggestions = [];

            ungroupedContacts.forEach(contact => {
                let maxScore = 0;
                groupContacts.forEach(gc => {
                    const score = calculateContactSimilarity(contact, gc);
                    maxScore = Math.max(maxScore, score);
                });

                if (maxScore > 30) {
                    suggestions.push({
                        contact,
                        score: maxScore,
                        reason: maxScore > 50 ? 'Same company' : 'Similar attributes'
                    });
                }
            });

            if (suggestions.length > 0) {
                result.contactsToAdd[group.id] = suggestions
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 5);
            }
        });

        // Quality issues
        groups.forEach(group => {
            if (group.contactIds.length === 1) {
                result.qualityIssues.push({
                    group,
                    issue: 'Only 1 contact',
                    severity: 'high'
                });
            } else if (group.contactIds.length > 50) {
                result.qualityIssues.push({
                    group,
                    issue: 'Very large group',
                    severity: 'medium'
                });
            }
        });

        // Duplicate or similar names
        const nameMap = {};
        groups.forEach(group => {
            const lowerName = group.name.toLowerCase();
            if (!nameMap[lowerName]) {
                nameMap[lowerName] = [];
            }
            nameMap[lowerName].push(group);
        });

        Object.entries(nameMap).forEach(([name, groupList]) => {
            if (groupList.length > 1) {
                result.duplicateNames.push({
                    name,
                    groups: groupList,
                    severity: 'medium'
                });
            }
        });

        return result;
    }, [groups, calculateGroupSimilarity, calculateContactSimilarity, getContactById, ungroupedContacts]);

    // Filtered and sorted groups
    const filteredGroups = useMemo(() => {
        let filtered = groups;

        // Apply filter
        if (filterType !== 'all') {
            filtered = filtered.filter(g => g.type?.includes(filterType));
        }

        // Apply sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'size':
                    return b.contactIds.length - a.contactIds.length;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'type':
                    return (a.type || '').localeCompare(b.type || '');
                default:
                    return 0;
            }
        });

        return sorted;
    }, [groups, sortBy, filterType]);

    // Quality score calculation function (MUST BE BEFORE stats)
    const calculateQualityScore = useCallback((groups, totalContacts) => {
        let score = 100;

        // Penalize groups with only 1 contact
        const singleContactGroups = groups.filter(g => g.contactIds.length === 1).length;
        score -= singleContactGroups * 10;

        // Penalize low coverage
        const groupedCount = new Set(groups.flatMap(g => g.contactIds)).size;
        const coverage = totalContacts > 0 ? groupedCount / totalContacts : 0;
        if (coverage < 0.5) score -= 20;
        else if (coverage < 0.7) score -= 10;

        // Bonus for good distribution
        const sizes = groups.map(g => g.contactIds.length);
        const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
        const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
        if (variance < avgSize) score += 10; // Low variance is good

        return Math.max(0, Math.min(100, score));
    }, []);

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
                : 0,
            qualityScore: calculateQualityScore(groups, allContacts.length)
        };
    }, [groups, allContacts, calculateQualityScore]);

    // Handler functions
    const handleRenameGroup = useCallback((groupId, newName) => {
        const newGroups = groups.map(g =>
            g.id === groupId ? { ...g, name: newName } : g
        );
        saveToHistory(newGroups);
    }, [groups, saveToHistory]);

    const handleLocationSelect = useCallback((groupId, location) => {
        setGroupLocations(prev => ({
            ...prev,
            [groupId]: location
        }));

        // Update group metadata with location
        const newGroups = groups.map(g => {
            if (g.id === groupId) {
                return {
                    ...g,
                    eventLocation: location,
                    metadata: {
                        ...g.metadata,
                        eventLocation: location
                    }
                };
            }
            return g;
        });
        saveToHistory(newGroups);
    }, [groups, saveToHistory]);

    const handleDeleteGroup = useCallback((groupId) => {
        if (window.confirm('Are you sure you want to delete this group?')) {
            const newGroups = groups.filter(g => g.id !== groupId);
            saveToHistory(newGroups);
            if (selectedGroupId === groupId) {
                setSelectedGroupId(null);
            }
            setSelectedGroups(prev => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
        }
    }, [groups, saveToHistory, selectedGroupId]);

    const handleRemoveContactFromGroup = useCallback((groupId, contactId) => {
        const newGroups = groups.map(g =>
            g.id === groupId
                ? { ...g, contactIds: g.contactIds.filter(id => id !== contactId) }
                : g
        ).filter(g => g.contactIds.length > 0);
        saveToHistory(newGroups);
    }, [groups, saveToHistory]);

    const handleAddContactToGroup = useCallback((groupId, contactId) => {
        const newGroups = groups.map(g =>
            g.id === groupId && !g.contactIds.includes(contactId)
                ? { ...g, contactIds: [...g.contactIds, contactId] }
                : g
        );
        saveToHistory(newGroups);
    }, [groups, saveToHistory]);

    const handleMergeGroups = useCallback((sourceGroupId, targetGroupId) => {
        const sourceGroup = groups.find(g => g.id === sourceGroupId);
        if (!sourceGroup) return;

        const newGroups = groups.map(g => {
            if (g.id === targetGroupId) {
                const mergedContactIds = [...new Set([...g.contactIds, ...sourceGroup.contactIds])];
                return { ...g, contactIds: mergedContactIds };
            }
            return g;
        }).filter(g => g.id !== sourceGroupId);

        saveToHistory(newGroups);

        if (selectedGroupId === sourceGroupId) {
            setSelectedGroupId(targetGroupId);
        }
    }, [groups, saveToHistory, selectedGroupId]);

    // Bulk operations
    const handleBulkDelete = useCallback(() => {
        if (selectedGroups.size === 0) return;
        if (!window.confirm(`Delete ${selectedGroups.size} selected group(s)?`)) return;

        const newGroups = groups.filter(g => !selectedGroups.has(g.id));
        saveToHistory(newGroups);
        setSelectedGroups(new Set());
        setSelectedGroupId(null);
    }, [groups, selectedGroups, saveToHistory]);

    const handleBulkMerge = useCallback(() => {
        if (selectedGroups.size < 2) {
            alert('Select at least 2 groups to merge');
            return;
        }

        const groupsToMerge = groups.filter(g => selectedGroups.has(g.id));
        const mergedContactIds = [...new Set(groupsToMerge.flatMap(g => g.contactIds))];

        const mergedGroup = {
            ...groupsToMerge[0],
            name: `Merged: ${groupsToMerge.map(g => g.name).join(' + ')}`,
            contactIds: mergedContactIds
        };

        const newGroups = [
            ...groups.filter(g => !selectedGroups.has(g.id)),
            mergedGroup
        ];

        saveToHistory(newGroups);
        setSelectedGroups(new Set([mergedGroup.id]));
        setSelectedGroupId(mergedGroup.id);
    }, [groups, selectedGroups, saveToHistory]);

    const handleBulkRename = useCallback(() => {
        if (selectedGroups.size === 0) return;

        const prefix = prompt('Enter prefix for selected groups:');
        if (!prefix) return;

        const newGroups = groups.map((g, idx) => {
            if (selectedGroups.has(g.id)) {
                const number = Array.from(selectedGroups).indexOf(g.id) + 1;
                return { ...g, name: `${prefix} ${number}` };
            }
            return g;
        });

        saveToHistory(newGroups);
    }, [groups, selectedGroups, saveToHistory]);

    const toggleGroupSelection = useCallback((groupId) => {
        setSelectedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }, []);

    const selectAllGroups = useCallback(() => {
        setSelectedGroups(new Set(groups.map(g => g.id)));
    }, [groups]);

    const deselectAllGroups = useCallback(() => {
        setSelectedGroups(new Set());
    }, []);

    // Drag and drop handlers
    const handleDragStart = useCallback((e, contactId, sourceGroupId) => {
        setDraggedContact({ contactId, sourceGroupId });
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = useCallback((e, targetGroupId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverGroup(targetGroupId);
    }, []);

    const handleDragLeave = useCallback(() => {
        setDragOverGroup(null);
    }, []);

    const handleDrop = useCallback((e, targetGroupId) => {
        e.preventDefault();
        setDragOverGroup(null);

        if (!draggedContact) return;

        const { contactId, sourceGroupId } = draggedContact;

        if (sourceGroupId === targetGroupId) return;

        const newGroups = groups.map(g => {
            if (g.id === sourceGroupId) {
                return { ...g, contactIds: g.contactIds.filter(id => id !== contactId) };
            }
            if (g.id === targetGroupId && !g.contactIds.includes(contactId)) {
                return { ...g, contactIds: [...g.contactIds, contactId] };
            }
            return g;
        }).filter(g => g.contactIds.length > 0);

        saveToHistory(newGroups);
        setDraggedContact(null);
    }, [draggedContact, groups, saveToHistory]);

    // Apply smart suggestion
    const applySuggestion = useCallback((suggestionType, data) => {
        if (suggestionType === 'merge') {
            handleMergeGroups(data.group1.id, data.group2.id);
        } else if (suggestionType === 'addContact') {
            handleAddContactToGroup(data.groupId, data.contactId);
        }
    }, [handleMergeGroups, handleAddContactToGroup]);

    const handleSave = async () => {
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

    const getQualityColor = (score) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

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
                    <div className="flex gap-2">
                        <button
                            onClick={undo}
                            disabled={historyIndex < 0}
                            className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Undo (Ctrl+Z)"
                        >
                            ↶ Undo
                        </button>
                        <button
                            onClick={redo}
                            disabled={historyIndex >= history.length - 1}
                            className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Redo (Ctrl+Y)"
                        >
                            ↷ Redo
                        </button>
                        <button
                            onClick={onBack}
                            className="px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
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
                    <div className="bg-white rounded-lg p-3 text-center">
                        <div className={`text-2xl font-bold ${getQualityColor(stats.qualityScore)}`}>
                            {stats.qualityScore}
                        </div>
                        <div className="text-xs text-gray-600">Quality</div>
                    </div>
                </div>

                {/* Warnings & Info */}
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

            {/* Smart Suggestions */}
            {showSuggestions && (suggestions.merges.length > 0 || Object.keys(suggestions.contactsToAdd).length > 0 || suggestions.qualityIssues.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-blue-900 flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                            </svg>
                            Smart Suggestions
                        </h4>
                        <button
                            onClick={() => setShowSuggestions(false)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                        >
                            Hide
                        </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                        {/* Merge suggestions */}
                        {suggestions.merges.slice(0, 3).map((merge, idx) => (
                            <div key={idx} className="bg-white rounded p-3 flex items-center justify-between text-sm">
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                        Merge "{merge.group1.name}" + "{merge.group2.name}"
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {merge.reason} ({merge.similarity}% similar)
                                    </div>
                                </div>
                                <button
                                    onClick={() => applySuggestion('merge', merge)}
                                    className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                >
                                    Apply
                                </button>
                            </div>
                        ))}

                        {/* Quality issues */}
                        {suggestions.qualityIssues.slice(0, 3).map((issue, idx) => (
                            <div key={`issue-${idx}`} className="bg-white rounded p-3 flex items-center justify-between text-sm">
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                        "{issue.group.name}": {issue.issue}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {issue.severity === 'high' ? '⚠️ High priority' : '⚡ Medium priority'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedGroupId(issue.group.id)}
                                    className="ml-2 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                >
                                    Review
                                </button>
                            </div>
                        ))}

                        {/* Duplicate names */}
                        {suggestions.duplicateNames.slice(0, 2).map((dup, idx) => (
                            <div key={`dup-${idx}`} className="bg-white rounded p-3 flex items-center justify-between text-sm">
                                <div className="flex-1">
                                    <div className="font-medium text-gray-900">
                                        Duplicate group names: "{dup.name}"
                                    </div>
                                    <div className="text-xs text-gray-600">
                                        {dup.groups.length} groups with similar names
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedGroups(new Set(dup.groups.map(g => g.id)))}
                                    className="ml-2 px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                >
                                    Select All
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bulk Operations Bar */}
            {selectedGroups.size > 0 && (
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="font-medium text-purple-900">
                                {selectedGroups.size} group(s) selected
                            </span>
                            <button
                                onClick={deselectAllGroups}
                                className="text-sm text-purple-600 hover:text-purple-800"
                            >
                                Deselect All
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleBulkMerge}
                                disabled={selectedGroups.size < 2}
                                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
                            >
                                Merge
                            </button>
                            <button
                                onClick={handleBulkRename}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                            >
                                Rename
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={selectAllGroups}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                        Select All
                    </button>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded"
                    >
                        <option value="size">Sort by Size</option>
                        <option value="name">Sort by Name</option>
                        <option value="type">Sort by Type</option>
                    </select>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded"
                    >
                        <option value="all">All Types</option>
                        <option value="company">Company</option>
                        <option value="time">Time-based</option>
                        <option value="location">Location</option>
                        <option value="event">Event</option>
                    </select>
                </div>
                <div className="text-sm text-gray-600">
                    Showing {filteredGroups.length} of {groups.length} groups
                </div>
            </div>

            {/* Main Content: Groups List + Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Groups List */}
                <div className="space-y-3">
                    <h4 className="font-medium text-gray-900 flex items-center justify-between">
                        <span>Groups ({filteredGroups.length})</span>
                        <span className="text-xs text-gray-500">Click to view • Drag contacts to move</span>
                    </h4>

                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                        {filteredGroups.map((group) => {
                            const isSelected = selectedGroupId === group.id;
                            const isChecked = selectedGroups.has(group.id);
                            const isDragTarget = dragOverGroup === group.id;
                            const groupSuggestions = suggestions.contactsToAdd[group.id] || [];
                            const hasIssues = suggestions.qualityIssues.some(i => i.group.id === group.id);

                            return (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroupId(group.id)}
                                    onDragOver={(e) => handleDragOver(e, group.id)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, group.id)}
                                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                        isDragTarget
                                            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                                            : isSelected
                                            ? `${group.color.border} ${group.color.bg} shadow-md`
                                            : `border-gray-200 hover:border-purple-300 hover:bg-gray-50`
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleGroupSelection(group.id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="mt-1 rounded border-gray-300"
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <input
                                                    type="text"
                                                    value={group.name}
                                                    onChange={(e) => handleRenameGroup(group.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="font-medium text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-purple-500 focus:ring-0 w-full px-0"
                                                />
                                                {hasIssues && (
                                                    <span className="text-red-500 text-xs" title="Has quality issues">⚠️</span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <span className={`px-2 py-0.5 ${group.color.badge} ${group.color.text} text-xs rounded-full`}>
                                                    {group.contactIds.length} contacts
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {group.type?.replace('rules_', '') || 'custom'}
                                                </span>
                                            </div>

                                            {groupSuggestions.length > 0 && (
                                                <div className="mt-2 text-xs text-blue-600">
                                                    💡 {groupSuggestions.length} suggested contact(s)
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteGroup(group.id);
                                            }}
                                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
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

                                    {/* Suggested contacts first */}
                                    {suggestions.contactsToAdd[selectedGroup.id]?.length > 0 && (
                                        <div className="mb-2">
                                            <div className="text-xs font-medium text-blue-600 mb-1">Suggested:</div>
                                            {suggestions.contactsToAdd[selectedGroup.id].map(({ contact, reason }) => (
                                                <div
                                                    key={contact._id || contact.id}
                                                    onClick={() => handleAddContactToGroup(selectedGroup.id, contact._id || contact.id)}
                                                    className="flex items-center justify-between p-2 hover:bg-blue-50 rounded cursor-pointer text-sm border-l-2 border-blue-400 mb-1"
                                                >
                                                    <div>
                                                        <div className="font-medium">{contact.name}</div>
                                                        <div className="text-xs text-gray-500">{contact.email} • {reason}</div>
                                                    </div>
                                                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {ungroupedContacts
                                            .filter(c => {
                                                if (!searchQuery) return true;
                                                const query = searchQuery.toLowerCase();
                                                return c.name?.toLowerCase().includes(query) ||
                                                       c.email?.toLowerCase().includes(query) ||
                                                       c.company?.toLowerCase().includes(query);
                                            })
                                            .map((contact) => (
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
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Location Selector - Add venue/location to group */}
                            <div>
                                <LocationSelector
                                    eventLocation={groupLocations[selectedGroup.id] || selectedGroup.eventLocation || null}
                                    onLocationSelect={(location) => handleLocationSelect(selectedGroup.id, location)}
                                />
                            </div>

                            {/* Contacts in Group */}
                            <div>
                                <div className="text-sm font-medium text-gray-700 mb-2">
                                    Contacts ({selectedGroup.contactIds.length})
                                    <span className="ml-2 text-xs text-gray-500">Drag to another group to move</span>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 divide-y max-h-64 overflow-y-auto">
                                    {selectedGroup.contactIds.map((contactId) => {
                                        const contact = getContactById(contactId);
                                        if (!contact) return null;

                                        return (
                                            <div
                                                key={contactId}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, contactId, selectedGroup.id)}
                                                className="p-3 flex items-center justify-between hover:bg-gray-50 cursor-move"
                                            >
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                    </svg>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 truncate">{contact.name}</div>
                                                        <div className="text-sm text-gray-600 truncate">{contact.email}</div>
                                                        {contact.company && (
                                                            <div className="text-xs text-gray-500">{contact.company}</div>
                                                        )}
                                                    </div>
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
