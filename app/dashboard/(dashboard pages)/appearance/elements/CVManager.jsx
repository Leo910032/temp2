//app/dashboard/(dashboard pages)/appearance/elements/CVManager.jsx
/**
 * THIS FILE HAS BEEN REFRACTORED 
 */
"use client"

import React, { useState, useRef, useContext, useMemo } from 'react';
import { FaUpload, FaTrash, FaDownload, FaFileAlt, FaExclamationTriangle } from 'react-icons/fa';
import { FaPencil, FaToggleOn, FaToggleOff } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { AppearanceContext } from '../AppearanceContext';
import { AppearanceService } from '@/lib/services/serviceAppearance/client/appearanceService.js';
import { useTranslation } from '@/lib/translation/useTranslation';

/**
 * A reusable modal for confirming destructive actions.
 */
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999999999]">
            <div className="bg-white rounded-2xl p-6 m-4 max-w-sm w-full shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-full">
                        <FaExclamationTriangle className="text-red-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
                        <p className="text-sm text-gray-600 mt-2">{message}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}


/**
 * Manages the UI and logic for uploading, displaying, and removing a CV or other document.
 * This component is now a "dumb" component that gets its state and update logic from AppearanceContext.
 */
export default function CVManager() {
    const { t, isInitialized } = useTranslation();

    // --- CONTEXT CONSUMPTION ---
    // Get all necessary data and functions from the centralized context.
    const { appearance, updateAppearance, isSaving } = useContext(AppearanceContext);

    // --- LOCAL UI STATE ---
    // This state is only for managing the UI of this component (e.g., loading spinners, modals).
    const [isUploading, setIsUploading] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const fileInputRef = useRef(null);

    // Derive the CV state from the context's appearance state.
    const cvEnabled = appearance?.cvEnabled || false;
    const cvDocument = appearance?.cvDocument;

    // Pre-compute translations for performance
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            title: t('dashboard.appearance.cv.title') || 'Curriculum / Documents',
            enabled: t('dashboard.appearance.cv.enabled') || 'Enabled',
            disabled: t('dashboard.appearance.cv.disabled') || 'Disabled',
            description: t('dashboard.appearance.cv.description') || 'Upload and manage your CV or resume document.',
        };
    }, [t, isInitialized]);

    // --- HANDLERS ---

    // Toggle CV enabled/disabled
    const handleToggleCV = () => {
        updateAppearance('cvEnabled', !cvEnabled);
        toast.success(cvEnabled ? 'CV disabled' : 'CV enabled');
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // File validation logic
        const allowedTypes = [
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload a PDF or Word document.');
            return;
        }
        if (file.size > maxSize) {
            toast.error('File is too large. Maximum size is 10MB.');
            return;
        }
        
        setIsUploading(true);
        try {
            // Call the centralized service to handle the upload.
            const result = await AppearanceService.uploadCVDocument(file);
            
            // The service returns the new data for the document.
            const defaultTitle = result.fileInfo.originalName.replace(/\.[^/.]+$/, "");
            
            // On success, call updateAppearance to notify the parent page.
            // This syncs the global state and triggers the auto-save.
            updateAppearance('cvDocument', {
                url: result.downloadURL,
                fileName: result.fileInfo.originalName,
                displayTitle: defaultTitle,
                uploadDate: new Date().toISOString(),
                fileSize: result.fileInfo.size,
                fileType: result.fileInfo.type
            });

            toast.success('CV uploaded successfully!');
        } catch (error) {
            console.error('CV upload error:', error);
            toast.error(error.message || 'Failed to upload CV');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmDelete = async () => {
        setShowDeleteModal(false);
        try {
            // Call the service to perform the deletion.
            await AppearanceService.removeCVDocument();

            // On success, update the global state to null.
            updateAppearance('cvDocument', null);
            toast.success('CV removed successfully!');
        } catch (error) {
            console.error('CV removal error:', error);
            toast.error(error.message || 'Failed to remove CV');
        }
    };

    // --- UI HELPER FUNCTIONS (no changes needed) ---

    const handleRemoveCV = () => setShowDeleteModal(true);
    
// lib/services/serviceAppearance/client/appearanceService.js
    const handleStartEditTitle = () => {
        // ✅ THE FIX: Use the 'displayTitle' variable directly.
        setTempTitle(displayTitle);
        setIsEditingTitle(true);
    };

    const handleSaveTitle = () => {
        if (tempTitle.trim() !== '') {
            updateAppearance('cvDocument', { ...cvDocument, displayTitle: tempTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        }
    };
    // --- UI HELPER FUNCTIONS ---

    const formatFileSize = (bytes) => {
        if (typeof bytes !== 'number' || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    const getFileExtension = (fileName) => {
        return fileName?.split('.').pop()?.toUpperCase() || '';
    };

    // Use a simple variable for the display title since it's derived from state
    const displayTitle = cvDocument?.displayTitle || cvDocument?.fileName?.replace(/\.[^/.]+$/, "") || "Document";
    const formattedFileSize = formatFileSize(cvDocument?.fileSize);
    const fileExtension = getFileExtension(cvDocument?.fileName);

    // Render a skeleton loader if the main appearance data hasn't loaded yet.
    if (!appearance || !isInitialized) {
        return <div className="w-full bg-gray-200 rounded-3xl my-3 p-6 h-36 animate-pulse"></div>;
    }

    return (
        <>
            <div className="w-full bg-white rounded-3xl my-3 p-6">
                {/* Header with enable/disable toggle */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{translations.title}</h3>
                        <button
                            onClick={handleToggleCV}
                            disabled={isSaving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                cvEnabled
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {cvEnabled ? <FaToggleOn className="text-xl" /> : <FaToggleOff className="text-xl" />}
                            <span className="text-sm font-medium">
                                {cvEnabled ? translations.enabled : translations.disabled}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-6">
                    {translations.description}
                </p>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                />

                {/* Only show document management if CV is enabled */}
                {cvEnabled && cvDocument ? (
                    <div className="mb-4 p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <FaFileAlt className="text-2xl text-gray-500" />
                            <div className="flex-1">
                                {isEditingTitle ? (
                                    <input
                                        type="text"
                                        value={tempTitle}
                                        onChange={(e) => setTempTitle(e.target.value)}
                                        onBlur={handleSaveTitle}
                                        onKeyPress={handleKeyPress}
                                        className="text-md font-medium text-gray-800 outline-none border-b-2 border-blue-500 bg-gray-50"
                                        autoFocus
                                    />
                                ) : (
<h4 className="text-md font-medium text-gray-800">{displayTitle}</h4>
                                )}
                                <p className="text-xs text-gray-500">
    {formattedFileSize} - {fileExtension}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={handleStartEditTitle} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                                <FaPencil />
                            </button>
                            <a href={cvDocument.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                                <FaDownload />
                            </a>
                            <button onClick={handleRemoveCV} className="p-2 rounded-full hover:bg-red-100 text-red-600">
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ) : cvEnabled ? (
                    <div className="mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg text-center">
                        <p className="text-sm text-gray-500">No document uploaded.</p>
                    </div>
                ) : null}

                {cvEnabled && (
                    <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${
                        isUploading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                    {isUploading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Uploading...</span>
                        </>
                    ) : (
                        <>
                            <FaUpload />
                            <span>{cvDocument ? 'Upload New Document' : 'Upload Document'}</span>
                        </>
                    )}
                    </button>
                )}

                {cvEnabled && (
                    <p className="text-xs text-gray-500 mt-2 text-center">
                        Allowed types: PDF, DOC, DOCX. Max size: 10MB.
                    </p>
                )}

                {/* Disabled state message */}
                {!cvEnabled && (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">
                            Enable the CV to start managing your document.
                        </p>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                title="Remove Document"
                message="Are you sure you want to remove this document? This action cannot be undone and the file will be permanently deleted."
                confirmText="Remove Document"
            />
        </>
    );
}