// app/dashboard/(dashboard pages)/contacts/components/BusinessCardScanner.jsx - FIXED
"use client"

import { useTranslation } from '@/lib/translation/useTranslation';
import { toast } from 'react-hot-toast';
import { useState, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { useAuth } from "@/contexts/AuthContext";

export default function BusinessCardScanner({ isOpen, onClose, onContactParsed }) {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [currentSide, setCurrentSide] = useState('front'); // 'front' or 'back'
    const [cardData, setCardData] = useState({
        front: { image: null, previewUrl: null },
        back: { image: null, previewUrl: null }
    });
    const [scanMode, setScanMode] = useState('single'); // 'single' or 'double'
    const [costEstimate, setCostEstimate] = useState(null);
    // Add these new state variables around line 25
const [dynamicFields, setDynamicFields] = useState([]);
const [scanMetadata, setScanMetadata] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);    
    const [mediaStream, setMediaStream] = useState(null);

    // ✅ REMOVED - No longer importing server services directly
    // const businessCardService = ContactServiceFactory.getBusinessCardService();
    // const aiCostService = ContactServiceFactory.getAICostService();

    // Authentication check
    useEffect(() => {
        if (isOpen && !currentUser) {
            toast.error('Please log in to use the business card scanner');
            onClose();
        }
    }, [isOpen, currentUser, onClose]);

    // Media stream management
    useEffect(() => {
        if (mediaStream && videoRef.current) {
            videoRef.current.srcObject = mediaStream;
        }

        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [mediaStream]);

  const mergeCardSideResults = (results) => {
    const mergedStandardFields = new Map();
    const mergedDynamicFields = new Map();
    const metadata = {
        sidesProcessed: results.length,
        successfulSides: results.filter(r => r.success).length,
        hasQRCode: false,
        totalCost: 0,
        processedAt: new Date().toISOString(),
        sideDetails: []
    };

    results.forEach(({ side, fields, dynamicFields, metadata: sideMetadata }) => {
        if (fields) {
            // Process standard fields
            fields.forEach(field => {
                const key = field.label.toLowerCase();
                const existingField = mergedStandardFields.get(key);

                if (!existingField || field.confidence > existingField.confidence) {
                    mergedStandardFields.set(key, { ...field, side });
                }
            });
        }

        if (dynamicFields) {
            // Process dynamic fields
            dynamicFields.forEach(field => {
                const key = `${field.label.toLowerCase()}_${side}`;
                mergedDynamicFields.set(key, { ...field, side });
            });
        }

        // Update metadata
        if (sideMetadata?.hasQRCode) metadata.hasQRCode = true;
        if (sideMetadata?.cost) metadata.totalCost += sideMetadata.cost;
    });

    return {
        standardFields: Array.from(mergedStandardFields.values()),
        dynamicFields: Array.from(mergedDynamicFields.values())
    };
};

    // Reset states when modal closes
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            resetCardData();
            setIsProcessing(false);
            setScanMode('single');
            setCurrentSide('front');
        }
    }, [isOpen]);

    // Get cost estimate when component mounts
    useEffect(() => {
        if (isOpen) {
            loadCostEstimate();
        }
    }, [isOpen]);

    // ✅ FIXED - Use API endpoint for cost estimate instead of direct service call
    const loadCostEstimate = async () => {
        try {
            if (!currentUser) return;
            
            const token = await currentUser.getIdToken();
            const response = await fetch('/api/user/contacts/scan?action=cost-estimate&count=1', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const estimate = await response.json();
                setCostEstimate(estimate);
            } else {
                console.warn('Failed to load cost estimate');
                setCostEstimate({ estimated: 0.002 }); // fallback estimate
            }
        } catch (error) {
            console.error('Failed to load cost estimate:', error);
            setCostEstimate({ estimated: 0.002 }); // fallback estimate
        }
    };

    const resetCardData = () => {
        // Clean up blob URLs to prevent memory leaks
        Object.values(cardData).forEach(side => {
            if (side.previewUrl && side.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(side.previewUrl);
            }
        });
        
        setCardData({
            front: { image: null, previewUrl: null },
            back: { image: null, previewUrl: null }
        });
    };

    const startCamera = async () => {
        const idealConstraints = { 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        };
        const fallbackConstraints = { 
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(idealConstraints);
            } catch (err) {
                console.warn("Could not get back camera, falling back.", err);
                stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            }
            
            setMediaStream(stream);
            setShowCamera(true);

        } catch (error) {
            console.error('Could not access any camera.', error);
            toast.error(t('business_card_scanner.camera_access_error') || 'Camera access error');
        }
    };

    const stopCamera = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        setMediaStream(null);
        setShowCamera(false);
    };

    const capturePhoto = () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video || !video.videoWidth) return;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

        canvas.toBlob((blob) => {
            const file = new File([blob], `business-card-${currentSide}.jpg`, { type: 'image/jpeg' });
            
            // Update card data for current side
            setCardData(prev => {
                // Clean up previous preview URL
                if (prev[currentSide].previewUrl && prev[currentSide].previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(prev[currentSide].previewUrl);
                }
                
                return {
                    ...prev,
                    [currentSide]: {
                        image: file,
                        previewUrl: dataUrl
                    }
                };
            });

            // Handle side switching for double-sided mode
            if (scanMode === 'double' && currentSide === 'front') {
                setCurrentSide('back');
                toast.success('Front captured! Now capture the back side.');
            } else {
                stopCamera();
                if (scanMode === 'double') {
                    toast.success('Both sides captured successfully!');
                } else {
                    toast.success('Card captured successfully!');
                }
            }
        }, 'image/jpeg', 0.9);
    };

    const handleFileSelect = async (event) => {
        console.log('handleFileSelect triggered');
        const files = Array.from(event.target.files);
        if (files.length === 0) {
            console.log('No files selected');
            return;
        }

        console.log(`Selected ${files.length} file(s):`, files.map(f => ({ name: f.name, size: f.size, type: f.type })));

        // Validate files
        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                console.error('Invalid file type:', file.type);
                toast.error(t('business_card_scanner.invalid_file_type') || 'Invalid file type');
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                console.error('File too large:', file.size);
                toast.error(t('business_card_scanner.file_too_large') || 'File too large');
                return;
            }
        }

        try {
            console.log('Processing files...');
            
            if (files.length === 1) {
                // Single file - assign to current side
                const file = files[0];
                console.log(`Creating URL for single file: ${file.name}`);
                const url = URL.createObjectURL(file);
                console.log('Created URL:', url);
                
                setCardData(prev => {
                    if (prev[currentSide].previewUrl && prev[currentSide].previewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(prev[currentSide].previewUrl);
                    }
                    
                    const newData = {
                        ...prev,
                        [currentSide]: {
                            image: file,
                            previewUrl: url
                        }
                    };
                    console.log('Updated card data:', newData);
                    return newData;
                });
                
                if (scanMode === 'single') {
                    toast.success('Card image uploaded successfully!');
                } else {
                    toast.success(`${currentSide} side uploaded successfully!`);
                }
            } else if (files.length === 2 && scanMode === 'double') {
                // Two files - assign to front and back
                const frontFile = files[0];
                const backFile = files[1];
                console.log('Creating URLs for two files');
                const frontUrl = URL.createObjectURL(frontFile);
                const backUrl = URL.createObjectURL(backFile);
                
                setCardData(prev => {
                    // Clean up previous URLs
                    Object.values(prev).forEach(side => {
                        if (side.previewUrl && side.previewUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(side.previewUrl);
                        }
                    });
                    
                    const newData = {
                        front: { image: frontFile, previewUrl: frontUrl },
                        back: { image: backFile, previewUrl: backUrl }
                    };
                    console.log('Updated card data with both sides:', newData);
                    return newData;
                });
                
                toast.success('Both card sides uploaded successfully!');
            } else {
                console.error('Wrong number of files for scan mode');
                toast.error('Please select the correct number of images for your scan mode.');
            }
            
        } catch (error) {
            console.error('Error processing files:', error);
            toast.error(t('business_card_scanner.image_load_failed') || 'Image load failed');
        }
        
        // Reset the input value to allow selecting the same file again
        event.target.value = '';
    };

    // ✅ FIXED - Completely rewritten to use only API calls
    const processImages = async () => {
        // Check authentication first
        if (!currentUser) {
            toast.error('Please log in to use the business card scanner');
            return;
        }

        const imagesToProcess = {};
        
        if (scanMode === 'single') {
            if (!cardData.front.image) {
                toast.error('Please capture or upload a card image first');
                return;
            }
            imagesToProcess.front = cardData.front.image;
        } else {
            if (!cardData.front.image || !cardData.back.image) {
                toast.error('Please capture or upload both front and back images');
                return;
            }
            imagesToProcess.front = cardData.front.image;
            imagesToProcess.back = cardData.back.image;
        }
        
        setIsProcessing(true);
        
        try {
            // Show cost warning if available
            if (costEstimate && costEstimate.estimated) {
                const totalCost = scanMode === 'double' 
                    ? costEstimate.estimated * 2 
                    : costEstimate.estimated;
                const costMessage = `This will cost approximately $${totalCost.toFixed(4)} for scanning.`;
                
                toast(costMessage, { 
                    duration: 3000,
                    icon: '💰',
                    style: {
                        background: '#3b82f6',
                        color: 'white',
                    }
                });            
            }

            // Get authentication token
            const token = await currentUser.getIdToken();

            // Process each side separately using the API
            const results = [];
            
            for (const [side, file] of Object.entries(imagesToProcess)) {
                setProcessingStatus(`Compressing image (${side})...`);
                console.log(`Processing ${side} side - Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
                
                // Compress image
                const options = {
                    maxSizeMB: 1.5,
                    maxWidthOrHeight: 1920,
                    useWebWorker: true,
                    initialQuality: 0.8
                };
                const compressedFile = await imageCompression(file, options);
                console.log(`${side} compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

                // Convert to base64
                const base64 = await convertFileToBase64(compressedFile);

                setProcessingStatus(`Scanning business card (${side} side)...`);
                toast.loading(`Scanning ${side} side...`, { id: `scanning-${side}` });

                // ✅ FIXED - Call the API endpoint correctly
                const response = await fetch('/api/user/contacts/scan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        imageBase64: base64,
                        side,
                        trackCost: true,
                        metadata: {
                            scanMode,
                            originalSize: file.size,
                            compressedSize: compressedFile.size
                        }
                    })
                });

                toast.dismiss(`scanning-${side}`);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const scanResult = await response.json();

                if (scanResult.success) {
                    results.push({
                        side,
                        fields: scanResult.parsedFields || [],
                                            dynamicFields: scanResult.dynamicFields || [], // ADD THIS LINE

                        metadata: scanResult.metadata || {}
                    });
                    
                    toast.success(`${side} side scanned successfully!`);
                } else {
                    throw new Error(scanResult.error || `${side} side scan failed`);
                }
            }
