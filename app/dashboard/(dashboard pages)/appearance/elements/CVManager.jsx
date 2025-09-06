"use client"

import { useState, useRef, useContext } from 'react';
import { FaUpload, FaTrash, FaDownload, FaFileAlt, FaExclamationTriangle } from 'react-icons/fa';
import { FaPencil } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { uploadCVDocument, removeCVDocument } from '@/lib/services/appearanceService';
import { AppearanceContext } from '../AppearanceContext';

// ✅ Custom Confirmation Modal Component
function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Delete", cancelText = "Cancel" }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-md w-full mx-4 shadow-2xl transform transition-all">
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                            <FaExclamationTriangle className="text-red-600 text-lg" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-600 leading-relaxed">{message}</p>
                </div>

                {/* Actions */}
                <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function CVManager() {
    const { appearance, updateAppearance } = useContext(AppearanceContext);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const fileInputRef = useRef(null);

    const cvDocument = appearance?.cvDocument;

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ];

        if (!allowedTypes.includes(file.type)) {
            toast.error('Please upload a valid document (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT)');
            return;
        }

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            toast.error('File size must be less than 50MB');
            return;
        }

        setIsUploading(true);
        
        try {
            const result = await uploadCVDocument(file);
            
            // Create default display title from filename (without extension)
            const defaultTitle = result.fileInfo.originalName.replace(/\.[^/.]+$/, "");
            
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
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Show modal instead of browser confirm
    const handleRemoveCV = () => {
        setShowDeleteModal(true);
    };

    // Handle confirmed deletion
    const handleConfirmDelete = async () => {
        setShowDeleteModal(false);
        
        try {
            await removeCVDocument();
            updateAppearance('cvDocument', null);
            toast.success('CV removed successfully!');
        } catch (error) {
            console.error('CV removal error:', error);
            toast.error(error.message || 'Failed to remove CV');
        }
    };

    // ✅ Handle title editing (like links page)
    const handleStartEditTitle = () => {
        setTempTitle(cvDocument?.displayTitle || cvDocument?.fileName || '');
        setIsEditingTitle(true);
    };

    const handleSaveTitle = () => {
        if (tempTitle.trim() && tempTitle.trim() !== cvDocument?.displayTitle) {
            updateAppearance('cvDocument', {
                ...cvDocument,
                displayTitle: tempTitle.trim()
            });
            toast.success('Title updated successfully!');
        }
        setIsEditingTitle(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            setIsEditingTitle(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileExtension = (fileName) => {
        return fileName.split('.').pop().toUpperCase();
    };

    const getDisplayTitle = () => {
        return cvDocument?.displayTitle || cvDocument?.fileName || 'Untitled Document';
    };

    return (
        <>
            <div className="w-full bg-white rounded-3xl my-3 p-6">
                <h3 className="text-lg font-semibold mb-4">Curriculum / Documents</h3>
                
                {/* File input (hidden) */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                />

                {/* Current CV Display */}
                {cvDocument && (
                    <div className="mb-4 p-4 border border-gray-200 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1 group">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FaFileAlt className="text-blue-600 text-lg" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {/* ✅ Editable Title with Pencil Icon (matching links style) */}
                                    <div className="flex items-center gap-3 mb-1 cursor-pointer w-[95%]" onClick={handleStartEditTitle}>
                                        {isEditingTitle ? (
                                            <input
                                                type="text"
                                                value={tempTitle}
                                                onChange={(e) => setTempTitle(e.target.value)}
                                                onKeyDown={handleKeyPress}
                                                onBlur={handleSaveTitle}
                                                className="flex-1 border-none outline-none font-medium"
                                                placeholder="Enter display title..."
                                                autoFocus
                                                maxLength={100}
                                                ref={(input) => {
                                                    if (input && isEditingTitle) {
                                                        input.focus();
                                                        input.select();
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <span className="font-medium truncate flex-1">
                                                    {getDisplayTitle()}
                                                </span>
                                                <FaPencil className="text-xs text-black opacity-60 group-hover:opacity-100" />
                                            </>
                                        )}
                                    </div>
                                    
                                    <div className="text-sm text-gray-500">
                                        {formatFileSize(cvDocument.fileSize)} • {getFileExtension(cvDocument.fileName)}
                                    </div>
                                    <div className="text-xs text-gray-400 truncate">
                                        Original: {cvDocument.fileName}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                <a
                                    href={cvDocument.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Download"
                                >
                                    <FaDownload />
                                </a>
                                <button
                                    onClick={handleRemoveCV}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl font-semibold transition-all duration-200 ${
                        cvDocument 
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700'
                    } ${isUploading ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                >
                    <FaUpload className={isUploading ? 'animate-pulse' : ''} />
                    <span>
                        {isUploading 
                            ? 'Uploading...' 
                            : cvDocument 
                                ? 'Replace File' 
                                : 'Upload CV / Document'
                        }
                    </span>
                </button>

                {/* File type info */}
                <p className="text-xs text-gray-500 text-center mt-2">
                    PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT • Max 50MB
                </p>
            </div>

            {/* Custom Confirmation Modal */}
            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleConfirmDelete}
                title="Remove CV Document"
                message="Are you sure you want to remove your CV document? This action cannot be undone and the file will be permanently deleted."
                confirmText="Remove CV"
                cancelText="Cancel"
            />
        </>
    );
}