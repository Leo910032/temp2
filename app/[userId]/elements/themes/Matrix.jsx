import React from 'react'

export default function MatrixBG({textColor}) {
    const canvasRef = React.useRef(null);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set initial canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();

        // Matrix rain configuration
        const fontSize = 16;
        const columns = Math.floor(canvas.width / fontSize);
        const drops = Array(columns).fill(0);
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

        // Drawing function
        const draw = () => {
            // Restore the fading effect - key to the matrix charm
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Slightly more opacity for clarity
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Set letter style
            ctx.fillStyle = '#0F0';
            ctx.font = `${fontSize}px monospace`;

            // Draw falling letters
            for (let i = 0; i < drops.length; i++) {
                const text = letters.charAt(Math.floor(Math.random() * letters.length));
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                // Reset drop if it falls out of screen
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.95) {
                    drops[i] = 0;
                }

                // Move drop down
                drops[i]++;
            }
        };

        // Set up animation interval
        const animationInterval = setInterval(draw, 50);

        // Add resize event listener
        window.addEventListener('resize', resizeCanvas);

        // Cleanup function
        return () => {
            clearInterval(animationInterval);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [textColor]); // Empty dependency array means this runs once on mount

    return (
        <div className="fixed h-screen w-screen z-0 top-0 left-0 overflow-hidden opacity-[90] bg-black">
            <canvas ref={canvasRef} className='h-full w-full opacity-50' style={{backgroundColor: '#121212'}}></canvas>
        </div>
    );
}