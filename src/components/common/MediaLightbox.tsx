import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, ImageIcon } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

export interface MediaItem {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
}

interface MediaLightboxProps {
    items: MediaItem[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
}

const MediaLightbox: React.FC<MediaLightboxProps> = ({ items, initialIndex = 0, isOpen, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            document.body.style.overflow = 'hidden';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen, initialIndex]);

    const goNext = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
    }, [items.length]);

    const goPrev = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') goNext();
            if (e.key === 'ArrowLeft') goPrev();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, goNext, goPrev]);

    // Touch/swipe support
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = () => {
        if (touchStartX.current === null || touchEndX.current === null) return;
        const diff = touchStartX.current - touchEndX.current;
        const threshold = 50;
        if (Math.abs(diff) > threshold) {
            if (diff > 0) goNext();
            else goPrev();
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    if (!isOpen || items.length === 0) return null;

    const currentItem = items[currentIndex];

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/85"
                onClick={onClose}
            />

            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Cerrar"
            >
                <X size={24} />
            </button>

            {/* Counter */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white/10 backdrop-blur-sm text-white text-sm font-medium px-4 py-1.5 rounded-full">
                {currentIndex + 1} / {items.length}
            </div>

            {/* Navigation arrows - desktop */}
            {items.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); goPrev(); }}
                        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-50 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110"
                        aria-label="Anterior"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); goNext(); }}
                        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-50 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/25 text-white transition-all hover:scale-110"
                        aria-label="Siguiente"
                    >
                        <ChevronRight size={24} />
                    </button>
                </>
            )}

            {/* Main content area */}
            <div
                className="relative z-40 w-full max-w-5xl mx-4 md:mx-8 flex items-center justify-center"
                style={{ maxHeight: 'calc(100vh - 120px)' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => e.stopPropagation()}
            >
                {currentItem.type === 'image' ? (
                    <img
                        key={currentItem.url}
                        src={currentItem.url}
                        alt={`Media ${currentIndex + 1}`}
                        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-fade-in select-none"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full max-w-4xl">
                        <VideoPlayer
                            key={currentItem.url}
                            url={currentItem.url}
                            autoPlay={true}
                            title={`Video multimedia ${currentIndex + 1}`}
                        />
                    </div>
                )}
            </div>

            {/* Thumbnail strip at bottom */}
            {items.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-sm max-w-[90vw] overflow-x-auto scrollbar-hide">
                    {items.map((item, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                            className={`relative flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                                idx === currentIndex
                                    ? 'ring-2 ring-white scale-110 shadow-lg'
                                    : 'opacity-60 hover:opacity-90 hover:scale-105'
                            }`}
                        >
                            {item.type === 'image' ? (
                                <img src={item.thumbnail || item.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                                    <Play size={16} className="text-white" fill="white" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* CSS animation */}
            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.25s ease-out; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default MediaLightbox;
