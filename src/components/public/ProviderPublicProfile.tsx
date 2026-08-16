import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ShieldCheck, MessageCircle, Clock, Calendar, Mail, Phone, CheckCircle, Share2, X, Facebook, Twitter, Linkedin, Link as LinkIcon } from 'lucide-react';
import { StarIcon } from '../IconComponents';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import toast from 'react-hot-toast';
import { buildServicePath } from '../../../shared/publicPaths.js';

interface ProviderPublicProfileProps {
    providerId?: string;
}

const ProviderPublicProfile: React.FC<ProviderPublicProfileProps> = ({ providerId }) => {
    const [activeTab, setActiveTab] = useState<'services' | 'reviews' | 'about'>('services');
    const [providerData, setProviderData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showShareMenu, setShowShareMenu] = useState(false);

    const { isAuthenticated } = useAuthStore();
    const [contactAccess, setContactAccess] = useState<{hasAccess: boolean, email?: string, phone?: string}>({hasAccess: false});

    const handleShare = async () => {
        const shareData = {
            title: `${providerData?.name || 'Proveedor'} | Servicios a tu Hogar`,
            text: providerData?.tagline || 'Encuentra al mejor profesional en Servicios a tu Hogar.',
            url: window.location.href
        };

        if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Error sharing natively', err);
            }
        } else {
            setShowShareMenu(!showShareMenu);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Enlace copiado al portapapeles');
        setShowShareMenu(false);
    };

    useEffect(() => {
        const fetchProfileAndAccess = async () => {
            if (!providerId) return;
            try {
                setLoading(true);
                // 1. Fetch public profile
                const res = await api.get(`/providers/${providerId}`);
                if (res.data.status === 'success') {
                    setProviderData(res.data.data);
                }

                // 2. Fetch contact access if authenticated
                if (isAuthenticated) {
                    const accessRes = await api.get(`/bookings/provider/${providerId}/has-access`);
                    if (accessRes.data.status === 'success' && accessRes.data.hasAccess) {
                        setContactAccess({
                            hasAccess: true,
                            email: accessRes.data.contactDetails.email,
                            phone: accessRes.data.contactDetails.phone
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to load provider profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfileAndAccess();
    }, [providerId, isAuthenticated]);

    if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando perfil...</div>;
    if (!providerData) return <div className="min-h-screen flex items-center justify-center">Proveedor no encontrado.</div>;
    const coverageCommunes = Array.isArray(providerData.coverage_communes) ? providerData.coverage_communes : [];
    const hasCoverage = Boolean(providerData.coverage_region_code && coverageCommunes.length > 0);

    return (
        <div className="bg-gray-50 min-h-screen pb-12">
            {/* Hero Banner */}
            <div className="h-48 md:h-64 bg-gradient-to-r from-brand-primary to-orange-400 relative">
                {providerData.banner_image_url && (
                    <img
                        src={providerData.banner_image_url}
                        alt={`Portada de ${providerData.name}`}
                        loading="eager"
                        decoding="async"
                        width="1440"
                        height="256"
                        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
                    />
                )}
                <div className="absolute inset-0 bg-black/10"></div>
            </div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16 md:-mt-20 z-10">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-visible relative z-20">
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row md:items-start gap-6">
                            {/* Avatar */}
                            <div className="flex-shrink-0 flex justify-center md:justify-start">
                                <img
                                    src={providerData.profile_image_url || `https://i.pravatar.cc/150?u=${providerData.id}`}
                                    alt={`Perfil de ${providerData.name}`}
                                    loading="eager"
                                    decoding="async"
                                    width="320"
                                    height="320"
                                    className="h-32 w-32 md:h-40 md:w-40 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                                />
                            </div>

                            {/* Info */}
                            <div className="flex-grow text-center md:text-left pt-2">
                                <div className="flex flex-col md:flex-row md:justify-between items-center md:items-start">
                                    <div>
                                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-2">
                                            {providerData.name}
                                            {providerData.verified && (
                                                <span title="Identidad Verificada" className="flex items-center">
                                                    <ShieldCheck className="text-green-500 h-6 w-6" />
                                                </span>
                                            )}
                                        </h1>
                                        <p className="text-gray-600 mt-1">{providerData.tagline}</p>
                                        <div className="flex items-center justify-center md:justify-start mt-2 text-sm text-gray-500 space-x-4">
                                            <span className="flex items-center"><MapPin size={14} className="mr-1" /> {providerData.location}</span>
                                            <span className="flex items-center"><Calendar size={14} className="mr-1" /> Miembro desde {providerData.joinedDate}</span>
                                        </div>
                                        {hasCoverage && (
                                            <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-800">
                                                <MapPin size={14} className="mr-1.5 flex-shrink-0" />
                                                <span className="truncate">Atiende {coverageCommunes.length} comuna{coverageCommunes.length === 1 ? '' : 's'} en {providerData.coverage_region_name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 md:mt-0 flex flex-col md:items-end space-y-2">
                                        {contactAccess.hasAccess ? (
                                            <div className="bg-green-50 text-green-800 p-3 rounded-md border border-green-200 text-sm w-full md:w-auto shadow-sm">
                                                <p className="font-semibold mb-2 flex items-center border-b border-green-200 pb-1"><CheckCircle size={16} className="mr-1"/> Contacto Desbloqueado</p>
                                                {contactAccess.email && <p className="flex items-center"><Mail size={14} className="mr-2 opacity-70"/> <a href={`mailto:${contactAccess.email}`} className="hover:underline">{contactAccess.email}</a></p>}
                                                {contactAccess.phone && <p className="flex items-center mt-2"><Phone size={14} className="mr-2 opacity-70"/> <a href={`tel:${contactAccess.phone}`} className="hover:underline">{contactAccess.phone}</a></p>}
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => toast('Para proteger la privacidad de nuestra comunidad, los datos de contacto directo se liberan tras contratar un servicio.', { icon: '🔒' })}
                                                className="px-4 py-2 border border-brand-primary rounded-md font-medium text-brand-primary hover:bg-brand-50 flex items-center justify-center w-full md:w-auto shadow-sm transition-colors"
                                            >
                                                <MessageCircle size={18} className="mr-2" /> Contactar
                                            </button>
                                        )}
                                        
                                        <div className="relative w-full md:w-auto z-50">
                                            <button 
                                                onClick={handleShare}
                                                className="px-4 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-orange-600 flex items-center justify-center w-full md:w-auto shadow-sm transition-colors mt-2 md:mt-0"
                                            >
                                                <Share2 size={18} className="mr-2" /> Compartir
                                            </button>

                                            {showShareMenu && (
                                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-2xl border border-gray-200 z-[60] overflow-hidden transform origin-top-right transition-all">
                                                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                        <span className="font-semibold text-sm text-gray-700">Compartir perfil</span>
                                                        <button onClick={() => setShowShareMenu(false)} className="text-gray-400 hover:text-gray-600">
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                    <div className="p-2 space-y-1">
                                                        <a 
                                                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(providerData?.name + ' | Servicios a tu Hogar' + '\\n' + window.location.href)}`} 
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-green-50 hover:text-green-600 rounded-md transition-colors"
                                                            onClick={() => setShowShareMenu(false)}
                                                        >
                                                            <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                                            WhatsApp
                                                        </a>
                                                        <a 
                                                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`} 
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-md transition-colors"
                                                            onClick={() => setShowShareMenu(false)}
                                                        >
                                                            <Facebook size={16} className="mr-3" /> Facebook
                                                        </a>
                                                        <a 
                                                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(providerData?.name + ' | Servicios a tu Hogar')}&url=${encodeURIComponent(window.location.href)}`} 
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                                            onClick={() => setShowShareMenu(false)}
                                                        >
                                                            <Twitter size={16} className="mr-3" /> Compartir en X
                                                        </a>
                                                        <a 
                                                            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} 
                                                            target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                                                            onClick={() => setShowShareMenu(false)}
                                                        >
                                                            <Linkedin size={16} className="mr-3" /> LinkedIn
                                                        </a>
                                                        <button 
                                                            onClick={copyToClipboard}
                                                            className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                                        >
                                                            <LinkIcon size={16} className="mr-3" /> Copiar enlace
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Bar */}
                                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-6">
                                    <div className="text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start font-bold text-xl">
                                            {providerData.rating !== null ? (
                                                <span className="text-yellow-500 flex items-center">
                                                    {providerData.rating} <StarIcon className="h-5 w-5 fill-current ml-1" />
                                                </span>
                                            ) : (
                                                <span className="text-brand-primary">Nuevo</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{providerData.reviewsCount} Reseñas</p>
                                    </div>
                                    <div className="text-center md:text-left border-l md:pl-6 border-gray-200">
                                        <div className="font-bold text-xl text-gray-900">{providerData.stats.jobsCompleted}</div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Trabajos</p>
                                    </div>
                                    <div className="text-center md:text-left border-l md:pl-6 border-gray-200">
                                        <div className="font-bold text-xl text-gray-900">{providerData.stats.repeatHires || 'N/D'}</div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Re-contratación</p>
                                    </div>
                                    <div className="text-center md:text-left border-l md:pl-6 border-gray-200">
                                        <div className="font-bold text-xl text-gray-900 flex items-center justify-center md:justify-start"><Clock size={18} className="mr-1 text-gray-400" /> {providerData.stats.responseTime || 'N/D'}</div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Tiempo Resp.</p>
                                    </div>
                                </div>
                                <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                                    La verificación confirma la identidad asociada a la cuenta; no certifica títulos, especialidades ni resultados. Confirma antecedentes cuando corresponda.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-t border-gray-200 px-6 md:px-8">
                        <nav className="-mb-px flex space-x-8">
                            {['services', 'about', 'reviews'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors capitalize ${activeTab === tab
                                        ? 'border-brand-primary text-brand-primary'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    {tab === 'services' ? 'Servicios' : tab === 'about' ? 'Sobre mí' : 'Reseñas'}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="mt-8">
                    {activeTab === 'services' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {providerData.services.length > 0 ? providerData.services.map((service: any) => (
                                <Link key={service.id} to={buildServicePath(service.id, service.title)} className="group block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                                    <div className="h-48 relative bg-gradient-to-br from-gray-100 to-gray-200">
                                        {service.image ? (
                                            <img
                                                src={service.image}
                                                alt={service.title}
                                                loading="lazy"
                                                decoding="async"
                                                width="640"
                                                height="384"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <span className="text-xs">Sin imagen</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-gray-900 text-lg mb-2">{service.title}</h3>
                                        <p className="mb-3 flex items-center text-sm text-gray-500">
                                            <MapPin size={14} className="mr-1.5 flex-shrink-0 text-brand-primary" />
                                            <span className="line-clamp-1">{service.location || providerData.location}</span>
                                        </p>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-brand-primary text-lg">${(service.price || 0).toLocaleString('es-CL')}</span>
                                            <div className="flex items-center text-sm">
                                                {service.rating !== null ? (
                                                    <span className="text-gray-600 flex items-center">
                                                        <StarIcon className="h-4 w-4 text-yellow-400 fill-current mr-1" /> {service.rating}
                                                    </span>
                                                ) : (
                                                    <span className="text-brand-primary font-medium">Nuevo</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="mt-4 block w-full py-2 bg-gray-50 text-center text-brand-primary font-semibold rounded-md group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                            Ver Detalle
                                        </span>
                                    </div>
                                </Link>
                            )) : (
                                <div className="col-span-full py-12 text-center text-gray-500">Este proveedor aún no tiene servicios activos.</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'about' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Acerca de {providerData.name}</h3>
                            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{providerData.about}</p>
                            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <h4 className="flex items-center text-sm font-bold text-gray-900">
                                    <MapPin size={16} className="mr-2 text-brand-primary" />
                                    Cobertura de servicios
                                </h4>
                                <p className="mt-2 text-sm text-gray-600">{providerData.location}</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reviews' && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
                            <h3 className="text-xl font-bold text-gray-900 mb-4">Lo que dicen los clientes</h3>
                            {providerData.reviews.length > 0 ? providerData.reviews.map((review: any) => (
                                <div key={review.id} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-semibold text-gray-900">{review.user}</span>
                                        <span className="text-sm text-gray-500">{review.date}</span>
                                    </div>
                                    <div className="flex items-center mb-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <StarIcon key={i} className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                                        ))}
                                    </div>
                                    <p className="text-gray-700 text-sm">{review.comment}</p>
                                </div>
                            )) : (
                                <div className="text-center text-gray-500 italic py-4">No hay reseñas para mostrar aún.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProviderPublicProfile;
