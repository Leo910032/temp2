import { useTranslation } from "@/lib/translation/useTranslation"; // Make sure to import useTranslation

export function CameraView({ videoRef, scanMode, currentSide, cardData, capturePhoto, stopCamera, isProcessing }) {
    const { t } = useTranslation();

    return (
        // Main container: Full screen, fixed position, with a dark background
        <div className="fixed inset-0 bg-black z-50 flex flex-col md:hidden">

            {/* Video Feed: Fills the entire screen and is placed underneath the UI */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="absolute top-0 left-0 w-full h-full object-cover"
            />

            {/* UI Overlay: A flex container to position elements on top of the video */}
            <div className="relative z-10 flex flex-col flex-1 h-full p-4">

                {/* Top Bar: Close button and side indicator */}
                <div className="flex items-center justify-between">
                    {scanMode === 'double' && (
                        <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                            {t('business_card_scanner.sides.capturing', { side: currentSide }) || `Capturing: ${currentSide}`}
                        </div>
                    )}
                    <div className="flex-1"></div> {/* Spacer */}
                    <button
                        onClick={stopCamera}
                        disabled={isProcessing}
                        className="bg-black/50 text-white rounded-full p-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Middle Section: Card outline guide */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative">
                        <div 
                            className="border-2 border-white border-dashed rounded-lg"
                            style={{
                                width: '280px',
                                height: '180px',
                                aspectRatio: '85.6/53.98'
                            }}
                        >
                            {/* Corner brackets for a more professional look */}
                            <div className="absolute -top-1 -left-1 w-6 h-6 border-l-4 border-t-4 border-yellow-400"></div>
                            <div className="absolute -top-1 -right-1 w-6 h-6 border-r-4 border-t-4 border-yellow-400"></div>
                            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-l-4 border-b-4 border-yellow-400"></div>
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-r-4 border-b-4 border-yellow-400"></div>
                        </div>
                        <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap">
                            {t('business_card_scanner.position_card', { side: scanMode === 'double' ? currentSide : 'card' }) || `Position ${scanMode === 'double' ? currentSide : 'card'} within frame`}
                        </div>
                    </div>
                </div>

                {/* Bottom Bar: Capture button */}
                <div className="flex justify-center items-center h-24">
                    <button
                        onClick={capturePhoto}
                        disabled={isProcessing}
                        className="w-16 h-16 rounded-full bg-white flex items-center justify-center ring-4 ring-white/30 active:scale-95 transition-transform"
                        aria-label="Capture Photo"
                    >
                        {isProcessing ? (
                            <div className="w-8 h-8 border-4 border-gray-400 border-t-gray-700 rounded-full animate-spin"></div>
                        ) : (
                            <div className="w-14 h-14 rounded-full bg-white border-2 border-black"></div>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}