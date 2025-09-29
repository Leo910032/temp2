//lib/utils/
//  FIXED CLIENT-SIDE SCANNER - Enhanced Image Processing

/**
 * Enhanced image preprocessing before sending to API
 */
function preprocessImageForScanning(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        console.log('📸 Preprocessing image:', {
            name: file.name,
            size: file.size,
            type: file.type
        });

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            reject(new Error(`Unsupported file type: ${file.type}. Please use JPEG, PNG, or WebP.`));
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            reject(new Error('File too large. Maximum size is 10MB.'));
            return;
        }

        // Validate minimum size (1KB)
        if (file.size < 1024) {
            reject(new Error('File too small. Minimum size is 1KB.'));
            return;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = function() {
            try {
                console.log('🖼️ Original image dimensions:', { width: img.width, height: img.height });

                // Calculate optimal dimensions (max 2048px on longest side for better OCR)
                let { width, height } = img;
                const maxDimension = 2048;
                
                if (width > maxDimension || height > maxDimension) {
                    const ratio = Math.min(maxDimension / width, maxDimension / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                    console.log('📏 Resizing image to:', { width, height });
                }

                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;

                // Enhanced image processing for better OCR
                // 1. Draw image with high quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // 2. Apply contrast enhancement for better text recognition
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // Simple contrast enhancement
                const contrast = 1.2; // Slight contrast boost
                const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));     // Red
                    data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128)); // Green
                    data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128)); // Blue
                    // Alpha channel (i + 3) stays the same
                }

                ctx.putImageData(imageData, 0, 0);

                // 3. Convert to high-quality JPEG (good compression + quality balance)
                const quality = 0.92; // High quality for OCR
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Failed to create blob from canvas'));
                        return;
                    }

                    console.log('✅ Image processed:', {
                        originalSize: file.size,
                        processedSize: blob.size,
                        dimensions: `${width}x${height}`,
                        compression: ((file.size - blob.size) / file.size * 100).toFixed(1) + '%'
                    });

                    // Convert blob to base64
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const result = e.target.result;
                        
                        // Validate the result
                        if (!result || typeof result !== 'string') {
                            reject(new Error('Failed to read processed image'));
                            return;
                        }

                        // Ensure it's a proper data URL
                        if (!result.startsWith('data:image/')) {
                            reject(new Error('Invalid data URL format'));
                            return;
                        }

                        console.log('📤 Final base64 size:', (result.length / 1024).toFixed(1) + 'KB');
                        
                        resolve({
                            dataURL: result,
                            base64: result.split(',')[1], // Extract just the base64 part
                            originalFile: file,
                            processedSize: blob.size,
                            dimensions: { width, height }
                        });
                    };

                    reader.onerror = function() {
                        reject(new Error('Failed to read processed image as base64'));
                    };

                    reader.readAsDataURL(blob);
                }, 'image/jpeg', quality);

            } catch (error) {
                console.error('❌ Image processing error:', error);
                reject(new Error(`Image processing failed: ${error.message}`));
            }
        };

        img.onerror = function() {
            reject(new Error('Failed to load image. The file may be corrupted.'));
        };

        // Load the image
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.onerror = function() {
            reject(new Error('Failed to read image file'));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Version corrigée de scanBusinessCard avec debug détaillé
 */
export async function scanBusinessCard(imageData) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        // DEBUG: Logs détaillés pour identifier le problème
        console.log('🔍 DEBUGGING scanBusinessCard input:', {
            type: typeof imageData,
            constructor: imageData?.constructor?.name,
            length: imageData?.length,
            isFile: imageData instanceof File,
            isEvent: imageData?.target !== undefined,
            keys: typeof imageData === 'object' ? Object.keys(imageData || {}) : 'not object',
            firstChars: typeof imageData === 'string' ? imageData.substring(0, 50) : 'not string'
        });

        let processedBase64 = '';

        // CAS 1: File object direct
        if (imageData instanceof File) {
            console.log('📁 Processing File object:', imageData.name, imageData.size, 'bytes');
            processedBase64 = await convertFileToBase64(imageData);
        }
        // CAS 2: Event object du file input
        else if (imageData?.target?.files?.[0]) {
            console.log('📂 Processing file from event');
            const file = imageData.target.files[0];
            console.log('📁 File from event:', file.name, file.size, 'bytes');
            processedBase64 = await convertFileToBase64(file);
        }
        // CAS 3: Data URL string
        else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
            console.log('🔗 Processing data URL, length:', imageData.length);
            const base64Part = imageData.split(',')[1];
            if (!base64Part || base64Part.length < 100) {
                throw new Error(`Data URL seems invalid - base64 part too short: ${base64Part?.length || 0} chars`);
            }
            processedBase64 = base64Part;
        }
        // CAS 4: Pure base64 string
        else if (typeof imageData === 'string' && imageData.length > 100) {
            console.log('📝 Processing pure base64 string');
            // Vérifier que c'est vraiment du base64
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(imageData)) {
                throw new Error('String provided is not valid base64');
            }
            processedBase64 = imageData;
        }
        // CAS 5: Object avec propriété imageBase64
        else if (imageData?.imageBase64) {
            console.log('📦 Processing object with imageBase64 property');
            if (imageData.imageBase64.startsWith('data:image/')) {
                const base64Part = imageData.imageBase64.split(',')[1];
                if (!base64Part || base64Part.length < 100) {
                    throw new Error(`imageBase64 property seems invalid - too short: ${base64Part?.length || 0} chars`);
                }
                processedBase64 = base64Part;
            } else {
                processedBase64 = imageData.imageBase64;
            }
        }
        else {
            // ERREUR: Format non supporté
            throw new Error(`Unsupported input format. Got: ${typeof imageData}, constructor: ${imageData?.constructor?.name}, has target: ${!!imageData?.target}, has files: ${!!imageData?.target?.files}`);
        }

        // Validation finale
        if (!processedBase64 || processedBase64.length < 100) {
            throw new Error(`Processed base64 is too short (${processedBase64?.length || 0} chars). This suggests the image wasn't processed correctly.`);
        }

        // Vérifier que c'est vraiment du base64 valide
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(processedBase64)) {
            throw new Error('Final processed string is not valid base64');
        }

        console.log('✅ Base64 processing successful:', {
            length: processedBase64.length,
            estimatedSizeKB: Math.round(processedBase64.length * 0.75 / 1024 * 100) / 100,
            firstChars: processedBase64.substring(0, 50),
            lastChars: processedBase64.substring(processedBase64.length - 10)
        });

        // Préparer la requête
        const requestPayload = {
            imageBase64: processedBase64
        };

        // Obtenir le token d'auth
        const token = await user.getIdToken(false);
        
        console.log('📡 Sending request to API...');
        
        // Faire la requête API
        const response = await fetch('/api/user/contacts/scan', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestPayload)
        });

        console.log(`📡 API response status: ${response.status}`);

        if (!response.ok) {
            let errorMessage = 'Scan failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                console.error('❌ API error response:', errorData);
            } catch (parseError) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                console.error('❌ Failed to parse error response:', parseError);
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        
        console.log('✅ Business card scan completed:', {
            success: result.success,
            fieldsFound: result.parsedFields?.length || 0,
            method: result.metadata?.processingMethod || 'unknown'
        });

        return result;
        
    } catch (error) {
        console.error('❌ scanBusinessCard error:', error);
        
        // Retourner une réponse d'erreur conviviale
        return {
            success: false,
            error: error.message,
            parsedFields: [
                { label: 'Name', value: '', type: 'standard' },
                { label: 'Email', value: '', type: 'standard' },
                { label: 'Phone', value: '', type: 'standard' },
                { label: 'Company', value: '', type: 'standard' },
                { label: 'Job Title', value: '', type: 'custom' },
                { label: 'Note', value: `Scan failed: ${error.message}. Please fill manually.`, type: 'custom' }
            ],
            metadata: {
                hasQRCode: false,
                fieldsCount: 6,
                fieldsWithData: 1,
                hasRequiredFields: false,
                processedAt: new Date().toISOString(),
                processingMethod: 'error_fallback',
                note: `Scanning error: ${error.message}`
            }
        };
    }
}
/**
 * Fonction utilitaire pour convertir un File en base64
 */
