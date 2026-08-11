import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ServiceCard from './ServiceCard';

interface ServiceCarouselProps {
    services: any[];
    title?: string;
    onServiceClick: (id: string) => void;
    autoPlayInterval?: number;
    showControls?: boolean;
}

const ServiceCarousel: React.FC<ServiceCarouselProps> = ({
    services,
    title,
    onServiceClick,
    autoPlayInterval = 5000,
    showControls = true
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Responsive items per slide
    const [itemsPerSlide, setItemsPerSlide] = useState(4);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) setItemsPerSlide(1);
            else if (window.innerWidth < 1024) setItemsPerSlide(2);
            else setItemsPerSlide(4);
        };
        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate max pages
    const maxIndex = Math.max(0, Math.ceil(services.length / itemsPerSlide) - 1);

    // Auto-play logic
    useEffect(() => {
        if (!isPaused && maxIndex > 0) {
            const timer = setInterval(() => {
                setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
            }, autoPlayInterval);
            return () => clearInterval(timer);
        }
    }, [isPaused, maxIndex, autoPlayInterval]);

    const nextSlide = () => {
        setCurrentIndex(prev => (prev >= maxIndex ? 0 : prev + 1));
    };

    const prevSlide = () => {
        setCurrentIndex(prev => (prev <= 0 ? maxIndex : prev - 1));
    };

    // Slice services for current view
    // Note: For a smoother infinite carousel, we might need a more complex setup.
    // simpler pagination approach for now:
    const visibleServices = services.slice(
        currentIndex * itemsPerSlide,
        (currentIndex + 1) * itemsPerSlide
    );

    // Handle edge case where last page has fewer items, just show what's left
    // or wrap around if we want true carousel (requiring complex logic). 
    // Pagination approach is safer for limited implementation time.

    if (services.length === 0) return null;

    return (
        <div
            className="relative py-4 group"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {title && <h3 className="text-lg font-bold mb-4 px-1">{title}</h3>}

            <div className="overflow-hidden" ref={containerRef}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <AnimatePresence mode='popLayout'>
                        {/* 
                           To make it look like a carousel, we need to show ALL items but translate the container.
                           However, grid layout + slice is easier for responsive "pages".
                           Let's stick to "Pages" transition.
                        */}
                        {visibleServices.map((service) => (
                            <ServiceCard
                                key={`${service.id}-${currentIndex}`} // Force re-render for clean enter animation if needed, or use service.id
                                service={service}
                                onClick={() => onServiceClick(service.id)}
                                isSponsored={service.isSponsored}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Controls */}
            {services.length > itemsPerSlide && showControls && (
                <>
                    <button
                        onClick={(e) => { e.preventDefault(); prevSlide(); }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-20"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); nextSlide(); }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 z-20"
                    >
                        <ChevronRight size={24} />
                    </button>

                    {/* Dots */}
                    <div className="absolute bottom-[-20px] left-0 right-0 flex justify-center space-x-2">
                        {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentIndex(idx)}
                                className={`w-2 h-2 rounded-full transition-colors ${idx === currentIndex ? 'bg-brand-primary' : 'bg-gray-300'}`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ServiceCarousel;
