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
            const results = [];
            
            // Process each side separately using YOUR backend API
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

                // ✅ CRITICAL: Call YOUR backend API, not Google directly
                const response = await fetch('/api/user/contacts/scan', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        imageBase64: base64,
                        side: side
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
                        success: true,
                        fields: scanResult.standardFields || [],
                        dynamicFields: scanResult.dynamicFields || [],
                        metadata: scanResult.metadata || {}
                    });
                    
                    toast.success(`${side} side scanned successfully!`);
                } else {
                    throw new Error(scanResult.error || `${side} side scan failed`);
                }
            }

            // Merge results from both sides if double-sided
            let finalStandardFields, finalDynamicFields;
            if (results.length === 1) {
                finalStandardFields = results[0].fields;
                finalDynamicFields = results[0].dynamicFields || [];
            } else {
                const mergedResult = mergeCardSideResults(results);
                finalStandardFields = mergedResult.standardFields || [];
                finalDynamicFields = mergedResult.dynamicFields || [];
            }

            const enhancedFields = {
                standardFields: finalStandardFields,
                dynamicFields: finalDynamicFields,
                metadata: {
                    ...results[0]?.metadata,
                    totalFields: finalStandardFields.length + finalDynamicFields.length,
                    enhancedProcessing: true
                }
            };

            setDynamicFields(finalDynamicFields);
            setScanMetadata(enhancedFields.metadata);

            onContactParsed(enhancedFields);

            toast.success(`Card scanning complete! Found ${finalStandardFields.length} standard fields and ${finalDynamicFields.length} dynamic fields.`);

            // Show cost summary if available
            let totalCost = 0;
            results.forEach(result => {
                if (result.metadata?.cost) {
                    totalCost += result.metadata.cost;
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
            
            if (error.message.includes('subscription') || error.message.includes('budget') || error.message.includes('PLAN_LIMIT_EXCEEDED')) {
                toast.error('Business card scanning requires a valid subscription or you have exceeded your plan limits', { duration: 4000 });
            } else if (error.message.includes('rate limit')) {
                toast.error('Too many scan requests. Please try again later.', { duration: 4000 });
            } else if (error.message.includes('Unauthorized') || error.message.includes('Authorization')) {
                toast.error('Please log in again to continue', { duration: 4000 });
            } else if (error.message.includes('This feature requires')) {
                toast.error(error.message, { duration: 4000 });
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