/**
 * Fonction utilitaire pour convertir un File ou Blob en base64
 */
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided to convertFileToBase64'));
            return;
        }

        console.log('🔄 Converting file/blob to base64:', {
            name: file.name || 'unnamed blob',
            size: file.size,
            type: file.type,
            isFile: file instanceof File,
            isBlob: file instanceof Blob
        });

        // Vérifications de base
        if (file.size === 0) {
            reject(new Error('File is empty (0 bytes)'));
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            reject(new Error('File too large (max 15MB)'));
            return;
        }

        // Validation du type MIME pour les images
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (file.type && !validTypes.includes(file.type)) {
            reject(new Error(`Invalid file type: ${file.type}. Must be JPEG, PNG, WebP, or GIF.`));
            return;
        }

        // Si pas de type MIME mais c'est un Blob, on assume que c'est une image
        if (!file.type && file instanceof Blob) {
            console.warn('⚠️ Blob has no MIME type, assuming it\'s an image');
        }

        const reader = new FileReader();
        
        reader.onload = function(event) {
            try {
                const result = event.target.result;
                
                if (!result) {
                    reject(new Error('FileReader returned empty result'));
                    return;
                }

                if (typeof result !== 'string') {
                    reject(new Error('FileReader result is not a string'));
                    return;
                }

                if (!result.startsWith('data:')) {
                    reject(new Error('FileReader result is not a data URL'));
                    return;
                }

                // Extraire la partie base64
                const base64Part = result.split(',')[1];
                
                if (!base64Part) {
                    reject(new Error('Could not extract base64 part from data URL'));
                    return;
                }

                if (base64Part.length < 100) {
                    reject(new Error(`Base64 result too short: ${base64Part.length} chars`));
                    return;
                }

                console.log('✅ File/Blob converted to base64:', {
                    originalSize: file.size,
                    base64Length: base64Part.length,
                    estimatedSize: Math.round(base64Part.length * 0.75),
                    compression: Math.round((1 - (base64Part.length * 0.75) / file.size) * 100) + '%'
                });

                resolve(base64Part);
                
            } catch (error) {
                reject(new Error(`Error processing FileReader result: ${error.message}`));
            }
        };

        reader.onerror = function() {
            reject(new Error('FileReader failed to read the file/blob'));
        };

        reader.onabort = function() {
            reject(new Error('FileReader was aborted'));
        };

        // Lire le fichier ou blob comme data URL
        reader.readAsDataURL(file);
    });
}
/**
 * Gestionnaire d'événement pour input file - Version corrigée
 */
