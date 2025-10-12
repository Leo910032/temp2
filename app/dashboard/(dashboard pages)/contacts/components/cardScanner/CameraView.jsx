// app/dashboard/(dashboard pages)/contacts/components/scanner/CameraView.jsx
export function CameraView({ videoRef, guideRef, scanMode, currentSide, cardData, capturePhoto, stopCamera, isProcessing }) {
    return (
        <div className="fixed inset-0 sm:relative sm:inset-auto bg-black sm:bg-transparent flex flex-col sm:p-3 sm:items-center sm:min-h-full z-50 sm:z-auto">
            {/* Double scan mode indicator - repositioned for mobile */}
            {scanMode === 'double' && (
                <div className="absolute top-0 left-0 right-0 sm:relative sm:mb-4 p-3 sm:p-3 bg-blue-900 bg-opacity-80 sm:bg-blue-50 sm:rounded-lg sm:border sm:border-blue-200 w-full sm:max-w-2xl z-10">
                    <div className="flex items-center justify-center gap-4">
                        <div className={`flex items-center gap-2 ${currentSide === 'front' ? 'text-white sm:text-blue-600 font-semibold' : 'text-gray-300 sm:text-gray-500'}`}>
                            {cardData.front.image ? '✅' : '📷'} Front
                        </div>
                        <div className="w-8 h-0.5 bg-gray-300"></div>
                        <div className={`flex items-center gap-2 ${currentSide === 'back' ? 'text-white sm:text-blue-600 font-semibold' : 'text-gray-300 sm:text-gray-500'}`}>
                            {cardData.back.image ? '✅' : '📷'} Back
                        </div>
                    </div>
                    <p className="text-sm text-white sm:text-blue-700 text-center mt-2">
                        Currently capturing: <strong>{currentSide} side</strong>
                    </p>
                </div>
            )}

            {/* Video container - full screen on mobile, centered on desktop */}
            <div className="relative w-full h-full sm:h-auto sm:max-w-2xl flex flex-col">
                <div className="relative bg-black flex-1 sm:flex-none sm:rounded-lg sm:rounded-xl overflow-hidden">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full sm:h-auto sm:min-h-[400px] object-cover"
                    />

                    {/* Card alignment guide overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative">
                            <div
                                ref={guideRef}
                                className="border-2 border-white border-dashed rounded-lg"
                                style={{
                                    width: typeof window !== 'undefined' && window.innerWidth < 640 ? '240px' : '280px',
                                    height: typeof window !== 'undefined' && window.innerWidth < 640 ? '155px' : '180px',
                                    aspectRatio: '85.6/53.98'
                                }}
                            >
                                <div className="absolute -top-1 -left-1 w-6 h-6 sm:w-6 sm:h-6 border-l-4 border-t-4 sm:border-l-4 sm:border-t-4 border-yellow-400"></div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-6 sm:h-6 border-r-4 border-t-4 sm:border-r-4 sm:border-t-4 border-yellow-400"></div>
                                <div className="absolute -bottom-1 -left-1 w-6 h-6 sm:w-6 sm:h-6 border-l-4 border-b-4 sm:border-l-4 sm:border-b-4 border-yellow-400"></div>
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-6 sm:h-6 border-r-4 border-b-4 sm:border-r-4 sm:border-b-4 border-yellow-400"></div>
                            </div>

                            <div className="absolute -bottom-10 sm:-bottom-12 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white text-sm sm:text-sm px-3 py-2 sm:px-3 sm:py-2 rounded-lg whitespace-nowrap">
                                Position {scanMode === 'double' ? currentSide : 'card'} within frame
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls - fixed to bottom on mobile, below video on desktop */}
                <div className="absolute bottom-0 left-0 right-0 sm:relative sm:bottom-auto sm:left-auto sm:right-auto p-4 sm:p-0 bg-gradient-to-t from-black via-black/80 to-transparent sm:bg-none sm:mt-3 sm:mt-4 pointer-events-auto">
                    <div className="flex gap-3 sm:gap-3 max-w-md mx-auto sm:max-w-full">
                        <button
                            onClick={stopCamera}
                            className="flex-1 px-4 py-3 sm:px-4 sm:py-3 text-white sm:text-gray-700 bg-gray-800 bg-opacity-50 sm:bg-gray-100 hover:bg-gray-700 sm:hover:bg-gray-200 rounded-lg transition-colors font-medium text-base sm:text-base border border-gray-600 sm:border-0"
                            disabled={isProcessing}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={capturePhoto}
                            className="flex-1 px-4 py-3 sm:px-4 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 text-base sm:text-base shadow-lg sm:shadow-none"
                            disabled={isProcessing}
                        >
                            <svg className="w-5 h-5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        </div>
    );
}

export default CameraView;
