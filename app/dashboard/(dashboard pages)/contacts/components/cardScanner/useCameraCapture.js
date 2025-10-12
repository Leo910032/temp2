// app/dashboard/(dashboard pages)/contacts/components/cardScanner/useCameraCapture.js
import { toast } from 'react-hot-toast';

const formatMessage = (template, replacements = {}) => {
    return Object.entries(replacements).reduce(
        (acc, [key, value]) => acc.split(`{{${key}}}`).join(value ?? ''),
        template
    );
};

export function useCameraCapture({
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
}) {
    const translateWithFallback = (key, fallback, replacements = {}) => {
        const template = t(key);
        const resolved = template && template !== key ? template : fallback;
        return formatMessage(resolved, replacements);
    };

    const getSideLabel = (side) =>
        translateWithFallback(
            `business_card_scanner.sides.${side}`,
            side.charAt(0).toUpperCase() + side.slice(1)
        );

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
            toast.error(
                translateWithFallback(
                    'business_card_scanner.camera_access_error',
                    'Camera access error'
                )
            );
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
            
            setCardData(prev => {
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

            if (scanMode === 'double' && currentSide === 'front') {
                setCurrentSide('back');
                toast.success(
                    translateWithFallback(
                        'business_card_scanner.capture_prompt_next_side',
                        '{{current}} captured! Now capture the {{next}} side.',
                        {
                            current: getSideLabel('front'),
                            next: getSideLabel('back')
                        }
                    )
                );
            } else {
                stopCamera();
                toast.success(
                    scanMode === 'double'
                        ? translateWithFallback(
                              'business_card_scanner.capture_success_double',
                              'Both sides captured successfully!'
                          )
                        : translateWithFallback(
                              'business_card_scanner.capture_success_single',
                              'Card captured successfully!'
                          )
                );
            }
        }, 'image/jpeg', 0.9);
    };

    return { startCamera, stopCamera, capturePhoto };
}
