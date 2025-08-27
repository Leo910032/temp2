// File: app/dashboard/(dashboard pages)/contacts/components/ContactReviewModal.jsx
"use client"
import { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';

// A small, reusable icon for different field types
const FieldIcon = ({ label }) => {
    const l = label.toLowerCase();
    if (l.includes('name')) return <span className="text-gray-400">👤</span>;
    if (l.includes('email')) return <span className="text-gray-400">✉️</span>;
    if (l.includes('phone')) return <span className="text-gray-400">📞</span>;
    if (l.includes('company')) return <span className="text-gray-400">🏢</span>;
    if (l.includes('website')) return <span className="text-gray-400">🌐</span>;
    if (l.includes('qr')) return <span className="text-gray-400">🔳</span>;
    if (l.includes('linkedin')) return <span className="text-gray-400">💼</span>;
    return <span className="text-gray-400">📄</span>;
};

export default function ContactReviewModal({ isOpen, onClose, parsedFields, onSave }) {
    const { t } = useTranslation();
    const [fields, setFields] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        // The API now sends an array called `parsedFields`
        if (parsedFields) {
            setFields(parsedFields);
        }
    }, [parsedFields]);

    // Handle changes in any input (label or value)
    const handleFieldChange = (index, key, value) => {
        const newFields = [...fields];
        newFields[index][key] = value;
        setFields(newFields);
    };

    // Add a new, empty field for the user to fill out
    const addNewField = () => {
        setFields([...fields, { label: '', value: '', type: 'custom' }]);
    };

    // Remove a field
    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        // Basic validation: ensure at least a name or email exists.
        const hasNameOrEmail = fields.some(f => 
            (f.label.toLowerCase().includes('name') || f.label.toLowerCase().includes('email')) && f.value.trim() !== ''
        );

        if (!hasNameOrEmail) {
            toast.error('Please ensure the contact has at least a Name or Email.');
            return;
        }

        setIsSaving(true);
        try {
            // We pass the entire fields array to the onSave function
            await onSave(fields);
            toast.success('Contact added successfully!');
            onClose();
        } catch (error) {
            console.error('Error saving contact:', error);
            toast.error('Failed to save contact.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">✏️ Review & Refine Contact</h3>
                    <button onClick={onClose} className="p-2 text-gray-400 rounded-lg hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                    {fields.map((field, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="flex-shrink-0 w-8 text-center"><FieldIcon label={field.label} /></div>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={field.label}
                                    onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                                    placeholder="Field Label (e.g., Mobile)"
                                    className="w-full px-2 py-1 border-b border-gray-200 focus:outline-none focus:border-blue-500 text-xs text-gray-600"
                                />
                                <input
                                    type="text"
                                    value={field.value}
                                    onChange={(e) => handleFieldChange(index, 'value', e.target.value)}
                                    placeholder="Field Value"
                                    className="w-full px-2 py-1 focus:outline-none font-medium"
                                />
                            </div>
                            <button onClick={() => removeField(index)} className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={addNewField}
                        className="w-full mt-2 flex items-center justify-center gap-2 p-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Add Another Field
                    </button>
                </div>

                <div className="flex gap-3 p-6 border-t mt-auto">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                        {isSaving ? 'Saving...' : '💾 Save Contact'}
                    </button>
                </div>
            </div>
        </div>
    );
}