// ENHANCED: Process both standard and dynamic fields
let finalStandardFields, finalDynamicFields;
if (results.length === 1) {
    finalStandardFields = results[0].fields;
    finalDynamicFields = results[0].dynamicFields || []; // ADD THIS LINE
} else {
    const mergedResult = mergeCardSideResults(results);
    finalStandardFields = mergedResult.standardFields || [];
    finalDynamicFields = mergedResult.dynamicFields || []; // ADD THIS LINE
}

// ENHANCED: Pass both standard and dynamic fields to parent
const enhancedFields = {
    standardFields: finalStandardFields,
    dynamicFields: finalDynamicFields,
    metadata: {
        ...results[0]?.metadata,
        totalFields: finalStandardFields.length + finalDynamicFields.length,
        enhancedProcessing: true
    }
};

// Store dynamic fields in component state
setDynamicFields(finalDynamicFields);
setScanMetadata(enhancedFields.metadata);

onContactParsed(enhancedFields); // Pass enhanced data instead of just finalFields

toast.success(`Card scanning complete! Found ${finalStandardFields.length} standard fields and ${finalDynamicFields.length} dynamic fields.`);

            // Show cost summary if available
            let totalCost = 0;
            results.forEach(result => {
                if (result.metadata?.costInfo?.apiCallCost) {
                    totalCost += result.metadata.costInfo.apiCallCost;
                }
            });
            
            if (totalCost > 0) {
                toast(`Total cost: $${totalCost.toFixed(4)}`, { 
                    duration: 4000,
                    icon: '💰',
                    style: {
                        background: '#3b82f6',
                        color: 'white',
                    }
                });
            }

            // Show QR code detection if found
            const hasQRCode = results.some(result => result.metadata?.hasQRCode);
            if (hasQRCode) {
                toast.success('QR Code detected and processed!', { duration: 3000 });
            }

        } catch (error) {
            console.error('Image processing error:', error);
            
            if (error.message.includes('subscription') || error.message.includes('budget')) {
                toast.error('Business card scanning requires a valid subscription', { duration: 4000 });
            } else if (error.message.includes('rate limit')) {
                toast.error('Too many scan requests. Please try again later.', { duration: 4000 });
            } else if (error.message.includes('Authentication required')) {
                toast.error('Please log in again to continue', { duration: 4000 });
            } else {
                toast.error(error.message || 'Processing failed');
            }
        } finally {
            setIsProcessing(false);
            setProcessingStatus('');
        }
    };

    // Helper function to convert file to base64
    const convertFileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = event.target.result;
                    const base64Part = result.split(',')[1];
                    resolve(base64Part);
                } catch (error) {
                    reject(new Error(`Error processing file: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    };

    const handleClose = () => {
        stopCamera();
        resetCardData();
        setIsProcessing(false);
        setScanMode('single');
        setCurrentSide('front');
        onClose();
    };

    const handleRetake = () => {
        if (scanMode === 'single' || currentSide === 'front') {
            // Reset everything for single mode or if retaking front
            resetCardData();
            setCurrentSide('front');
        } else {
            // For double mode, just reset current side
            setCardData(prev => {
                if (prev[currentSide].previewUrl && prev[currentSide].previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(prev[currentSide].previewUrl);
                }
                return {
                    ...prev,
                    [currentSide]: { image: null, previewUrl: null }
                };
            });
        }
        setIsProcessing(false);
    };

    const switchSide = (side) => {
        setCurrentSide(side);
    };

    const getCurrentImage = () => {
        return cardData[currentSide];
    };

    const hasAnyImages = () => {
        return cardData.front.image || cardData.back.image;
    };

    const canProcess = () => {
        if (scanMode === 'single') {
            return cardData.front.image;
        }
        return cardData.front.image && cardData.back.image;
    };

    // Don't render if user is not authenticated
    if (!currentUser) {
        return null;
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-4xl h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-white flex-shrink-0">
                    <div>
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                            Business Card Scanner
                        </h3>
                        {costEstimate && costEstimate.estimated !== undefined && (
                            <p className="text-xs text-gray-500 mt-1">
                                Est. cost: ${typeof costEstimate.estimated === 'number' ? `${(scanMode === 'double' ? costEstimate.estimated * 2 : costEstimate.estimated).toFixed(4)}` : 'Calculating...'}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        disabled={isProcessing}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {/* Initial choice screen */}
                    {!showCamera && !hasAnyImages() && (
                        <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-full">
                            {/* Scan mode selection */}
                            <div className="w-full max-w-sm mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Scan Mode
                                </label>
                                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                                    <button
                                        onClick={() => setScanMode('single')}
                                        className={`flex-1 px-3 py-2 text-sm font-medium ${
                                            scanMode === 'single'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Single Side
                                    </button>
                                    <button
                                        onClick={() => setScanMode('double')}
                                        className={`flex-1 px-3 py-2 text-sm font-medium ${
                                            scanMode === 'double'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Both Sides
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {scanMode === 'double' ? 'Scan front and back for complete information' : 'Scan one side only'}
                                </p>
                            </div>

                            <div className="text-center mb-6 sm:mb-8">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                                    {scanMode === 'double' ? 'Scan Both Sides' : 'Scan Business Card'}
                                </h3>
                                <p className="text-gray-600 text-sm sm:text-base max-w-sm">
                                    {scanMode === 'double' 
                                        ? 'Capture front and back for complete contact information'
                                        : 'Extract contact information automatically from business cards using AI'
                                    }
                                </p>
                            </div>
                            
                            <div className="w-full max-w-sm space-y-3 sm:space-y-4">
                                {/* Camera button */}
                                <button
                                    onClick={startCamera}
                                    className="w-full flex flex-col items-center gap-3 p-4 sm:p-6 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                                    disabled={isProcessing}
                                >
                                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span className="font-medium text-sm sm:text-base">Take Photo</span>
                                    <span className="text-xs text-blue-100">Use device camera</span>
                                </button>

                                {/* File upload button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex flex-col items-center gap-3 p-4 sm:p-6 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                                    disabled={isProcessing}
                                >
                                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    <span className="font-medium text-sm sm:text-base">Upload Image{scanMode === 'double' ? 's' : ''}</span>
                                    <span className="text-xs text-gray-500">From device gallery</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Camera view */}
                    {showCamera && (
                        <div className="p-3 sm:p-4 flex flex-col items-center min-h-full">
                            {/* Side indicator for double mode */}
                            {scanMode === 'double' && (
                                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 w-full max-w-2xl">
                                    <div className="flex items-center justify-center gap-4">
                                        <div className={`flex items-center gap-2 ${currentSide === 'front' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                                            {cardData.front.image ? '✅' : '📷'} Front
                                        </div>
                                        <div className="w-8 h-0.5 bg-gray-300"></div>
                                        <div className={`flex items-center gap-2 ${currentSide === 'back' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
                                            {cardData.back.image ? '✅' : '📷'} Back
                                        </div>
                                    </div>
                                    <p className="text-sm text-blue-700 text-center mt-2">
                                        Currently capturing: <strong>{currentSide} side</strong>
                                    </p>
                                </div>
                            )}

                            <div className="relative w-full max-w-2xl">
                                <div className="relative bg-black rounded-lg sm:rounded-xl overflow-hidden">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full h-auto min-h-[250px] sm:min-h-[400px] object-cover"
                                    />
                                    
                                    {/* Overlay guide */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="relative">
                                            {/* Card frame overlay */}
                                            <div 
                                                className="border-2 border-white border-dashed rounded-lg"
                                                style={{
                                                    width: typeof window !== 'undefined' && window.innerWidth < 640 ? '200px' : '280px',
                                                    height: typeof window !== 'undefined' && window.innerWidth < 640 ? '130px' : '180px',
                                                    aspectRatio: '85.6/53.98'
                                                }}
                                            >
                                                {/* Corner guides */}
                                                <div className="absolute -top-1 -left-1 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-t-2 sm:border-l-4 sm:border-t-4 border-yellow-400"></div>
                                                <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-t-2 sm:border-r-4 sm:border-t-4 border-yellow-400"></div>
                                                <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-b-2 sm:border-l-4 sm:border-b-4 border-yellow-400"></div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-b-2 sm:border-r-4 sm:border-b-4 border-yellow-400"></div>
                                            </div>
                                            
                                            {/* Instructions */}
                                            <div className="absolute -bottom-8 sm:-bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 rounded-lg whitespace-nowrap">
                                                Position {scanMode === 'double' ? currentSide : 'card'} within frame
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex gap-2 sm:gap-3 mt-3 sm:mt-4">
                                    <button
                                        onClick={stopCamera}
                                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm sm:text-base"
                                        disabled={isProcessing}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={capturePhoto}
                                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
                                        disabled={isProcessing}
                                    >
                                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0118.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        </svg>
                                        <span className="hidden sm:inline">
                                            Capture {scanMode === 'double' ? currentSide : 'Photo'}
                                        </span>
                                        <span className="sm:hidden">Capture</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview and processing screen */}
                    {!showCamera && hasAnyImages() && (
                        <div className="p-3 sm:p-4 flex flex-col items-center min-h-full">
                            <div className="w-full max-w-2xl">
                                {/* Side tabs for double mode */}
                                {scanMode === 'double' && (
                                    <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => switchSide('front')}
                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                currentSide === 'front'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                        >
                                            Front {cardData.front.image ? '✅' : '❌'}
                                        </button>
                                        <button
                                            onClick={() => switchSide('back')}
                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                currentSide === 'back'
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                        >
                                            Back {cardData.back.image ? '✅' : '❌'}
                                        </button>
                                    </div>
                                )}

                                <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center">
                                    {canProcess() ? 'Ready to Scan' : 'Add Images to Continue'}
                                </h4>
                                
                                {/* Current image preview */}
                                {getCurrentImage().previewUrl && (
                                    <div className="bg-gray-100 rounded-lg sm:rounded-xl p-2 sm:p-4 mb-3 sm:mb-4">
                                        <img
                                            src={getCurrentImage().previewUrl}
                                            alt={`Business card ${currentSide} side`}
                                            className="w-full h-auto max-h-[300px] sm:max-h-[400px] object-contain rounded-lg shadow-sm"
                                            onLoad={(e) => {
                                                console.log(`${currentSide} preview loaded successfully:`, {
                                                    width: e.target.naturalWidth,
                                                    height: e.target.naturalHeight
                                                });
                                            }}
                                            onError={(e) => {
                                                console.error(`${currentSide} preview failed to load`);
                                                toast.error(`${currentSide} image display failed`);
                                            }}
                                        />
                                        {scanMode === 'double' && (
                                            <p className="text-center text-sm text-gray-600 mt-2">
                                                {currentSide} side
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Upload missing images for double mode */}
                                {scanMode === 'double' && !getCurrentImage().image && (
                                    <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                                        <div className="flex items-center justify-center">
                                            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm text-yellow-800">
                                                {currentSide} side image needed
                                            </span>
                                        </div>
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={startCamera}
                                                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                Take Photo
                                            </button>
                                            <button
                                                onClick={() => {
                                                    console.log('Upload button clicked');
                                                    if (fileInputRef.current) {
                                                        fileInputRef.current.click();
                                                    }
                                                }}
                                                className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                                                disabled={isProcessing}
                                            >
                                                Upload
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Processing status */}
                                {isProcessing && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-3">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-blue-900">
                                                    Processing with AI...
                                                </p>
                                                <p className="text-xs text-blue-700">
                                                    {processingStatus || 'Extracting text and QR codes from your business card'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex gap-2 sm:gap-3">
                                    <button
                                        onClick={handleRetake}
                                        disabled={isProcessing}
                                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors font-medium text-sm sm:text-base"
                                    >
                                        <span className="hidden sm:inline">
                                            {scanMode === 'double' ? `Retake ${currentSide}` : 'Retake Photo'}
                                        </span>
                                        <span className="sm:hidden">Retake</span>
                                    </button>

                                    {/* Add more images button for double mode */}
                                    {scanMode === 'double' && !canProcess() && (
                                        <button
                                            onClick={startCamera}
                                            disabled={isProcessing}
                                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base"
                                        >
                                            Add {currentSide}
                                        </button>
                                    )}

                                    <button
                                        onClick={processImages}
                                        disabled={isProcessing || !canProcess()}
                                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                                                <span>{processingStatus || 'Processing...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <span className="hidden sm:inline">
                                                    Scan Card{scanMode === 'double' ? 's' : ''}
                                                </span>
                                                <span className="sm:hidden">Scan</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Pro tip */}
                                {!isProcessing && canProcess() && (
                                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                        <div className="flex">
                                            <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <div className="text-sm text-yellow-800">
                                                <p className="font-medium mb-1">Pro Tip</p>
                                                <p className="text-xs">
                                                    {scanMode === 'double' 
                                                        ? 'Scanning both sides captures more complete contact information and social media links!'
                                                        : 'For best results, ensure the card is well-lit and text is clearly visible. Our AI can detect QR codes too!'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Cost information */}
                                {costEstimate && canProcess() && !isProcessing && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                            <div className="text-sm text-blue-800">
                                                <p className="font-medium">
                                                    Estimated cost: ${scanMode === 'double' ? (costEstimate.estimated * 2).toFixed(4) : costEstimate.estimated.toFixed(4)}
                                                </p>
                                                <p className="text-xs text-blue-600">
                                                    {scanMode === 'double' ? 'Processing both sides' : 'Single card scan'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isProcessing}
                        multiple={scanMode === 'double'}
                        style={{ display: 'none' }}
                    />

                    {/* Hidden canvas for image processing */}
                    <canvas ref={canvasRef} className="hidden" />
                </div>
            </div>
        </div>
    );
}