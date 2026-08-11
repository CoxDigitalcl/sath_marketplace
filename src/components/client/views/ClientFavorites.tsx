import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Calendar, Star as StarIcon, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';

interface FavoriteItem {
    id: string;
    favoriteId: string;
    type: 'service' | 'provider';
    name: string;
    provider: string;
    price: number;
    priceUnit?: string;
    rating: number;
    image: string;
    isAvailable: boolean;
}

const StarRating: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
            <StarIcon key={i} className={`h-4 w-4 ${i < Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
        ))}
        <span className="text-xs text-gray-600 ml-1">{rating.toFixed(1)}</span>
    </div>
);

const FavoriteCard: React.FC<{
    item: FavoriteItem;
    onRemove: (id: string) => void;
    onBook: (id: string) => void;
    isRemoving: boolean;
}> = ({ item, onRemove, onBook, isRemoving }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden group"
        >
            <div className="relative">
                <img className="h-48 w-full object-cover" src={item.image} alt={item.name} />
                <motion.button
                    whileHover={{ scale: 1.2, rotate: 5 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onRemove(item.id)}
                    disabled={isRemoving}
                    className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-full text-red-500 hover:text-red-600 disabled:opacity-50"
                    aria-label="Eliminar de favoritos"
                >
                    {isRemoving ? (
                        <Loader2 size={20} className="animate-spin" />
                    ) : (
                        <Heart size={20} fill="currentColor" />
                    )}
                </motion.button>
                <span className="absolute bottom-3 left-3 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-full">
                    Servicio
                </span>
            </div>
            <div className="p-4">
                <h3 className="font-bold text-gray-800 truncate">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.provider}</p>
                <div className="flex justify-between items-center mt-3">
                    <p className="text-md font-bold text-gray-900">
                        ${item.price.toLocaleString('es-CL')}
                        {item.priceUnit && <span className="text-xs font-normal text-gray-500">{item.priceUnit}</span>}
                    </p>
                    <StarRating rating={item.rating} />
                </div>
                <button
                    onClick={() => onBook(item.id)}
                    disabled={!item.isAvailable}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold py-2 px-4 rounded-md transition-colors duration-300 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                    <Calendar size={16} />
                    <span>{item.isAvailable ? 'Agendar Servicio' : 'No Disponible'}</span>
                </button>
            </div>
        </motion.div>
    );
};

const ClientFavorites: React.FC = () => {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const fetchFavorites = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/favorites');
            if (response.data.status === 'success') {
                setFavorites(response.data.favorites || []);
            } else {
                setError(response.data.message || 'Error al cargar favoritos');
            }
        } catch (err: any) {
            console.error('Error fetching favorites:', err);
            setError(err.response?.data?.message || 'Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFavorites();
    }, []);

    const handleRemoveFavorite = async (serviceId: string) => {
        try {
            setRemovingId(serviceId);
            await api.delete(`/favorites/${serviceId}`);
            setFavorites(favorites.filter(fav => fav.id !== serviceId));
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al eliminar favorito');
        } finally {
            setRemovingId(null);
        }
    };

    const handleBook = (serviceId: string) => {
        window.location.href = `/service/${serviceId}`;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Favoritos</h1>
                    <p className="mt-1 text-gray-600">Encuentra aquí todos los servicios que has guardado.</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <Loader2 className="h-12 w-12 text-gray-300 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-500">Cargando favoritos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Mis Favoritos</h1>
                    <p className="mt-1 text-gray-600">Encuentra aquí todos los servicios que has guardado.</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="text-red-700">{error}</p>
                    <button
                        onClick={fetchFavorites}
                        className="mt-4 text-red-600 hover:text-red-800 font-medium"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Mis Favoritos</h1>
                <p className="mt-1 text-gray-600">Encuentra aquí todos los servicios que has guardado.</p>
            </div>

            {favorites.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <AnimatePresence>
                        {favorites.map(item => (
                            <FavoriteCard
                                key={item.id}
                                item={item}
                                onRemove={handleRemoveFavorite}
                                onBook={handleBook}
                                isRemoving={removingId === item.id}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                    <Heart className="mx-auto h-16 w-16 text-gray-300" strokeWidth={1} />
                    <h3 className="mt-4 text-lg font-semibold text-gray-800">Aún no tienes favoritos</h3>
                    <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                        Haz clic en el corazón de los servicios que te interesen para guardarlos aquí y acceder rápidamente a ellos.
                    </p>
                    <button
                        onClick={() => window.location.href = '/search'}
                        className="mt-6 bg-brand-primary text-white font-semibold py-2 px-5 rounded-md hover:bg-orange-600 transition-colors"
                    >
                        Explorar Servicios
                    </button>
                </div>
            )}
        </div>
    );
};

export default ClientFavorites;
