// app/dashboard/(dashboard pages)/contacts/components/scanner/CameraView.jsx
export function CameraView({ videoRef, scanMode, currentSide, cardData, capturePhoto, stopCamera, isProcessing }) {
    return (
        <div className="p-3 sm:p-4 flex flex-col items-center min-h-full">
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
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative">
                            <div 
                                className="border-2 border-white border-dashed rounded-lg"
                                style={{
                                    width: typeof window !== 'undefined' && window.innerWidth < 640 ? '200px' : '280px',
                                    height: typeof window !== 'undefined' && window.innerWidth < 640 ? '130px' : '180px',
                                    aspectRatio: '85.6/53.98'
                                }}
                            >
                                <div className="absolute -top-1 -left-1 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-t-2 sm:border-l-4 sm:border-t-4 border-yellow-400"></div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-t-2 sm:border-r-4 sm:border-t-4 border-yellow-400"></div>
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-b-2 sm:border-l-4 sm:border-b-4 border-yellow-400"></div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-b-2 sm:border-r-4 sm:border-b-4 border-yellow-400"></div>
                            </div>
                            
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        </svg>
                        <span className="hidden sm:inline">
                            Capture {scanMode === 'double' ? currentSide : 'Photo'}
                        </span>
                        <span className="sm:hidden">Capture</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CameraView;
