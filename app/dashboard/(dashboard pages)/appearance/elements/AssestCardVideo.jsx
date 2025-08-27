export default function AssestCardVideo({
    coverImg, src, type, text, onClick, disabled = false
}) {
    return (
        <div className="flex-1 items-center flex flex-col">
            <video 
                className={`h-[13rem] w-full object-cover border rounded-lg hover:scale-105 active:scale-90 grid place-items-center cursor-pointer overflow-hidden ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                autoPlay 
                loop 
                playsInline 
                muted
                poster={coverImg}
                onClick={disabled ? undefined : onClick}
            >
                <source src={src} type={type} />
            </video>
            <span className="py-3 text-sm">{text}</span>
        </div>
    )
}