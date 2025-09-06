//UPDATED


// app/dashboard/(dashboard pages)/contacts/components/ContactsMap/ContactProfileModal.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';
import { updateContact } from '@/lib/services/serviceContact';

export default function ContactProfileModal({
    isOpen,
    onClose,
    contact,
    groups = [],
    onContactUpdate
}) {
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (contact) {
            setFormData({
                name: contact.name || '',
                email: contact.email || '',
                phone: contact.phone || '',
                company: contact.company || '',
                message: contact.message || '',
                status: contact.status || 'new'
            });
        }
    }, [contact]);

    const handleSave = async () => {
        if (!contact) return;

        setIsLoading(true);
        try {
            await updateContact(contact.id, {
                ...formData,
                lastModified: new Date().toISOString()
            });

            toast.success('Contact updated successfully');
            setIsEditing(false);
            
            if (onContactUpdate) {
                onContactUpdate();
            }
        } catch (error) {
            console.error('Error updating contact:', error);
            toast.error('Failed to update contact');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'viewed': return 'bg-green-100 text-green-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const contactGroups = groups.filter(group => 
        group.contactIds && group.contactIds.includes(contact?.id)
    );

    if (!isOpen || !contact) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {contact.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {contact.name || 'Unnamed Contact'}
                            </h2>
                            <p className="text-gray-500">
                                {contact.email || 'No email'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                disabled={contact.isSharedContact && !contact.canEdit}
                            >
                                Edit
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
                                            name: contact.name || '',
                                            email: contact.email || '',
                                            phone: contact.phone || '',
                                            company: contact.company || '',
                                            message: contact.message || '',
                                            status: contact.status || 'new'
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Status and Location */}
                    <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(contact.status)}`}>
                                {contact.status}
                            </span>
                            {contact.location?.latitude && (
                                <span className="text-green-600 text-sm flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    </svg>
                                    Has Location
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2">
                                Contact Information
                            </h3>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Name
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                ) : (
                                    <p className="text-gray-900">{contact.name || 'Not provided'}</p>
                                )}
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                {isEditing ? (
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-gray-900">{contact.email || 'Not provided'}</p>
                                        {contact.email && (
                                            <a
                                                href={`mailto:${contact.email}`}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Send email"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Phone
                                </label>
                                {isEditing ? (
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-gray-900">{contact.phone || 'Not provided'}</p>
                                        {contact.phone && (
                                            <a
                                                href={`tel:${contact.phone}`}
                                                className="text-green-600 hover:text-green-800"
                                                title="Call"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Company */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Company
                                </label>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.company}
                                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <p className="text-gray-900">{contact.company || 'Not provided'}</p>
                                )}
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2">
                                Additional Details
                            </h3>

                            {/* Status */}
                            {isEditing && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="new">New</option>
                                        <option value="viewed">Viewed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            )}

                            {/* Source */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Source
                                </label>
                                <p className="text-gray-900">
                                    {contact.source === 'business_card_scan' && 'Business Card Scan'}
                                    {contact.source === 'manual' && 'Manual Entry'}
                                    {contact.source === 'exchange_form' && 'Contact Exchange'}
                                    {contact.source === 'team_share' && 'Team Share'}
                                    {!contact.source && 'Unknown'}
                                </p>
                            </div>

                            {/* Date Added */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Date Added
                                </label>
                                <p className="text-gray-900">{formatDate(contact.submittedAt)}</p>
                            </div>

                            {/* Last Modified */}
                            {contact.lastModified && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Last Modified
                                    </label>
                                    <p className="text-gray-900">{formatDate(contact.lastModified)}</p>
                                </div>
                            )}

                            {/* Location Info */}
                            {contact.location?.latitude && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location
                                    </label>
                                    <div className="text-gray-900">
                                        <p>Lat: {contact.location.latitude.toFixed(6)}</p>
                                        <p>Lng: {contact.location.longitude.toFixed(6)}</p>
                                        {contact.location.accuracy && (
                                            <p className="text-sm text-gray-600">
                                                Accuracy: {contact.location.accuracy.toFixed(0)}m
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Message */}
                    {(contact.message || isEditing) && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Message/Notes
                            </label>
                            {isEditing ? (
                                <textarea
                                    value={formData.message}
                                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Add any notes or message..."
                                />
                            ) : contact.message ? (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-gray-700 italic">"{contact.message}"</p>
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* Contact Groups */}
                    {contactGroups.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-900 mb-3">Groups</h3>
                            <div className="flex flex-wrap gap-2">
                                {contactGroups.map((group) => (
                                    <span
                                        key={group.id}
                                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                    >
                                        {group.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Shared Contact Info */}
                    {contact.isSharedContact && contact.sharedBy && (
                        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Shared Contact
                            </h3>
                            <p className="text-purple-800">
                                Shared by: <strong>{contact.sharedBy.displayName || contact.sharedBy.username}</strong>
                            </p>
                            {contact.sharedAt && (
                                <p className="text-purple-700 text-sm">
                                    Shared on: {formatDate(contact.sharedAt)}
                                </p>
                            )}
                            {!contact.canEdit && (
                                <p className="text-purple-600 text-sm mt-2">
                                    You have view-only access to this contact
                                </p>
                            )}
                        </div>
                    )}

                    {/* Dynamic Details */}
                    {Array.isArray(contact.details) && contact.details.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-semibold text-gray-900 mb-3">Additional Details</h3>
                            <div className="space-y-2">
                                {contact.details.map((detail, index) => (
                                    <div key={index} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-sm font-medium text-gray-600">{detail.label}:</span>
                                        <span className="text-sm text-gray-900">{detail.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
                    <div className="flex gap-3">
                        {contact.email && (
                            <a
                                href={`mailto:${contact.email}`}
                                className="inline-flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Send Email
                            </a>
                        )}
                        {contact.phone && (
                            <a
                                href={`tel:${contact.phone}`}
                                className="inline-flex items-center gap-2 px-4 py-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                Call
                            </a>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}