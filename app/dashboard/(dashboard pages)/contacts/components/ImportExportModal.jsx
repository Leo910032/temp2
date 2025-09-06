// app/dashboard/(dashboard pages)/contacts/components/ImportExportModal.jsx
"use client"

import { useState, useEffect } from 'react';
import { useTranslation } from "@/lib/translation/useTranslation";
import { toast } from 'react-hot-toast';

// Import the specific service functions we need for this modal
import {
    importContacts,
    exportContacts,
    exportContactGroups,
    // Error Handler
    ErrorHandler
} from '@/lib/services/serviceContact'; 

// Helper to trigger file download from a blob
const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
};

export default function ImportExportModal({ isOpen, onClose, allContacts, currentFilters, onActionComplete }) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('export');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showFieldReference, setShowFieldReference] = useState(false);

    // === EXPORT STATE ===
    const [exportType, setExportType] = useState('contacts'); // 'contacts' or 'groups'
    const [selectedContactIds, setSelectedContactIds] = useState([]);
    const [exportFormat, setExportFormat] = useState('csv');

    // === IMPORT STATE ===
    const [importFile, setImportFile] = useState(null);
    const [importResult, setImportResult] = useState(null);

    // Expected CSV fields for the reference table
    const csvFields = [
        { field: 'Name', type: 'Text', required: true, example: 'John Smith', description: 'Full name of the contact' },
        { field: 'Email', type: 'Text', required: true, example: 'john@example.com', description: 'Primary email address' },
        { field: 'Phone', type: 'Text', required: false, example: '+1-555-123-4567', description: 'Phone number with country code' },
        { field: 'Company', type: 'Text', required: false, example: 'Acme Corp', description: 'Company or organization name' },
        { field: 'Job Title', type: 'Text', required: false, example: 'Software Engineer', description: 'Position or role' },
        { field: 'Website', type: 'URL', required: false, example: 'https://example.com', description: 'Company or personal website' },
        { field: 'Status', type: 'Text', required: false, example: 'Active', description: 'Contact status (Active, Inactive, etc.)' },
        { field: 'Source', type: 'Text', required: false, example: 'LinkedIn', description: 'How you met this contact' },
        { field: 'Date Added', type: 'Date', required: false, example: '2024-01-15', description: 'Date when contact was added (YYYY-MM-DD)' }
    ];

    // Reset state when the modal is opened
    useEffect(() => {
        if (isOpen) {
            setSelectedContactIds(allContacts.map(c => c.id)); // Default to all selected
            setExportType('contacts');
            setExportFormat('csv');
            setImportFile(null);
            setImportResult(null);
            setShowFieldReference(false);
        }
    }, [isOpen, allContacts]);

    // Update format when export type changes
    useEffect(() => {
        if (exportType === 'groups') {
            setExportFormat('json'); // Default to JSON for groups
        } else {
            setExportFormat('csv'); // Default to CSV for contacts
        }
    }, [exportType]);

    // FIXED: handleExport now correctly passes format to the right function
    const handleExport = async () => {
        setIsProcessing(true);
        const toastId = toast.loading('Preparing your export...');
        
        try {
            let result;
            let successMessage;

            if (exportType === 'groups') {
                // --- EXPORT GROUPS ---
                toast.loading(`Exporting groups as ${exportFormat.toUpperCase()}...`, { id: toastId });
                result = await exportContactGroups(exportFormat); // Pass the selected format
                successMessage = `Groups exported as ${exportFormat.toUpperCase()} successfully!`;
            } else {
                // --- EXPORT CONTACTS ---
                if (selectedContactIds.length === 0) {
                    toast.error("Please select at least one contact to export.");
                    setIsProcessing(false);
                    toast.dismiss(toastId);
                    return;
                }
                toast.loading(`Exporting ${selectedContactIds.length} contacts as ${exportFormat.toUpperCase()}...`, { id: toastId });
                const filtersForExport = { ...currentFilters, contactIds: selectedContactIds };
                result = await exportContacts(exportFormat, filtersForExport);
                successMessage = `${selectedContactIds.length} contacts exported as ${exportFormat.toUpperCase()}!`;
            }
            
            downloadFile(result.data, result.filename);
            
            toast.success(successMessage, { id: toastId });
            onClose();

        } catch (error) {
            const handled = ErrorHandler.handle(error, 'exportData');
            toast.error(`Export failed: ${handled.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) {
            toast.error("Please select a file to import.");
            return;
        }
        setIsProcessing(true);
        const toastId = toast.loading(`Importing contacts from ${importFile.name}...`);

        try {
            const result = await importContacts(importFile, 'csv'); // Assuming CSV for now
            setImportResult(result);
            toast.success('Import processed!', { id: toastId });
            await onActionComplete();
        } catch (error) {
            const handled = ErrorHandler.handle(error, 'importContacts');
            toast.error(`Import failed: ${handled.message}`, { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectAll = () => setSelectedContactIds(allContacts.map(c => c.id));
    const handleDeselectAll = () => setSelectedContactIds([]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Import & Export Data</h2>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button 
                        onClick={() => setActiveTab('export')} 
                        className={`flex-1 p-3 text-sm font-medium ${activeTab === 'export' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Export
                    </button>
                    <button 
                        onClick={() => setActiveTab('import')} 
                        className={`flex-1 p-3 text-sm font-medium ${activeTab === 'import' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Import
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* EXPORT TAB */}
                    {activeTab === 'export' && (
                        <div className="space-y-6">
                            {/* Step 1: What to export */}
                            <div>
                                <h3 className="font-medium mb-2 text-gray-800">1. What do you want to export?</h3>
                                <div className="flex gap-4 mb-2 p-1 bg-gray-100 rounded-lg">
                                    <button 
                                        onClick={() => setExportType('contacts')} 
                                        className={`flex-1 p-2 rounded-md text-sm transition-colors ${exportType === 'contacts' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        Contacts
                                    </button>
                                    <button 
                                        onClick={() => setExportType('groups')} 
                                        className={`flex-1 p-2 rounded-md text-sm transition-colors ${exportType === 'groups' ? 'bg-white shadow text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        Groups
                                    </button>
                                </div>
                            </div>
                            
                            {/* Step 2: Contact Selection (only for contacts) */}
                            {exportType === 'contacts' && (
                                <div>
                                    <h3 className="font-medium mb-2 text-gray-800">2. Select Contacts</h3>
                                    <div className="flex gap-2 mb-2">
                                        <button 
                                            onClick={handleSelectAll} 
                                            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                                        >
                                            Select All ({allContacts.length})
                                        </button>
                                        <button 
                                            onClick={handleDeselectAll} 
                                            className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                    <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                                        {allContacts.map(contact => (
                                            <label key={contact.id} className="flex items-center p-1 rounded hover:bg-gray-50 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedContactIds.includes(contact.id)} 
                                                    onChange={() => setSelectedContactIds(prev => 
                                                        prev.includes(contact.id) 
                                                            ? prev.filter(id => id !== contact.id) 
                                                            : [...prev, contact.id]
                                                    )} 
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="ml-3 text-sm text-gray-700">
                                                    {contact.name || 'Unnamed Contact'}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {selectedContactIds.length} of {allContacts.length} contacts selected.
                                    </p>
                                </div>
                            )}

                            {/* Step 3: Format Selection */}
                            <div>
                                <h3 className="font-medium mb-2 text-gray-800">
                                    {exportType === 'contacts' ? '3. Choose Format' : '2. Choose Format'}
                                </h3>
                                
                                {exportType === 'groups' ? (
                                    <select 
                                        value={exportFormat} 
                                        onChange={e => setExportFormat(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="json">JSON (Recommended for Groups)</option>
                                        <option value="csv">CSV (for Spreadsheets)</option>
                                    </select>
                                ) : (
                                    <select 
                                        value={exportFormat} 
                                        onChange={e => setExportFormat(e.target.value)} 
                                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="csv">CSV (for Excel, Google Sheets)</option>
                                        <option value="json">JSON (for developers)</option>
                                        <option value="vcf">VCF (for contact apps)</option>
                                    </select>
                                )}
                                
                                {/* Format description */}
                                <p className="text-xs text-gray-500 mt-2">
                                    {exportType === 'groups' ? (
                                        exportFormat === 'json' 
                                            ? 'JSON format preserves all group data and structure.'
                                            : 'CSV format is compatible with spreadsheet applications.'
                                    ) : (
                                        exportFormat === 'csv' 
                                            ? 'CSV format is compatible with Excel and Google Sheets.'
                                            : exportFormat === 'json'
                                                ? 'JSON format preserves all contact data and custom fields.'
                                                : 'VCF format is compatible with most contact/address book applications.'
                                    )}
                                </p>
                            </div>

                            {/* Export Button */}
                            <button 
                                onClick={handleExport} 
                                disabled={isProcessing || (exportType === 'contacts' && selectedContactIds.length === 0)} 
                                className="w-full py-2.5 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Exporting...
                                    </>
                                ) : (
                                    `Export ${exportType === 'contacts' ? `${selectedContactIds.length} Contact${selectedContactIds.length !== 1 ? 's' : ''}` : 'Groups'} as ${exportFormat.toUpperCase()}`
                                )}
                            </button>
                        </div>
                    )}

                    {/* IMPORT TAB */}
                    {activeTab === 'import' && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-medium mb-2">1. Choose File to Import</h3>
                                <input 
                                    type="file" 
                                    accept=".csv,.json"
                                    onChange={e => setImportFile(e.target.files[0])} 
                                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Supported formats: CSV, JSON. Max file size: 5MB.
                                </p>
                            </div>

                            {/* Field Reference Section */}
                            <div className="border rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-medium text-gray-800">2. CSV File Format Reference</h3>
                                    <button
                                        onClick={() => setShowFieldReference(!showFieldReference)}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        {showFieldReference ? 'Hide' : 'Show'} Field Guide
                                        <svg 
                                            className={`w-4 h-4 transition-transform ${showFieldReference ? 'rotate-180' : ''}`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>

                                {showFieldReference && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-white border-b">
                                                    <th className="text-left p-2 font-semibold border-r">Field Name</th>
                                                    <th className="text-left p-2 font-semibold border-r">Type</th>
                                                    <th className="text-center p-2 font-semibold border-r">Required</th>
                                                    <th className="text-left p-2 font-semibold border-r">Example</th>
                                                    <th className="text-left p-2 font-semibold">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white">
                                                {csvFields.map((field, index) => (
                                                    <tr key={index} className={`border-b ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                                                        <td className="p-2 font-medium border-r">{field.field}</td>
                                                        <td className="p-2 text-gray-600 border-r">{field.type}</td>
                                                        <td className="p-2 text-center border-r">
                                                            {field.required ? (
                                                                <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs font-medium">Yes</span>
                                                            ) : (
                                                                <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">No</span>
                                                            )}
                                                        </td>
                                                        <td className="p-2 text-gray-700 font-mono text-xs border-r">{field.example}</td>
                                                        <td className="p-2 text-gray-600">{field.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {!showFieldReference && (
                                    <p className="text-sm text-gray-600">
                                        Your CSV file should include these columns: <span className="font-mono bg-white px-1 rounded">Name</span>, <span className="font-mono bg-white px-1 rounded">Email</span> (required), 
                                        and optionally: <span className="font-mono bg-white px-1 rounded">Phone</span>, <span className="font-mono bg-white px-1 rounded">Company</span>, <span className="font-mono bg-white px-1 rounded">Job Title</span>, etc.
                                    </p>
                                )}
                            </div>
                            
                            {importResult && (
                                <div className="p-4 bg-gray-50 rounded-lg border text-sm space-y-3">
                                    <h4 className="font-semibold text-gray-800">Import Summary</h4>
                                    
                                    <div className="flex justify-between items-center">
                                        <span>Successfully Imported:</span>
                                        <span className="font-bold text-green-600">{importResult.imported}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Duplicates Skipped:</span>
                                        <span className="font-bold text-yellow-600">{importResult.duplicates}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>Rows with Errors Skipped:</span>
                                        <span className="font-bold text-red-600">{importResult.errors}</span>
                                    </div>

                                    {/* Display detailed errors if they exist */}
                                    {importResult.errorList && importResult.errorList.length > 0 && (
                                        <div className="pt-3 border-t">
                                            <h5 className="font-semibold text-red-700 mb-2">Error Details:</h5>
                                            <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded-md space-y-2">
                                                {importResult.errorList.map((error, index) => (
                                                    <div key={index}>
                                                        <p className="font-semibold text-red-800">Row {error.row}:</p>
                                                        <ul className="list-disc list-inside text-red-700 text-xs pl-2">
                                                            {error.errors.map((msg, i) => <li key={i}>{msg}</li>)}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Display detailed duplicate info if they exist */}
                                    {importResult.duplicateList && importResult.duplicateList.length > 0 && (
                                        <div className="pt-3 border-t">
                                            <h5 className="font-semibold text-yellow-700 mb-2">Duplicate Details:</h5>
                                            <div className="max-h-32 overflow-y-auto bg-yellow-50 p-2 rounded-md space-y-1">
                                                {importResult.duplicateList.map((dup, index) => (
                                                    <p key={index} className="text-xs text-yellow-800">
                                                        <span className="font-semibold">Row {dup.row}:</span> Email "{dup.email}" already exists.
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <button 
                                onClick={handleImport} 
                                disabled={isProcessing || !importFile} 
                                className="w-full py-2.5 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Importing...
                                    </>
                                ) : (
                                    'Import Contacts'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}