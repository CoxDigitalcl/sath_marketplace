import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StarIcon } from './IconComponents';
import { Heart, ImageIcon, MapPin, Monitor } from 'lucide-react';
import { api } from '../api/client';

interface ServiceCardProps {
    service: any;
    onClick: () => void;
    isSponsored?: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick, isSponsored }) => {
    // Cover image priority: cover_image_url > image_urls[0] > null (placeholder)
    const coverImage = service.cover_image_url || service.coverImageUrl || service.image_urls?.[0] || service.imageUrl || null;

    // Rating can be null if no reviews
    const hasRating = service.rating !== null && service.rating !== undefined && service.rating !== '0' && service.rating !== 0;
    const displayRating = hasRating ? parseFloat(service.rating).toFixed(1) : null;
    const hasCoverageLabel = Boolean(service.coverage_area || service.location || service.coverage_region_name);
    const isOnlineOnly = String(service.type || '').trim().toLowerCase() === 'online';
    const coverageLabel = service.coverage_area || service.location || service.coverage_region_name || (isOnlineOnly ? 'Servicio online' : 'Cobertura por confirmar');
    const CoverageIcon = !hasCoverageLabel && isOnlineOnly ? Monitor : MapPin;

    const [isFavorite, setIsFavorite] = useState(service.isFavorite || false);
    const [favLoading, setFavLoading] = useState(false);
    const [imgError, setImgError] = useState(false);

    const toggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (favLoading) return;
        setFavLoading(true);
        try {
            if (isFavorite) {
                await api.delete(`/favorites/${service.id}`);
                setIsFavorite(false);
            } else {
                await api.post('/favorites', { service_id: service.id });
                setIsFavorite(true);
            }
        } catch (error) {
            console.error("Error toggling favorite:", error);
        } finally {
            setFavLoading(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`bg-white rounded-lg border overflow-hidden group hover:shadow-xl transition-all duration-300 h-full flex flex-col cursor-pointer ${isSponsored ? 'border-brand-primary/30 ring-1 ring-brand-primary/10' : 'border-gray-200'}`}
            onClick={onClick}
        >
            <div className="relative h-48 overflow-hidden flex-shrink-0">
                {coverImage && !imgError ? (
                    <img
                        src={coverImage}
                        alt={service.title || service.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    /* Stylish gradient placeholder when no cover image */
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-50 to-brand-primary/10 flex flex-col items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-gray-300 mb-1" />
                        <span className="text-xs text-gray-400">Sin imagen</span>
                    </div>
                )}

                {isSponsored && (
                    <div className="absolute top-3 left-3 bg-brand-primary text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm uppercase tracking-wide z-10">
                        Patrocinado
                    </div>
                )}

                {/* Favorite Button - Top Right */}
                <button
                    onClick={toggleFavorite}
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white text-gray-400 hover:text-red-500 shadow-sm z-20 transition-all duration-200"
                >
                    <Heart size={18} fill={isFavorite ? "#ef4444" : "none"} className={isFavorite ? "text-red-500" : ""} />
                </button>

                {/* Rating badge - Bottom Left */}
                <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-brand-dark shadow-sm flex items-center z-10">
                    {displayRating ? (
                        <>
                            <StarIcon className="h-3 w-3 text-yellow-400 fill-current mr-1" /> {displayRating}
                        </>
                    ) : (
                        <span className="text-brand-primary">Nuevo</span>
                    )}
                </div>
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-lg text-gray-900 mb-1 leading-tight line-clamp-1">
                    {service.title || service.name}
                </h3>
                <p className="text-sm text-gray-500 mb-2 line-clamp-1">por {service.provider_name || service.provider || 'Proveedor'}</p>
                <div className="mb-3 flex min-h-[24px] max-w-full items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                    <CoverageIcon size={13} className="h-3.5 w-3.5 flex-shrink-0 text-brand-primary" aria-hidden="true" />
                    <span className="min-w-0 truncate">{coverageLabel}</span>
                </div>

                <div className="mt-auto flex items-center justify-between">
                    <span className="text-lg font-bold text-brand-primary">
                        ${(typeof service.price === 'string' ? parseFloat(service.price) : (service.price || 0)).toLocaleString('es-CL')}
                        {service.priceUnit && <span className="text-xs text-gray-400 font-normal ml-1">{service.priceUnit}</span>}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        className="text-sm font-medium text-gray-600 hover:text-brand-primary transition-colors"
                    >
                        Ver detalle
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default ServiceCard;
