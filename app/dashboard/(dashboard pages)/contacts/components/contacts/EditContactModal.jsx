// app/dashboard/(dashboard pages)/contacts/components/EditContactModal.jsx
"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";

export default function EditContactModal({ contact, isOpen, onClose, onSave }) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({ 
        name: '', email: '', phone: '', company: '', 
        jobTitle: '', website: '', message: '', status: 'new',
        dynamicFields: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (contact) {
            // Convert dynamicFields from object to array if needed
            let dynamicFieldsArray = [];
            if (contact.dynamicFields) {
                if (Array.isArray(contact.dynamicFields)) {
                    dynamicFieldsArray = contact.dynamicFields;
                } else if (typeof contact.dynamicFields === 'object') {
                    // Convert object to array format: { "CompanyTagline": "value" } -> [{ label: "CompanyTagline", value: "value" }]
                    dynamicFieldsArray = Object.entries(contact.dynamicFields).map(([key, value], index) => ({
                        id: `field_${index}`,
                        label: key,
                        value: value,
                        category: 'other',
                        isDynamic: true
                    }));
                }
            }

            setFormData({
                name: contact.name || '',
                email: contact.email || '',
                phone: contact.phone || '',
                company: contact.company || '',
                jobTitle: contact.jobTitle || '',
                website: contact.website || '',
                message: contact.message || '',
                status: contact.status || 'new',
                dynamicFields: dynamicFieldsArray
            });
        }
    }, [contact]);
    
    const handleDynamicFieldChange = (index, key, value) => {
        const updatedFields = [...formData.dynamicFields];
        updatedFields[index] = { ...updatedFields[index], [key]: value };
        setFormData(prev => ({ ...prev, dynamicFields: updatedFields }));
    };

    const addDynamicField = () => {
        const newField = {
            id: `manual_${Date.now()}`,
            label: '',
            value: '',
            category: 'other',
            isDynamic: true
        };
        setFormData(prev => ({ ...prev, dynamicFields: [...prev.dynamicFields, newField] }));
    };

    const removeDynamicField = (index) => {
        const updatedFields = formData.dynamicFields.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, dynamicFields: updatedFields }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Convert dynamicFields array back to object format for storage
            const dynamicFieldsObject = {};
            formData.dynamicFields.forEach(field => {
                if (field.label && field.value) {
                    dynamicFieldsObject[field.label] = field.value;
                }
            });

            await onSave({
                ...contact,
                ...formData,
                dynamicFields: dynamicFieldsObject,
                lastModified: new Date().toISOString()
            });
            onClose();
        } catch (error) {
            console.error('Error updating contact:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-0 z-[10000] sm:items-center sm:p-4">
            <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-semibold text-gray-900">{t('contacts.edit_contact') || 'Edit Contact'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" disabled={isSubmitting}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
               <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Standard Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.name') || 'Name'} *</label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" required disabled={isSubmitting} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.email') || 'Email'} *</label>
                            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" required disabled={isSubmitting} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.phone') || 'Phone'}</label>
                            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.company') || 'Company'}</label>
                            <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                            <input type="text" value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                            <input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting} />
                        </div>
                    </div>
                    
                    {/* Dynamic Fields Section */}
                    {formData.dynamicFields.length > 0 && (
                        <div className="pt-4 mt-4 border-t">
                             <h3 className="text-md font-semibold text-gray-800 mb-3">Additional Information</h3>
                             <div className="space-y-3">
                                {formData.dynamicFields.map((field, index) => (
                                    <div key={field.id || index} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                                        <input
                                            type="text"
                                            placeholder="Label (e.g., LinkedIn)"
                                            value={field.label}
                                            onChange={(e) => handleDynamicFieldChange(index, 'label', e.target.value)}
                                            className="col-span-1 sm:col-span-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                        />
                                        <div className="col-span-1 sm:col-span-2 flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder="Value (e.g., https://...)"
                                                value={field.value}
                                                onChange={(e) => handleDynamicFieldChange(index, 'value', e.target.value)}
                                                className="flex-grow px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                            />
                                            <button type="button" onClick={() => removeDynamicField(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )}
                    <button type="button" onClick={addDynamicField} className="w-full mt-2 flex items-center justify-center gap-2 p-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Add Custom Field
                    </button>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.status') || 'Status'}</label>
                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base" disabled={isSubmitting}>
                            <option value="new">{t('contacts.status_new') || 'New'}</option>
                            <option value="viewed">{t('contacts.status_viewed') || 'Viewed'}</option>
                            <option value="archived">{t('contacts.status_archived') || 'Archived'}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('contacts.message') || 'Message'}</label>
                        <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical text-base" disabled={isSubmitting} />
                    </div>
                    <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-2">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-base font-medium" disabled={isSubmitting}>
                            {t('common.cancel') || 'Cancel'}
                        </button>
                        <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-medium" disabled={isSubmitting}>
                            {isSubmitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                            {isSubmitting ? (t('contacts.saving') || 'Saving...') : (t('contacts.save_changes') || 'Save Changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}