export function handleBusinessCardUpload(event, onSuccess, onError) {
    console.log('📤 handleBusinessCardUpload called');
    
    const file = event.target.files[0];
    
    if (!file) {
        console.warn('⚠️ No file selected');
        onError(new Error('No file selected'));
        return;
    }

    console.log('📁 File selected:', {
        name: file.name,
        size: file.size,
        type: file.type
    });

    // Tester d'abord la conversion
    testImageConversion(file)
        .then(base64 => {
            console.log('✅ Image conversion test passed, starting scan...');
            
            // Utiliser directement le File object
            return scanBusinessCard(file);
        })
        .then(result => {
            console.log('✅ Scan completed:', result);
            onSuccess(result);
        })
        .catch(error => {
            console.error('❌ Upload/scan failed:', error);
            onError(error);
        });
}


/**
 * Fonction pour tester la conversion d'image
 */
export function testImageConversion(file) {
    console.log('🧪 Testing image conversion...');
    
    return convertFileToBase64(file)
        .then(base64 => {
            console.log('✅ Test successful:', {
                base64Length: base64.length,
                firstChars: base64.substring(0, 50),
                isValidBase64: /^[A-Za-z0-9+/]*={0,2}$/.test(base64)
            });
            return base64;
        })
        .catch(error => {
            console.error('❌ Test failed:', error);
            throw error;
        });
}
/**
 * Helper function to handle file input changes
 */
export function handleFileInputForScanning(event, onSuccess, onError) {
    const file = event.target.files[0];
    
    if (!file) {
        onError(new Error('No file selected'));
        return;
    }

    console.log('📁 File selected for scanning:', {
        name: file.name,
        size: file.size,
        type: file.type
    });

    // Validate file immediately
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        onError(new Error(`Please select a valid image file (JPEG, PNG, or WebP). Selected: ${file.type}`));
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        onError(new Error('Image file too large. Please select a file smaller than 10MB.'));
        return;
    }

    if (file.size < 1024) {
        onError(new Error('Image file too small. Please select a larger image.'));
        return;
    }

    // Process the file
    scanBusinessCard(file)
        .then(result => {
            if (result.success) {
                onSuccess(result);
            } else {
                onError(new Error(result.error || 'Scanning failed'));
            }
        })
        .catch(error => {
            onError(error);
        });
}
/**
 * Helper function to create image preview
 */
