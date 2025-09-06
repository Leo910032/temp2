// app/[userId]/elements/themes/SnowFall.jsx
import "./style/snow.css";

export default function SnowFall() {
    return (
        <div className="fixed h-screen w-screen top-0 left-0 overflow-hidden pointer-events-none z-0">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900"></div>
            
            {/* Snow particles */}
            <div className="snow-container">
                {/* Create multiple snow particles */}
                {[...Array(50)].map((_, i) => (
                    <div
                        key={i}
                        className="snowflake"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            animationDuration: `${3 + Math.random() * 2}s`
                        }}
                    >
                        ❄
                    </div>
                ))}
            </div>
        </div>
    );
}