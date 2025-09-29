// app/dashboard/(dashboard pages)/contacts/components/scanner/useImageProcessor.js
import { toast } from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

export function useImageProcessor({
    currentUser,
    cardData,
    scanMode,
    costEstimate,
    setIsProcessing,
    setProcessingStatus,
    setDynamicFields,
    setScanMetadata,
    onContactParsed
}) {
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
                fields.forEach(field => {
                    const key = field.label.toLowerCase();
                    const existingField = mergedStandardFields.get(key);

                    if (!existingField || field.confidence > existingField.confidence) {
                        mergedStandardFields.set(key, { ...field, side });
                    }
                });
            }

            if (dynamicFields) {
                dynamicFields.forEach(field => {
                    const key = `${field.label.toLowerCase()}_${side}`;
                    mergedDynamicFields.set(key, { ...field, side });
                });
            }

            if (sideMetadata?.hasQRCode) metadata.hasQRCode = true;
            if (sideMetadata?.cost) metadata.totalCost += sideMetadata.cost;
        });

        return {
            standardFields: Array.from(mergedStandardFields.values()),
            dynamicFields: Array.from(mergedDynamicFields.values())
        };
    };

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

  const processImages = async () => {
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
        if (costEstimate && costEstimate.estimated) {
            const totalCost = scanMode === 'double' 
                ? costEstimate.estimated * 2 
                : costEstimate.estimated;
            toast(`This will cost approximately $${totalCost.toFixed(4)} for scanning.`, { 
                duration: 3000,
                icon: '💰',
                style: { background: '#3b82f6', color: 'white' }
            });            
        }

        const token = await currentUser.getIdToken();
        let result;

        // ✅ NEW: Send both images together for double-sided mode
        if (scanMode === 'double') {
            setProcessingStatus('Compressing images...');
            
            // Compress both images
            const options = {
                maxSizeMB: 1.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.8
            };
            
            const [compressedFront, compressedBack] = await Promise.all([
                imageCompression(imagesToProcess.front, options),
                imageCompression(imagesToProcess.back, options)
            ]);

            // Convert both to base64
            const [frontBase64, backBase64] = await Promise.all([
                convertFileToBase64(compressedFront),
                convertFileToBase64(compressedBack)
            ]);

            setProcessingStatus('Scanning both sides together...');
            toast.loading('Processing both sides...', { id: 'scanning-both' });

            // Single API call with both images
            const response = await fetch('/api/user/contacts/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    frontImage: frontBase64,
                    backImage: backBase64,
                    scanMode: 'double'
                })
            });

            toast.dismiss('scanning-both');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            result = await response.json();

        } else {
            // Single side processing (existing logic)
            setProcessingStatus('Compressing image...');
            
            const options = {
                maxSizeMB: 1.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                initialQuality: 0.8
            };
            const compressedFile = await imageCompression(imagesToProcess.front, options);
            const base64 = await convertFileToBase64(compressedFile);

            setProcessingStatus('Scanning card...');
            toast.loading('Scanning...', { id: 'scanning-single' });

            const response = await fetch('/api/user/contacts/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    imageBase64: base64,
                    side: 'front'
                })
            });

            toast.dismiss('scanning-single');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            result = await response.json();
        }

        // Process result
        const finalStandardFields = result.standardFields || [];
        const finalDynamicFields = result.dynamicFields || [];

        const enhancedFields = {
            standardFields: finalStandardFields,
            dynamicFields: finalDynamicFields,
            metadata: {
                ...result.metadata,
                totalFields: finalStandardFields.length + finalDynamicFields.length,
                enhancedProcessing: true
            }
        };

        setDynamicFields(finalDynamicFields);
        setScanMetadata(enhancedFields.metadata);
        onContactParsed(enhancedFields);

        toast.success(`Card scanning complete! Found ${finalStandardFields.length} standard fields and ${finalDynamicFields.length} dynamic fields.`);

        if (result.metadata?.cost > 0) {
            toast(`Total cost: $${result.metadata.cost.toFixed(4)}`, { 
                duration: 4000,
                icon: '💰',
                style: { background: '#3b82f6', color: 'white' }
            });
        }

        if (result.metadata?.hasQRCode) {
            toast.success('QR Code detected and processed!', { duration: 3000 });
        }

    } catch (error) {
        console.error('Image processing error:', error);
        
        if (error.message.includes('subscription') || error.message.includes('PLAN_LIMIT_EXCEEDED')) {
            toast.error('Business card scanning requires a valid subscription or you have exceeded your plan limits', { duration: 4000 });
        } else if (error.message.includes('rate limit')) {
            toast.error('Too many scan requests. Please try again later.', { duration: 4000 });
        } else if (error.message.includes('Unauthorized')) {
            toast.error('Please log in again to continue', { duration: 4000 });
        } else {
            toast.error(error.message || 'Processing failed. Please try again.');
        }
    } finally {
        setIsProcessing(false);
        setProcessingStatus('');
    }
};

    return { processImages };
}