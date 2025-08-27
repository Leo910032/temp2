// components/ContactsMap/ContactProfileModal.jsx - Contact Profile Modal Component
import React, { useState, useEffect } from 'react';

export default function ContactProfileModal({ isOpen, onClose, contact, groups, onContactUpdate }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContact, setEditedContact] = useState(null);

    useEffect(() => {
        if (contact) {
            setEditedContact({ ...contact });
        }
    }, [contact]);

    if (!isOpen || !contact) return null;

    const contactGroups = groups.filter(group => 
        group.contactIds.includes(contact.id)
    );

    const handleSave = () => {
        if (onContactUpdate) {
            onContactUpdate(editedContact);
        }
        setIsEditing(false);
    };

    const handleStatusChange = (newStatus) => {
        const updatedContact = { ...editedContact, status: newStatus };
        setEditedContact(updatedContact);
        if (onContactUpdate) {
            onContactUpdate(updatedContact);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getInitials = (name) => {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                            {getInitials(contact.name)}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                            <p className="text-sm text-gray-600">{contact.company || 'No company'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Status */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                        <div className="flex gap-2">
                            {['new', 'viewed', 'archived'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        contact.status === status 
                                            ? getStatusColor(status)
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        {/* Email */}
                        {contact.email && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:text-blue-800 text-sm">
                                        {contact.email}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Phone */}
                        {contact.phone && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <a href={`tel:${contact.phone}`} className="text-blue-600 hover:text-blue-800 text-sm">
                                        {contact.phone}
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Location */}
                        {contact.location && contact.location.latitude && contact.location.longitude && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    <span className="text-sm text-gray-600">
                                        {contact.location.address || `${contact.location.latitude.toFixed(4)}, ${contact.location.longitude.toFixed(4)}`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Groups */}
                        {contactGroups.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Groups</label>
                                <div className="flex flex-wrap gap-2">
                                    {contactGroups.map((group) => (
                                        <span
                                            key={group.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            {group.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        {contact.notes && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <div className="bg-gray-50 rounded-lg p-3">
                                    <p className="text-sm text-gray-700">{contact.notes}</p>
                                </div>
                            </div>
                        )}

                        {/* Metadata */}
                        <div className="pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                                <div>
                                    <span className="font-medium">Added:</span>
                                    <br />
                                    {new Date(contact.createdAt || contact.submittedAt).toLocaleDateString()}
                                </div>
                                {contact.lastInteraction && (
                                    <div>
                                        <span className="font-medium">Last Contact:</span>
                                        <br />
                                        {new Date(contact.lastInteraction).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                    {contact.email && (
                        <button
                            onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                        </button>
                    )}
                    {contact.phone && (
                        <button
                            onClick={() => window.open(`tel:${contact.phone}`, '_blank')}
                            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Call
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}