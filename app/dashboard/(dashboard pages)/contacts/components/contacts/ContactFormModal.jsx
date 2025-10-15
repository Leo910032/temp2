// app/dashboard/(dashboard pages)/contacts/components/ContactFormModal.jsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';

// Field icon component
const FieldIcon = ({ label, category }) => {
    const l = label?.toLowerCase() || '';
    
    if (category) {
        const icons = {
            professional: '💼',
            social: '🌐',
            contact: '📞',
            personal: '👤',
            other: '📄'
        };
        return <span className="text-lg">{icons[category] || '📄'}</span>;
    }
    
    // Label-based fallback
    if (l.includes('name')) return <span>👤</span>;
    if (l.includes('email')) return <span>✉️</span>;
    if (l.includes('phone')) return <span>📞</span>;
    if (l.includes('company')) return <span>🏢</span>;
    if (l.includes('website')) return <span>🌐</span>;
    if (l.includes('job') || l.includes('title')) return <span>💼</span>;
    
    return <span>📄</span>;
};

/**
 * Unified modal for creating, editing, and reviewing contacts
 * Handles both standard editing and scanned contact review
 */
export default function ContactFormModal({ 
    isOpen, 
    onClose, 
    contact = null,           // For editing existing contact
    parsedFields = null,      // For reviewing scanned contact
    onSave,
    mode = 'edit'            // 'edit' | 'review' | 'create'
}) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        jobTitle: '',
        website: '',
        message: '',
        status: 'new',
        dynamicFields: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [fieldCategories, setFieldCategories] = useState({});

    // Determine modal title and context
    const modalTitle = useMemo(() => {
        if (mode === 'review') return t('contacts.review_contact') || 'Review Scanned Contact';
        if (mode === 'create') return t('contacts.create_contact') || 'Create Contact';
        return t('contacts.edit_contact') || 'Edit Contact';
    }, [mode, t]);

    // Initialize form data
    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'review' && parsedFields) {
            // Handle scanned contact review
            const processScannedFields = () => {
                let allFields = [];
                
                if (parsedFields.standardFields || parsedFields.dynamicFields) {
                    allFields = [
                        ...(parsedFields.standardFields || []),
                        ...(parsedFields.dynamicFields || [])
                    ];
                } else if (Array.isArray(parsedFields)) {
                    allFields = parsedFields;
                }

                // Extract standard fields
                const extracted = {
                    name: '',
                    email: '',
                    phone: '',
                    company: '',
                    jobTitle: '',
                    website: '',
                    message: '',
                    status: 'new',
                    dynamicFields: []
                };

                allFields.forEach((field, index) => {
                    const label = field.label?.toLowerCase() || '';
                    const value = field.value || '';
                    const fieldData = {
                        id: field.id || `field_${index}`,
                        label: field.label || '',
                        value,
                        category: field.category || inferCategory(field.label),
                        confidence: field.confidence || 0.5,
                        isDynamic: field.isDynamic || false
                    };

                    // Map to standard fields
                    if (label.includes('name') && !label.includes('company')) {
                        extracted.name = value;
                    } else if (label.includes('email')) {
                        extracted.email = value;
                    } else if (label.includes('phone') || label.includes('mobile')) {
                        extracted.phone = value;
                    } else if (label.includes('company') || label.includes('organization')) {
                        extracted.company = value;
                    } else if (label.includes('job') || label.includes('title')) {
                        extracted.jobTitle = value;
                    } else if (label.includes('website') || label.includes('url')) {
                        extracted.website = value;
                    } else {
                        // Everything else goes to dynamic fields
                        extracted.dynamicFields.push(fieldData);
                    }
                });

                setFormData(extracted);
                
                // Update category counts
                const categories = extracted.dynamicFields.reduce((acc, field) => {
                    const cat = field.category || 'other';
                    acc[cat] = (acc[cat] || 0) + 1;
                    return acc;
                }, {});
                setFieldCategories(categories);
            };

            processScannedFields();
        } else if (contact) {
            // Handle existing contact editing
            setFormData({
                name: contact.name || '',
                email: contact.email || '',
                phone: contact.phone || '',
                company: contact.company || '',
                jobTitle: contact.jobTitle || '',
                website: contact.website || '',
                message: contact.message || '',
                status: contact.status || 'new',
                dynamicFields: contact.dynamicFields || []
            });
        }
    }, [isOpen, contact, parsedFields, mode]);

    const inferCategory = (label) => {
        const l = label?.toLowerCase() || '';
        if (l.includes('linkedin') || l.includes('twitter') || l.includes('social')) return 'social';
        if (l.includes('experience') || l.includes('certification')) return 'professional';
        if (l.includes('language') || l.includes('hobby')) return 'personal';
        if (l.includes('email') || l.includes('phone')) return 'contact';
        return 'other';
    };

    const handleDynamicFieldChange = (index, key, value) => {
        const updated = [...formData.dynamicFields];
        updated[index] = { ...updated[index], [key]: value };
        setFormData(prev => ({ ...prev, dynamicFields: updated }));
        
        if (key === 'category') {
            const categories = updated.reduce((acc, field) => {
                const cat = field.category || 'other';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});
            setFieldCategories(categories);
        }
    };

    const addDynamicField = () => {
        const newField = {
            id: `manual_${Date.now()}`,
            label: '',
            value: '',
            category: 'other',
            isDynamic: true
        };
        setFormData(prev => ({
            ...prev,
            dynamicFields: [...prev.dynamicFields, newField]
        }));
    };

    const removeDynamicField = (index) => {
        const updated = formData.dynamicFields.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, dynamicFields: updated }));
        
        const categories = updated.reduce((acc, field) => {
            const cat = field.category || 'other';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {});
        setFieldCategories(categories);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!formData.name && !formData.email) {
            toast.error('Please provide at least a name or email');
            return;
        }

        setIsSubmitting(true);
        try {
            // Convert dynamicFields array to object format for storage
            const dynamicFieldsObject = {};
            formData.dynamicFields.forEach(field => {
                if (field.label && field.value) {
                    dynamicFieldsObject[field.label] = field.value;
                }
            });

            const dataToSave = {
                ...formData,
                dynamicFields: dynamicFieldsObject,
                lastModified: new Date().toISOString(),
                ...(contact && { id: contact.id })
            };

            await onSave(dataToSave);
            toast.success(mode === 'review' ? 'Contact saved!' : 'Contact updated!');
            onClose();
        } catch (error) {
            console.error('Error saving contact:', error);
            toast.error(error.message || 'Failed to save contact');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFilteredDynamicFields = () => {
        if (activeCategory === 'all') return formData.dynamicFields;
        return formData.dynamicFields.filter(f => f.category === activeCategory);
    };

    if (!isOpen) return null;

    const filteredDynamicFields = getFilteredDynamicFields();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-0 z-[10000] sm:items-center sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
                        {mode === 'review' && (
                            <p className="text-sm text-gray-500 mt-1">
                                {formData.dynamicFields.length} additional fields detected
                            </p>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Category Filters (if in review mode with dynamic fields) */}
                {mode === 'review' && formData.dynamicFields.length > 0 && (
                    <div className="px-4 sm:px-6 py-3 border-b bg-gray-50">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setActiveCategory('all')}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                    activeCategory === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                All ({formData.dynamicFields.length})
                            </button>
                            {Object.entries(fieldCategories).map(([category, count]) => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                        activeCategory === category
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {category.charAt(0).toUpperCase() + category.slice(1)} ({count})
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {/* Standard Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('contacts.name') || 'Name'} *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('contacts.email') || 'Email'} *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('contacts.phone') || 'Phone'}
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('contacts.company') || 'Company'}
                            </label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Job Title
                            </label>
                            <input
                                type="text"
                                value={formData.jobTitle}
                                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Website
                            </label>
                            <input
                                type="url"
                                value={formData.website}
                                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Status */}
                    {mode !== 'review' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('contacts.status') || 'Status'}
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isSubmitting}
                            >
                                <option value="new">New</option>
                                <option value="viewed">Viewed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    )}

                    {/* Dynamic Fields Section */}
                    {filteredDynamicFields.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                            <h3 className="text-md font-semibold text-gray-800 mb-3">
                                Additional Information
                            </h3>
                            <div className="space-y-3">
                                {filteredDynamicFields.map((field, filterIdx) => {
                                    const originalIdx = formData.dynamicFields.findIndex(f => f.id === field.id);
                                    return (
                                        <div key={field.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                                            {/* Icon */}
                                            <div className="flex-shrink-0 w-8 text-center mt-2">
                                                <FieldIcon label={field.label} category={field.category} />
                                            </div>
                                            
                                            {/* Fields */}
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Label (e.g., LinkedIn)"
                                                        value={field.label}
                                                        onChange={(e) => handleDynamicFieldChange(originalIdx, 'label', e.target.value)}
                                                        className="flex-1 px-3 py-1.5 border-b border-gray-300 focus:outline-none focus:border-blue-500 text-sm font-medium bg-transparent"
                                                        disabled={isSubmitting}
                                                    />
                                                    
                                                    {mode === 'review' && (
                                                        <>
                                                            <select
                                                                value={field.category}
                                                                onChange={(e) => handleDynamicFieldChange(originalIdx, 'category', e.target.value)}
                                                                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
                                                                disabled={isSubmitting}
                                                            >
                                                                <option value="personal">Personal</option>
                                                                <option value="professional">Professional</option>
                                                                <option value="contact">Contact</option>
                                                                <option value="social">Social</option>
                                                                <option value="other">Other</option>
                                                            </select>
                                                            
                                                            {field.confidence && field.confidence < 1.0 && (
                                                                <span className="text-xs text-gray-400">
                                                                    {Math.round(field.confidence * 100)}%
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                
                                                <input
                                                    type="text"
                                                    placeholder="Value"
                                                    value={field.value}
                                                    onChange={(e) => handleDynamicFieldChange(originalIdx, 'value', e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                            
                                            {/* Remove button */}
                                            <button
                                                type="button"
                                                onClick={() => removeDynamicField(originalIdx)}
                                                className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors mt-2"
                                                disabled={isSubmitting}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add Custom Field Button */}
                    <button
                        type="button"
                        onClick={addDynamicField}
                        className="w-full flex items-center justify-center gap-2 p-3 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border-2 border-dashed border-blue-200"
                        disabled={isSubmitting}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Custom Field
                    </button>

                    {/* Notes/Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {t('contacts.message') || 'Notes'}
                        </label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                            disabled={isSubmitting}
                            placeholder="Additional notes about this contact..."
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t bg-gray-50 sticky bottom-0">
                    {mode === 'review' && (
                        <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span>Standard: {6}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                <span>Additional: {formData.dynamicFields.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span>Filled: {Object.values(formData).filter(v => v && String(v).trim()).length}</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                            {isSubmitting && (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            )}
                            {isSubmitting 
                                ? 'Saving...' 
                                : mode === 'review' 
                                    ? 'Save Contact'
                                    : 'Save Changes'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}