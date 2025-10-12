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
    guideRef,
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
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const guide = guideRef.current;

        if (!video || !canvas || !guide) return;

        const videoRect = video.getBoundingClientRect();
        const guideRect = guide.getBoundingClientRect();

        // Calcule les facteurs d'échelle entre la taille affichée de la vidéo et sa résolution native
        const scaleX = video.videoWidth / videoRect.width;
        const scaleY = video.videoHeight / videoRect.height;

        // Calcule les coordonnées du cadre de guidage par rapport à la vidéo
        const sx = (guideRect.left - videoRect.left) * scaleX;
        const sy = (guideRect.top - videoRect.top) * scaleY;
        const sWidth = guideRect.width * scaleX;
        const sHeight = guideRect.height * scaleY;

        // Définit la taille du canvas pour qu'elle corresponde à la zone découpée
        canvas.width = sWidth;
        canvas.height = sHeight;

        const context = canvas.getContext('2d');

        // Dessine uniquement la partie de la vidéo qui se trouve à l'intérieur du cadre de guidage
        context.drawImage(
            video,
            sx,       // Coordonnée X de départ dans la vidéo source
            sy,       // Coordonnée Y de départ dans la vidéo source
            sWidth,   // Largeur de la source à découper
            sHeight,  // Hauteur de la source à découper
            0,        // Coordonnée X de destination sur le canvas (coin supérieur gauche)
            0,        // Coordonnée Y de destination sur le canvas
            sWidth,   // Largeur de l'image à dessiner sur le canvas
            sHeight   // Hauteur de l'image à dessiner sur le canvas
        );

        canvas.toBlob((blob) => {
            if (!blob) {
                toast.error(translateWithFallback('business_card_scanner.capture_failed', 'Capture failed'));
                return;
            }
            const newUrl = URL.createObjectURL(blob);

            setCardData(prev => {
                if (prev[currentSide].previewUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(prev[currentSide].previewUrl);
                }
                const updatedSide = { image: blob, previewUrl: newUrl };
                return { ...prev, [currentSide]: updatedSide };
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
        }, 'image/jpeg', 0.95);
    };

    return { startCamera, stopCamera, capturePhoto };
}
