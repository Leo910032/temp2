// app/dashboard/(dashboard pages)/contacts/components/GroupManagerModal.jsx
"use client"
import { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import OptimizedEventLocationSearch from './OptimizedEventLocationSearch';

// Helper functions
function getGroupColor(groupId, groups) {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'];
    const index = groups.findIndex(g => g.id === groupId);
    return colors[index % colors.length] || '#6B7280';
}

function formatDateForInput(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function filterContactsByTimeFrame(contacts, startDate, endDate) {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    return contacts.filter(contact => {
        const contactDate = new Date(contact.submittedAt || contact.createdAt);
        return contactDate >= start && contactDate <= end;
    });
}

export default function GroupManagerModal({ 
    isOpen, 
    onClose, 
    groups, 
    contacts, 
    onGroupAction, 
    loading,
    hasFeature 
}) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('overview');
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupType, setNewGroupType] = useState('custom');
    const [newGroupDescription, setNewGroupDescription] = useState('');
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [useTimeFrame, setUseTimeFrame] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [timeFramePreset, setTimeFramePreset] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [eventLocation, setEventLocation] = useState(null);

    const groupStats = {
        total: groups.length,
        custom: groups.filter(g => g.type === 'custom').length,
        auto: groups.filter(g => ['auto', 'company', 'auto_company'].includes(g.type)).length,
        event: groups.filter(g => g.type === 'event').length
    };

    const handleTimeFramePreset = (preset) => {
        const now = new Date();
        let start, end;
        switch (preset) {
            case 'today': 
                start = new Date(now.setHours(0,0,0,0)); 
                end = new Date(now.setHours(23,59,59,999)); 
                break;
            case 'yesterday': 
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                start = new Date(yesterday.setHours(0,0,0,0)); 
                end = new Date(yesterday.setHours(23,59,59,999)); 
                break;
            case 'last7days': 
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); 
                end = new Date(); 
                break;
            case 'last24hours': 
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000); 
                end = new Date(); 
                break;
            case 'last8hours': 
                start = new Date(now.getTime() - 8 * 60 * 60 * 1000); 
                end = new Date(); 
                break;
            case 'last4hours': 
                start = new Date(now.getTime() - 4 * 60 * 60 * 1000); 
                end = new Date(); 
                break;
            default: return;
        }
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        setTimeFramePreset(preset);
    };

    useEffect(() => {
        if (useTimeFrame && startDate && endDate) {
            const timeFrameContacts = filterContactsByTimeFrame(contacts, startDate, endDate);
            setSelectedContacts(timeFrameContacts.map(c => c.id));
        }
    }, [useTimeFrame, startDate, endDate, contacts]);

   const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim() || selectedContacts.length === 0) return;
        
        setIsSubmitting(true);
        try {
            const groupData = {
                name: newGroupName.trim(),
                type: newGroupType,
                description: newGroupDescription.trim() || (useTimeFrame 
                    ? `Time-based group with ${selectedContacts.length} contacts`
                    : `Custom group with ${selectedContacts.length} contacts`),
                contactIds: selectedContacts
            };
            
            if (useTimeFrame && startDate && endDate) {
                groupData.timeFrame = { startDate, endDate, preset: timeFramePreset || 'custom' };
            }

            // +++ ADD THIS LOGIC TO INCLUDE EVENT LOCATION +++
            if (eventLocation) {
                // We only need specific fields, not the whole object
                groupData.eventLocation = {
                    placeId: eventLocation.placeId,
                    name: eventLocation.name,
                    address: eventLocation.address,
                    lat: eventLocation.lat,
                    lng: eventLocation.lng
                };
            }
            
            await onGroupAction('create', groupData);
            
            // Reset form on success (the rest of the resets are here already)
            setEventLocation(null); // +++ ADD THIS RESET
            setActiveTab('groups');
            
        } catch (error) {
            console.error("Failed to create group:", error);
            toast.error("Could not create group. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGroup = async (groupId) => {
        // A more modern approach than confirm() could be a custom modal, but this works
        if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
            return;
        }
        
        try {
            await onGroupAction('delete', groupId);
        } catch (error) {
            console.error("Failed to delete group:", error);
            toast.error("Could not delete group. Please try again.");
        }
    };

    const handleGenerateAutoGroups = async () => {
        try {
            await onGroupAction('generate', {
                groupByCompany: true,
                groupByTime: true,
                groupByLocation: hasFeature && hasFeature('ADVANCED_GROUPS'),
                groupByEvents: hasFeature && hasFeature('EVENT_DETECTION'),
                minGroupSize: 2,
                maxGroups: 10
            });
        } catch (error) {
            console.error("Failed to generate auto groups:", error);
            toast.error("Could not generate auto groups. Please try again.");
        }
    };
    
    // Reset internal state when the modal is closed/opened
    useEffect(() => {
        if (!isOpen) {
            setActiveTab('overview');
            setNewGroupName('');
            setNewGroupType('custom');
            setNewGroupDescription('');
            setSelectedContacts([]);
            setUseTimeFrame(false);
            setStartDate('');
            setEndDate('');
            setTimeFramePreset('');
                        setEventLocation(null);

        }
    }, [isOpen]);

    if (!isOpen) return null;

    const timeFrameContacts = useTimeFrame && startDate && endDate ? filterContactsByTimeFrame(contacts, startDate, endDate) : [];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col" style={{ marginTop: 'max(92px, calc(68px + env(safe-area-inset-top, 0px) + 24px))', maxHeight: 'calc(100vh - 110px)' }}>
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
                <div className="flex border-b flex-shrink-0">
                    <button 
                        onClick={() => setActiveTab('overview')} 
                        className={`px-4 py-2 text-sm font-medium ${activeTab === 'overview' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('groups')} 
                        className={`px-4 py-2 text-sm font-medium ${activeTab === 'groups' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Groups ({groups.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('create')} 
                        className={`px-4 py-2 text-sm font-medium ${activeTab === 'create' ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Create Group
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6 min-h-0">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        // ... JSX for overview tab is complete and correct ...
                        <div className="space-y-6">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                    <div className="text-2xl font-bold text-blue-600">{groupStats.total}</div>
                                    <div className="text-sm text-blue-800">Total Groups</div>
                                </div>
                                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                    <div className="text-2xl font-bold text-purple-600">{groupStats.custom}</div>
                                    <div className="text-sm text-purple-800">Custom Groups</div>
                                </div>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <div className="text-2xl font-bold text-green-600">{groupStats.auto}</div>
                                    <div className="text-sm text-green-800">Auto Groups</div>
                                </div>
                                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                    <div className="text-2xl font-bold text-orange-600">{groupStats.event}</div>
                                    <div className="text-sm text-orange-800">Event Groups</div>
                                </div>
                            </div>
                            {/* Quick Actions */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button onClick={handleGenerateAutoGroups} disabled={loading || isSubmitting} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                        {loading || isSubmitting ? (<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>) : (<span className="text-lg">🤖</span>)}
                                        <div className="text-left"><div className="font-medium text-gray-900">Generate Auto Groups</div><div className="text-sm text-gray-600">Group contacts by company, location, etc.</div></div>
                                    </button>
                                    <button onClick={() => setActiveTab('create')} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <span className="text-lg">➕</span>
                                        <div className="text-left"><div className="font-medium text-gray-900">Create Custom Group</div><div className="text-sm text-gray-600">Manually select contacts or use time frames</div></div>
                                    </button>
                                </div>
                            </div>
                            {/* Recent Groups */}
                            {groups.length > 0 && (<div><h4 className="font-medium text-gray-900 mb-3">Recent Groups</h4><div className="space-y-2">{groups.slice(0, 5).map(group => (<div key={group.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: getGroupColor(group.id, groups) }} /><div className="min-w-0"><div className="font-medium text-gray-900 truncate" title={group.name}>{group.name}</div><div className="text-sm text-gray-600">{group.contactIds?.length || 0} contact{(group.contactIds?.length || 0) !== 1 ? 's' : ''} • {group.type}{group.timeFrame && ' ⏰'}</div></div></div><button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>))}</div></div>)}
                        </div>
                    )}

                    {/* Groups Tab */}
                    {activeTab === 'groups' && (
                        // ... JSX for groups list tab is complete and correct ...
                        <div className="space-y-4">
                             {groups.length === 0 ? (<div className="text-center py-8"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></div><h3 className="text-lg font-medium text-gray-900 mb-2">No Groups Yet</h3><p className="text-gray-500 mb-4">Create your first group to organize your contacts</p><button onClick={() => setActiveTab('create')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Create First Group</button></div>) : (<div className="grid gap-4">{groups.map(group => (<div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4"><div className="flex items-start justify-between"><div className="flex items-center gap-3 flex-1"><div className="w-6 h-6 rounded-full border-2 border-white shadow flex-shrink-0" style={{ backgroundColor: getGroupColor(group.id, groups) }} /><div className="min-w-0 flex-1"><h4 className="font-medium text-gray-900">{group.name}</h4><p className="text-sm text-gray-600 mt-1">{group.description}</p><div className="flex items-center gap-4 mt-2 text-xs text-gray-500"><span>{group.contactIds?.length || 0} contact{(group.contactIds?.length || 0) !== 1 ? 's' : ''}</span><span>{group.type}</span>{group.timeFrame && (<span className="flex items-center gap-1">⏰ {new Date(group.timeFrame.startDate).toLocaleDateString()} - {new Date(group.timeFrame.endDate).toLocaleDateString()}</span>)}{group.createdAt && (<span>Created {new Date(group.createdAt).toLocaleDateString()}</span>)}</div></div></div><button onClick={() => handleDeleteGroup(group.id)} className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 flex-shrink-0 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>{group.contactIds && group.contactIds.length > 0 && (<div className="mt-3 pt-3 border-t border-gray-100"><div className="flex items-center gap-2 flex-wrap">{group.contactIds.slice(0, 5).map(contactId => { const contact = contacts.find(c => c.id === contactId); if (!contact) return null; return (<div key={contactId} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1"><div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">{contact.name.charAt(0).toUpperCase()}</div><span className="text-xs text-gray-700">{contact.name}</span></div>);})}{group.contactIds.length > 5 && (<span className="text-xs text-gray-500">+{group.contactIds.length - 5} more</span>)}</div></div>)}</div>))}</div>)}
                        </div>
                    )}

                    {/* Create Group Tab */}
                    {activeTab === 'create' && (
                        <form onSubmit={handleCreateGroup} className="space-y-6">
                            {/* ... Fields before manual selection are complete and correct ... */}
                            <div className="space-y-6">
                                <div><label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label><input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Enter group name..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" required disabled={isSubmitting} /></div>
                                <div><label className="block text-sm font-medium text-gray-700 mb-2">Group Type</label><select value={newGroupType} onChange={(e) => setNewGroupType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" disabled={isSubmitting}><option value="custom">👥 Custom Group</option><option value="company">🏢 Company/Organization</option><option value="event">📅 Event-based</option></select></div>
                               
                                <div><label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label><textarea value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder="Enter group description..." rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical" disabled={isSubmitting} /></div>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <label className="font-medium text-gray-900">📍 Event Location (Optional)</label>
                                </div>
                                <OptimizedEventLocationSearch
                                    onLocationSelect={setEventLocation}
                                    selectedLocation={eventLocation}
                                />
                            </div>
                                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200"><div className="flex items-center gap-2 mb-3"><input type="checkbox" id="useTimeFrame" checked={useTimeFrame} onChange={(e) => setUseTimeFrame(e.target.checked)} className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" disabled={isSubmitting} /><label htmlFor="useTimeFrame" className="font-medium text-gray-900">⏰ Auto-select contacts by time frame</label></div>{useTimeFrame && (<div className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-2">Quick Presets</label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{[{ id: 'last4hours', label: 'Last 4 Hours' }, { id: 'last8hours', label: 'Last 8 Hours' }, { id: 'last24hours', label: 'Last 24 Hours' }, { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: 'last7days', label: 'Last 7 Days' }].map(preset => (<button key={preset.id} type="button" onClick={() => handleTimeFramePreset(preset.id)} className={`px-3 py-2 text-sm rounded-lg border transition-colors ${timeFramePreset === preset.id ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`} disabled={isSubmitting}>{preset.label}</button>))}</div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label><input type="datetime-local" value={startDate} onChange={(e) => { setStartDate(e.target.value); setTimeFramePreset(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" disabled={isSubmitting} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label><input type="datetime-local" value={endDate} onChange={(e) => { setEndDate(e.target.value); setTimeFramePreset(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" disabled={isSubmitting} /></div></div>{startDate && endDate && (<div className="bg-white rounded-lg p-3 border border-gray-200"><div className="flex items-center gap-2 mb-2"><span className="text-sm font-medium text-gray-700">📋 Contacts in time frame: {timeFrameContacts.length}</span></div>{timeFrameContacts.length > 0 && (<div className="flex flex-wrap gap-1">{timeFrameContacts.slice(0, 10).map(contact => (<span key={contact.id} className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">{contact.name}</span>))}{timeFrameContacts.length > 10 && (<span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">+{timeFrameContacts.length - 10} more</span>)}</div>)}</div>)}</div>)}</div>
                            </div>
                            
                            {/* --- COMPLETED SECTION STARTS HERE --- */}
                            
                            {/* Manual Contact Selection */}
                            {!useTimeFrame && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select Contacts ({selectedContacts.length} selected)
                                    </label>
                                    <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
                                        {contacts.map(contact => (
                                            <label key={contact.id} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedContacts.includes(contact.id)} 
                                                    onChange={(e) => { 
                                                        e.target.checked 
                                                            ? setSelectedContacts(p => [...p, contact.id]) 
                                                            : setSelectedContacts(p => p.filter(id => id !== contact.id))
                                                    }} 
                                                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 mr-3" 
                                                    disabled={isSubmitting}
                                                />
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                                        {contact.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-gray-900 truncate">{contact.name}</div>
                                                        <div className="text-sm text-gray-600 truncate">{contact.email}</div>
                                                        {contact.company && (
                                                            <div className="text-xs text-gray-500 truncate">{contact.company}</div>
                                                        )}
                                                        <div className="text-xs text-gray-400">
                                                            Added {new Date(contact.submittedAt || contact.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Submission Feedback */}
                            {selectedContacts.length > 0 && (
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span className="font-medium text-green-800">Ready to create group with {selectedContacts.length} contact{selectedContacts.length !== 1 && 's'}</span>
                                    </div>
                                    {useTimeFrame && startDate && endDate && (
                                        <div className="text-sm text-green-700">
                                            Time frame: {new Date(startDate).toLocaleString()} - {new Date(endDate).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={!newGroupName.trim() || selectedContacts.length === 0 || isSubmitting} 
                                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        `Create Group (${selectedContacts.length})`
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}