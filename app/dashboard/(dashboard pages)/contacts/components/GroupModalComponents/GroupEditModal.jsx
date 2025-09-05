// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/GroupEditModal.jsx
"use client"
import { useState } from 'react';
import ContactSelector from './ContactSelector';

export default function GroupEditModal({ group, contacts, onClose, onSave }) {
    const [editFormData, setEditFormData] = useState({
        name: group.name || '',
        description: group.description || '',
        contactIds: group.contactIds || []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editFormData.name.trim()) return;

        setIsSubmitting(true);
        try {
            const updatedGroup = {
                ...group,
                ...editFormData,
                lastModified: new Date().toISOString()
            };
            await onSave(updatedGroup);
            onClose();
        } catch (error) {
            console.error('Error saving group edit:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateContactSelection = (contactIds) => {
        setEditFormData(prev => ({ ...prev, contactIds }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Edit Group</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        disabled={isSubmitting}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Group Name *</label>
                        <input 
                            type="text" 
                            value={editFormData.name} 
                            onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))} 
                            placeholder="Enter group name..." 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
                            required 
                            disabled={isSubmitting} 
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea 
                            value={editFormData.description} 
                            onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))} 
                            placeholder="Enter group description..." 
                            rows={3} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-vertical" 
                            disabled={isSubmitting} 
                        />
                    </div>

                    <ContactSelector
                        contacts={contacts}
                        selectedContacts={editFormData.contactIds}
                        onSelectionChange={updateContactSelection}
                        isSubmitting={isSubmitting}
                    />

                    <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
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
                            disabled={!editFormData.name.trim() || editFormData.contactIds.length === 0 || isSubmitting} 
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}