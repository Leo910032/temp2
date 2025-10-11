// app/dashboard/(dashboard pages)/appearance/elements/CVItemCard.jsx
"use client"

import React, { useState, useRef, useMemo } from "react";
import { FaTrash, FaDownload, FaFileAlt, FaUpload } from "react-icons/fa";
import { FaPencil } from "react-icons/fa6";
import { toast } from "react-hot-toast";
import { AppearanceService } from "@/lib/services/serviceAppearance/client/appearanceService";
import { useTranslation } from '@/lib/translation/useTranslation';

export default function CVItemCard({ item, onUpdate, onDelete, disabled }) {
    const { t, isInitialized } = useTranslation();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(item.displayTitle || '');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Pre-compute translations
    const translations = useMemo(() => {
        if (!isInitialized) return {};
        return {
            invalidFileType: t('dashboard.appearance.cv_item.error_invalid_file_type') || 'Invalid file type. Please upload a PDF or Word document.',
            fileTooLarge: t('dashboard.appearance.cv_item.error_file_too_large') || 'File is too large. Maximum size is 10MB.',
            uploadSuccess: t('dashboard.appearance.cv_item.upload_success') || 'Document uploaded successfully',
            uploadFailed: t('dashboard.appearance.cv_item.upload_failed') || 'Failed to upload document',
            deleteConfirm: t('dashboard.appearance.cv_item.delete_confirm') || 'Are you sure you want to delete this CV item?',
            editTitle: t('dashboard.appearance.cv_item.edit_title') || 'Edit title',
            download: t('dashboard.appearance.cv_item.download') || 'Download',
            replaceDocument: t('dashboard.appearance.cv_item.replace_document') || 'Replace document',
            delete: t('dashboard.appearance.cv_item.delete') || 'Delete',
            noDocument: t('dashboard.appearance.cv_item.no_document') || 'No document uploaded',
            uploading: t('dashboard.appearance.cv_item.uploading') || 'Uploading...',
            uploadDocument: t('dashboard.appearance.cv_item.upload_document') || 'Upload Document',
            document: t('dashboard.appearance.cv_item.document') || 'Document',
        };
    }, [t, isInitialized]);

    // Handle file upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // File validation
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            toast.error(translations.invalidFileType);
            return;
        }
        if (file.size > maxSize) {
            toast.error(translations.fileTooLarge);
            return;
        }

        setIsUploading(true);

        try {
            const result = await AppearanceService.uploadCVDocument(file);
            const defaultTitle = result.fileInfo.originalName.replace(/\.[^/.]+$/, "");

            // Update the item with new document
            onUpdate({
                ...item,
                url: result.downloadURL,
                fileName: result.fileInfo.originalName,
                displayTitle: defaultTitle,
                uploadDate: new Date().toISOString(),
                fileSize: result.fileInfo.size,
                fileType: result.fileInfo.type
            });

            toast.success(translations.uploadSuccess);
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.message || translations.uploadFailed);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Save title edit
    const handleSaveTitle = () => {
        if (tempTitle.trim() !== '') {
            onUpdate({ ...item, displayTitle: tempTitle.trim() });
        }
        setIsEditingTitle(false);
    };

    // Delete item
    const handleDelete = () => {
        if (confirm(translations.deleteConfirm)) {
            onDelete();
        }
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileExtension = (fileName) => {
        return fileName?.split('.').pop()?.toUpperCase() || '';
    };

    return (
        <div className="border-2 border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors">
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
            />

            {item.url ? (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                        <FaFileAlt className="text-2xl text-indigo-500" />
                        <div className="flex-1">
                            {isEditingTitle ? (
                                <input
                                    type="text"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    onBlur={handleSaveTitle}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveTitle()}
                                    className="text-md font-medium text-gray-800 outline-none border-b-2 border-blue-500 bg-gray-50 w-full"
                                    autoFocus
                                />
                            ) : (
                                <h4 className="text-md font-medium text-gray-800">
                                    {item.displayTitle || item.fileName?.replace(/\.[^/.]+$/, "") || translations.document}
                                </h4>
                            )}
                            <p className="text-xs text-gray-500">
                                {formatFileSize(item.fileSize)} - {getFileExtension(item.fileName)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsEditingTitle(true)}
                            disabled={disabled}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                            title={translations.editTitle}
                        >
                            <FaPencil />
                        </button>
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                            title={translations.download}
                        >
                            <FaDownload />
                        </a>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || isUploading}
                            className="p-2 rounded-full hover:bg-blue-100 text-blue-600"
                            title={translations.replaceDocument}
                        >
                            <FaUpload />
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={disabled}
                            className="p-2 rounded-full hover:bg-red-100 text-red-600"
                            title={translations.delete}
                        >
                            <FaTrash />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between">
                    <div className="flex-1 text-center py-4">
                        <p className="text-sm text-gray-500 mb-3">{translations.noDocument}</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || isUploading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                        >
                            {isUploading ? translations.uploading : translations.uploadDocument}
                        </button>
                    </div>
                    <button
                        onClick={handleDelete}
                        disabled={disabled}
                        className="p-2 rounded-full hover:bg-red-100 text-red-600"
                        title={translations.delete}
                    >
                        <FaTrash />
                    </button>
                </div>
            )}
        </div>
    );
}
