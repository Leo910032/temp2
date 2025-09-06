// components/ContactsMap/GroupCreationModal.jsx - Group Creation Modal Component
import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

export default function GroupCreationModal({ isOpen, onClose, selectedContacts, nearbyEvents, onCreateGroup }) {
    const { t } = useTranslation();
    const [groupName, setGroupName] = useState('');
    const [groupType, setGroupType] = useState('custom');
    const [selectedEvent, setSelectedEvent] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Auto-suggest group name based on common company or nearby events
            if (selectedContacts.length > 0) {
                const companies = selectedContacts
                    .map(c => c.company)
                    .filter(Boolean);
                
                const commonCompany = companies.find((company, index) => 
                    companies.indexOf(company) !== index
                );

                if (commonCompany) {
                    setGroupName(`${commonCompany} Team`);
                    setDescription(`Contacts from ${commonCompany}`);
                    setGroupType('company');
                } else if (nearbyEvents.length > 0) {
                    const event = nearbyEvents[0];
                    setGroupName(`${event.name} Contacts`);
                    setDescription(`Contacts met at ${event.name}`);
                    setGroupType('event');
                    setSelectedEvent(event.id);
                } else {
                    setGroupName(`Group ${new Date().toLocaleDateString()}`);
                }
            }
        } else {
            // Reset form
            setGroupName('');
            setGroupType('custom');
            setSelectedEvent('');
            setDescription('');
        }
    }, [isOpen, selectedContacts, nearbyEvents]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!groupName.trim() || selectedContacts.length === 0) return;

        const groupData = {
            id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: groupName.trim(),
            type: groupType,
            description: description.trim(),
            contactIds: selectedContacts.map(c => c.id),
            createdAt: new Date().toISOString(),
            eventData: selectedEvent && nearbyEvents.find(e => e.id === selectedEvent) || null
        };

        onCreateGroup(groupData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Create Contact Group</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Selected Contacts Preview */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selected Contacts ({selectedContacts.length})
                        </label>
                        <div className="max-h-24 overflow-y-auto bg-gray-50 rounded-lg p-2">
                            {selectedContacts.map(contact => (
                                <div key={contact.id} className="flex items-center gap-2 py-1">
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                        {contact.name.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm text-gray-700 truncate">
                                        {contact.name} - {contact.company || 'No company'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Group Type */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Type
                        </label>
                        <select
                            value={groupType}
                            onChange={(e) => setGroupType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="custom">Custom Group</option>
                            <option value="company">Company/Organization</option>
                            {nearbyEvents.length > 0 && (
                                <option value="event">Event-based</option>
                            )}
                        </select>
                    </div>

                    {/* Event Selection (if event type) */}
                    {groupType === 'event' && nearbyEvents.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Associated Event
                            </label>
                            <select
                                value={selectedEvent}
                                onChange={(e) => setSelectedEvent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Select an event...</option>
                                {nearbyEvents.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name} - {event.vicinity}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Group Name */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Group Name *
                        </label>
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!groupName.trim() || selectedContacts.length === 0}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Create Group
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}