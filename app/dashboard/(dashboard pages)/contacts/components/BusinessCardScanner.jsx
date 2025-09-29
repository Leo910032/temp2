// app/dashboard/(dashboard pages)/contacts/components/BusinessCardScanner.jsx
"use client"

import { useTranslation } from '@/lib/translation/useTranslation';
import { toast } from 'react-hot-toast';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { useCameraCapture } from './cardScanner/useCameraCapture';
import { useImageProcessor } from './cardScanner/useImageProcessor';
import ScannerHeader from './cardScanner/ScannerHeader';
import InitialScreen from './cardScanner/InitialScreen';
import CameraView from './cardScanner/CameraView';
import PreviewScreen from './cardScanner/PreviewScreen';

export default function BusinessCardScanner({ isOpen, onClose, onContactParsed }) {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [currentSide, setCurrentSide] = useState('front');
    const [cardData, setCardData] = useState({
        front: { image: null, previewUrl: null },
        back: { image: null, previewUrl: null }
    });
    const [scanMode, setScanMode] = useState('single');
    const [costEstimate, setCostEstimate] = useState(null);
    const [dynamicFields, setDynamicFields] = useState([]);
    const [scanMetadata, setScanMetadata] = useState(null);
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [mediaStream, setMediaStream] = useState(null);

    // Custom hooks
    const { startCamera, stopCamera, capturePhoto } = useCameraCapture({
        videoRef,
        canvasRef,
        mediaStream,
        setMediaStream,
        setShowCamera,
        currentSide,
        setCurrentSide,
        cardData,
        setCardData,
        scanMode,
        t
    });

    const { processImages } = useImageProcessor({
        currentUser,
        cardData,
        scanMode,
        costEstimate,
        setIsProcessing,
        setProcessingStatus,
        setDynamicFields,
        setScanMetadata,
        onContactParsed
    });

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

    // Reset states when modal closes
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            resetCardData();
            setIsProcessing(false);
            setScanMode('single');
            setCurrentSide('front');
        }
    }, [isOpen, stopCamera, resetCardData]);

    // Get cost estimate when component mounts
    useEffect(() => {
        if (isOpen) {
            setCostEstimate({ estimated: 0.002 });
        }
    }, [isOpen]);

    const resetCardData = useCallback(() => {
        Object.values(cardData).forEach(side => {
            if (side.previewUrl && side.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(side.previewUrl);
            }
        });
        setCardData({
            front: { image: null, previewUrl: null },
            back: { image: null, previewUrl: null }
        });
    }, [cardData]);

    const handleFileSelect = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                toast.error(t('business_card_scanner.invalid_file_type') || 'Invalid file type');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                toast.error(t('business_card_scanner.file_too_large') || 'File too large');
                return;
            }
        }

        try {
            if (files.length === 1) {
                const file = files[0];
                const url = URL.createObjectURL(file);
                
                setCardData(prev => {
                    if (prev[currentSide].previewUrl && prev[currentSide].previewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(prev[currentSide].previewUrl);
                    }
                    return {
                        ...prev,
                        [currentSide]: { image: file, previewUrl: url }
                    };
                });
                
                toast.success(scanMode === 'single' 
                    ? 'Card image uploaded successfully!' 
                    : `${currentSide} side uploaded successfully!`);
            } else if (files.length === 2 && scanMode === 'double') {
                const [frontFile, backFile] = files;
                const frontUrl = URL.createObjectURL(frontFile);
                const backUrl = URL.createObjectURL(backFile);
                
                setCardData(prev => {
                    Object.values(prev).forEach(side => {
                        if (side.previewUrl && side.previewUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(side.previewUrl);
                        }
                    });
                    return {
                        front: { image: frontFile, previewUrl: frontUrl },
                        back: { image: backFile, previewUrl: backUrl }
                    };
                });
                
                toast.success('Both card sides uploaded successfully!');
            } else {
                toast.error('Please select the correct number of images for your scan mode.');
            }
        } catch (error) {
            console.error('Error processing files:', error);
            toast.error(t('business_card_scanner.image_load_failed') || 'Image load failed');
        }
        
        event.target.value = '';
    };

    const handleClose = () => {
        stopCamera();
        resetCardData();
        setIsProcessing(false);
        setScanMode('single');
        setCurrentSide('front');
        onClose();
    };//

    const handleRetake = () => {
        if (scanMode === 'single' || currentSide === 'front') {
            resetCardData();
            setCurrentSide('front');
        } else {
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

    const hasAnyImages = () => cardData.front.image || cardData.back.image;
    const canProcess = () => scanMode === 'single' ? cardData.front.image : cardData.front.image && cardData.back.image;

    if (!currentUser || !isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-4xl h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                
                <ScannerHeader 
                    costEstimate={costEstimate}
                    scanMode={scanMode}
                    onClose={handleClose}
                    isProcessing={isProcessing}
                />

                <div className="flex-1 overflow-y-auto min-h-0">
                    {!showCamera && !hasAnyImages() && (
                        <InitialScreen
                            scanMode={scanMode}
                            setScanMode={setScanMode}
                            startCamera={startCamera}
                            fileInputRef={fileInputRef}
                            isProcessing={isProcessing}
                        />
                    )}

                    {showCamera && (
                        <CameraView
                            videoRef={videoRef}
                            scanMode={scanMode}
                            currentSide={currentSide}
                            cardData={cardData}
                            capturePhoto={capturePhoto}
                            stopCamera={stopCamera}
                            isProcessing={isProcessing}
                        />
                    )}

                    {!showCamera && hasAnyImages() && (
                        <PreviewScreen
                            scanMode={scanMode}
                            currentSide={currentSide}
                            setCurrentSide={setCurrentSide}
                            cardData={cardData}
                            canProcess={canProcess}
                            handleRetake={handleRetake}
                            startCamera={startCamera}
                            fileInputRef={fileInputRef}
                            processImages={processImages}
                            isProcessing={isProcessing}
                            processingStatus={processingStatus}
                            costEstimate={costEstimate}
                        />
                    )}

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

                    <canvas ref={canvasRef} className="hidden" />
                </div>
            </div>
        </div>
    );
}