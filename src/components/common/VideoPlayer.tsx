import React, { useState, useEffect } from 'react';
import { AlertCircle, Play, Loader } from 'lucide-react';

interface VideoPlayerProps {
    url: string | undefined;
    className?: string;
    poster?: string;
    autoPlay?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, className = "", poster, autoPlay = false }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError(false);
        const timer = setTimeout(() => setLoading(false), 5000);
        return () => clearTimeout(timer);
    }, [url]);

    if (!url) {
        return (
            <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
                <div className="text-center">
                    <Play size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay video disponible</p>
                </div>
            </div>
        );
    }

    const getVideoContent = () => {
        // YouTube
        // Regex handles:
        // - youtube.com/watch?v=VIDEO_ID
        // - youtu.be/VIDEO_ID
        // - youtube.com/embed/VIDEO_ID
        // - youtube.com/v/VIDEO_ID
        // - youtube.com/shorts/VIDEO_ID
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const ytMatch = url.match(youtubeRegex);

        if (ytMatch && ytMatch[1]) {
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            return (
                <iframe
                    src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=${autoPlay ? 1 : 0}&rel=0&origin=${origin}`}
                    title="YouTube video player"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="w-full h-full absolute top-0 left-0 z-10"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                        console.log("VideoPlayer: YouTube iframe loaded");
                        setLoading(false);
                    }}
                />
            );
        }

        // Vimeo
        const vimeoRegex = /(?:vimeo\.com\/(?:video\/|channels\/[^\/]+\/|groups\/[^\/]+\/videos\/)?|player\.vimeo\.com\/video\/)(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);

        if (vimeoMatch && vimeoMatch[1]) {
            return (
                <iframe
                    src={`https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=${autoPlay ? 1 : 0}`}
                    title="Vimeo video player"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="w-full h-full absolute top-0 left-0 z-10"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    onLoad={() => {
                        console.log("VideoPlayer: Vimeo iframe loaded");
                        setLoading(false);
                    }}
                />
            );
        }

        // Local / Direct file
        // Check for extension OR if it starts with /uploads/ (our local path)
        const isLocal = url.startsWith('/uploads/') || /\.(mp4|webm|ogg|mov)$/i.test(url);

        if (isLocal) {
            return (
                <video
                    src={url}
                    controls
                    preload="metadata"
                    className="w-full h-full object-contain absolute top-0 left-0 z-10"
                    poster={poster}
                    autoPlay={autoPlay}
                    width="1280"
                    height="720"
                    onError={() => {
                        console.error("VideoPlayer: Local video error");
                        setError(true);
                    }}
                    onLoadedData={() => {
                        console.log("VideoPlayer: Local video loaded");
                        setLoading(false);
                    }}
                >
                    Tu navegador no soporta la reproducción de video.
                </video>
            );
        }

        // Unknown format - Turn off loading immediately
        if (loading) setLoading(false);

        return (
            <div className="flex flex-col items-center justify-center w-full h-full bg-gray-900 text-white p-4 text-center absolute top-0 left-0">
                <AlertCircle size={32} className="mb-2 text-yellow-500" />
                <p className="text-sm font-medium">Formato de video no reconocido</p>
                <p className="text-xs text-gray-400 mt-1 break-all max-w-full px-4">{url}</p>
                <p className="text-xs text-gray-500 mt-2">Intenta usar YouTube, Vimeo o subir un archivo MP4.</p>
            </div>
        );
    };

    return (
        <div className={`relative w-full pb-[56.25%] bg-black rounded-lg overflow-hidden ${className}`}>
            {/* 16:9 Aspect Ratio Container (pb-56.25%) */}

            {/* Loading State for Iframes/Video */}
            {loading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <Loader className="animate-spin text-gray-400" size={32} />
                </div>
            )}

            {error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
                    <div className="text-center">
                        <AlertCircle size={32} className="mx-auto mb-2 text-red-400" />
                        <p className="text-sm">Error al cargar el video</p>
                    </div>
                </div>
            ) : (
                getVideoContent()
            )}
        </div>
    );
};

export default VideoPlayer;