export function createImagePreview(file, onLoad, onError) {
    if (!file) {
        onError(new Error('No file provided'));
        return;
    }

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        
        img.onload = function() {
            onLoad({
                dataURL: e.target.result,
                width: img.width,
                height: img.height,
                size: file.size,
                name: file.name
            });
        };
        
        img.onerror = function() {
            onError(new Error('Failed to load image preview'));
        };
        
        img.src = e.target.result;
    };
    
    reader.onerror = function() {
        onError(new Error('Failed to read image file'));
    };
    
    reader.readAsDataURL(file);
}
/**
 * Helper function to validate image before processing
 */
export function validateImageFile(file) {
    const errors = [];
    
    if (!file) {
        errors.push('No file provided');
        return { isValid: false, errors };
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        errors.push(`Unsupported file type: ${file.type}. Please use JPEG, PNG, or WebP.`);
    }
    
    // Check file size
    if (file.size > 10 * 1024 * 1024) {
        errors.push('File too large. Maximum size is 10MB.');
    }
    
    if (file.size < 1024) {
        errors.push('File too small. Minimum size is 1KB.');
    }
    
    // Check file name
    if (file.name.length > 255) {
        errors.push('File name too long.');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        fileInfo: {
            name: file.name,
            size: file.size,
            type: file.type,
            sizeFormatted: formatFileSize(file.size)
        }
    };
}
/**
 * Alternative: Gestionnaire avec preprocessing manuel
 */
export function handleBusinessCardUploadWithPreprocessing(event, onSuccess, onError) {
    console.log('📤 handleBusinessCardUploadWithPreprocessing called');
    
    const file = event.target.files[0];
    
    if (!file) {
        onError(new Error('No file selected'));
        return;
    }

    // Convertir manuellement d'abord
    convertFileToBase64(file)
        .then(base64 => {
            console.log('✅ Manual conversion successful, length:', base64.length);
            
            // Passer le base64 string directement
            return scanBusinessCard(base64);
        })
        .then(result => {
            onSuccess(result);
        })
        .catch(error => {
            onError(error);
        });
}

/**
 * Helper function to format file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Example React component usage
 */
export function BusinessCardScannerComponent() {
    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState(null);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        
        if (!file) {
            setError('No file selected');
            return;
        }

        // Validate file
        const validation = validateImageFile(file);
        if (!validation.isValid) {
            setError(validation.errors.join(' '));
            return;
        }

        // Clear previous results
        setError(null);
        setScanResult(null);
        
        // Create preview
        createImagePreview(file, 
            (previewData) => {
                setPreview(previewData);
                
                // Start scanning
                setIsScanning(true);
                scanBusinessCard(file)
                    .then(result => {
                        setScanResult(result);
                        if (!result.success) {
                            setError(result.error);
                        }
                    })
                    .catch(err => {
                        setError(err.message);
                    })
                    .finally(() => {
                        setIsScanning(false);
                    });
            },
            (err) => {
                setError(err.message);
            }
        );
    };

    const resetScanner = () => {
        setScanResult(null);
        setError(null);
        setPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="business-card-scanner">
            <div className="scanner-input">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileSelect}
                    disabled={isScanning}
                    className="file-input"
                />

                {preview && (
                    <div className="image-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={preview.dataURL}
                            alt="Business card preview"
                            style={{ maxWidth: '300px', maxHeight: '200px' }}
                        />
                        <p>
                            {preview.name} ({preview.sizeFormatted}) - 
                            {preview.width}x{preview.height}
                        </p>
                    </div>
                )}
            </div>

            {isScanning && (
                <div className="scanning-status">
                    <p>🔍 Scanning business card...</p>
                    <div className="progress-indicator">Processing image...</div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <p>❌ Error: {error}</p>
                    <button onClick={resetScanner}>Try Again</button>
                </div>
            )}

            {scanResult && scanResult.success && (
                <div className="scan-results">
                    <h3>✅ Scan Results ({scanResult.metadata?.processingMethod})</h3>
                    {scanResult.parsedFields.map((field, index) => (
                        <div key={index} className="field-result">
                            <label>{field.label}:</label>
                            <input 
                                type="text" 
                                value={field.value} 
                                onChange={(e) => {
                                    // Handle field updates
                                    const updatedFields = [...scanResult.parsedFields];
                                    updatedFields[index].value = e.target.value;
                                    setScanResult({
                                        ...scanResult,
                                        parsedFields: updatedFields
                                    });
                                }}
                            />
                        </div>
                    ))}
                    
                    <div className="scan-metadata">
                        <p>📊 Found {scanResult.metadata?.fieldsWithData || 0} fields with data</p>
                        {scanResult.metadata?.hasQRCode && <p>🔳 QR Code detected</p>}
                    </div>
                </div>
            )}
        </div>
    );
}