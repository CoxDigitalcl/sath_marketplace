
import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Page, ServiceCategory } from '../types';
import ServiceCarousel from './ServiceCarousel';
import { LockKeyhole, Fingerprint, Star as LucideStar, Lightbulb, Send, Clock, Play, ArrowRight, User, Briefcase, Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
    SearchIcon, WrenchScrewdriverIcon, AcademicCapIcon, HeartIcon,
    PawIcon, TruckIcon,
    CheckCircleIcon, PlayCircleIcon,
    CakeIcon,
    CarIcon,
    GiftIcon,
    StarIcon
} from './IconComponents';
import LocationCoverageSelector from './common/LocationCoverageSelector';

interface HomePageProps {
    navigateTo: (page: Page, params?: any) => void;
    setTheme: (theme: 'client' | 'provider') => void;
}

const communityMessages = {
    client: {
        title: 'La comunidad crece cada día',
        body: 'Bienvenidos a nuestra comunidad, hemos lanzado nuestro sitio web muy recientemente así es que la cantidad de servicios mostrados aún está creciendo; si no encuentras lo que buscas, te invitamos a revisar en unos días más, muchas gracias por elegirnos!'
    },
    provider: {
        title: 'Sé parte del comienzo',
        body: 'Acompáñanos en nuestro nacimiento desde la ciudad de Concepción hacia todo Chile, conviértete en uno de nuestros primeros proveedores y juntos ayudemos a nuestra comunidad! Para todo nuevo proveedor, ServiciosatuHogar publicitará en Instagram tus servicios de manera gratuita para que aumentes los clientes en tu agenda de manera inmediata!'
    }
} as const;


// Mock data removed. Services and Promotions fetched from API.


const SecurityFeature: React.FC<{ icon: React.ComponentType<{ size: number, color?: string, className?: string }>, title: string, description: string }> = ({ icon: Icon, title, description }) => (
    <div className="text-center p-8 bg-white/5 backdrop-blur-md rounded-2xl shadow-xl border border-white/10 hover:border-brand-primary/50 hover:bg-white/10 transition-all duration-300 relative overflow-hidden group">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary to-brand-accent opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300"></div>
        <div className="relative mx-auto w-16 h-16 bg-brand-primary/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-5 border border-brand-primary/30 group-hover:scale-110 transition-transform duration-300 shadow-[0_0_15px_rgba(var(--color-brand-primary-rgb),0.3)]">
            <Icon size={28} className="text-brand-light" />
        </div>
        <h3 className="relative text-xl font-bold text-white mb-3 group-hover:text-brand-light transition-colors">{title}</h3>
        <p className="relative text-gray-300 text-sm leading-relaxed">{description}</p>
    </div>
);

const HomePage: React.FC<HomePageProps> = ({ navigateTo, setTheme }) => {
    const [activeFilter, setActiveFilter] = useState('recommended');
    const [activeRole, setActiveRole] = useState<'client' | 'provider'>('client');
    const [promotions, setPromotions] = useState<any[]>([]);
    const [featuredServices, setFeaturedServices] = useState({
        sponsored: [],
        bestSellers: [],
        staffPicks: [],
        newArrivals: []
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRegionCode, setSelectedRegionCode] = useState('');
    const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
    const communityMessage = communityMessages[activeRole];

    // State for Idea Form
    const [ideaData, setIdeaData] = useState({ ideaName: '', ideaEmail: '', ideaDesc: '' });
    const [isSubmittingIdea, setIsSubmittingIdea] = useState(false);
    const [ideaSubmitted, setIdeaSubmitted] = useState(false);

    // Restore Main Categories constant inside component or re-declare
    const mainCategories: ServiceCategory[] = [
        { id: 'hogar', name: 'Hogar y Mantención', description: 'Limpieza, reparaciones, calefacción, jardín y más', icon: WrenchScrewdriverIcon },
        { id: 'clases', name: 'Clases y Tutorías', description: 'Escolares, idiomas, música, deportes y universitarios', icon: AcademicCapIcon },
        { id: 'salud', name: 'Salud y Bienestar', description: 'Médicos, psicólogos, enfermería y estética', icon: HeartIcon },
        { id: 'eventos', name: 'Eventos y Entret.', description: 'Niñeras, animación, decoración y cumpleaños', icon: CakeIcon },
        { id: 'automoviles', name: 'Automóviles', description: 'Mecánica, grúas, lavado y mantención', icon: CarIcon },
        { id: 'fletes', name: 'Fletes', description: 'Retiro de encomiendas y entregas', icon: TruckIcon },
        { id: 'colegio', name: 'Colegio', description: 'Charlas educativas, regalos y actividades', icon: GiftIcon },
    ];


    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Featured Services
                const resFeatured = await api.get('/services/featured');
                if (resFeatured.data.status === 'success') {
                    setFeaturedServices(resFeatured.data.data);
                }

                // Fetch Promotions
                const resPromotions = await api.get('/promotions');
                if (resPromotions.data.status === 'success') {
                    setPromotions(resPromotions.data.promotions);
                }

            } catch (e) {
                console.error("Failed to fetch data:", e);
            }
        };
        fetchData();
    }, []);

    const handleIdeaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ideaData.ideaName || !ideaData.ideaDesc) return;
        
        setIsSubmittingIdea(true);
        try {
            await api.post('/public/idea', ideaData);
            setIdeaSubmitted(true);
            setIdeaData({ ideaName: '', ideaEmail: '', ideaDesc: '' });
            setTimeout(() => setIdeaSubmitted(false), 5000);
        } catch (error) {
            console.error('Error submitting idea', error);
        } finally {
            setIsSubmittingIdea(false);
        }
    };


    const handleRoleChange = (role: 'client' | 'provider') => {
        setActiveRole(role);
        setTheme(role);
    };

    const runHeroSearch = () => {
        navigateTo('search', {
            q: searchTerm,
            region: selectedRegionCode,
            communes: selectedRegionCode ? selectedCommunes : [],
        });
    };

    const getCategoryPath = (category: ServiceCategory) => {
        const params = new URLSearchParams();
        if (selectedRegionCode) params.set('region', selectedRegionCode);
        if (selectedRegionCode && selectedCommunes.length > 0) {
            params.set('commune', selectedCommunes.join(','));
        }

        const queryString = params.toString();
        return `/categories/${category.id}${queryString ? `?${queryString}` : ''}`;
    };

    // Animation Variants
    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    return (
        <div className="bg-brand-light min-h-screen">

            {/* Hero Section (V2 Premium) */}
            <section className="relative bg-slate-50 overflow-hidden">
                {/* Modern subtle mesh/glow background */}
                <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-primary/20 rounded-full filter blur-[100px] opacity-70 pointer-events-none z-0"></div>
                <div className="absolute top-[10%] right-[-5%] w-[500px] h-[500px] bg-brand-accent/15 rounded-full filter blur-[100px] opacity-70 pointer-events-none z-0"></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-brand-light/50 rounded-full filter blur-[100px] opacity-70 pointer-events-none z-0"></div>
                
                <div className="relative z-10 container mx-auto px-4 py-12 sm:py-20 lg:py-24">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                        {/* Text Content */}
                        <div className="lg:w-1/2 text-center lg:text-left">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <span className="inline-block py-1 px-3 rounded-full bg-brand-primary/10 text-brand-primary text-sm font-semibold mb-4">
                                    #1 Marketplace de Servicios en Chile
                                </span>
                                <motion.h1
                                    className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight"
                                    variants={fadeInUp}
                                    initial="initial"
                                    animate="animate"
                                >
                                    Encuentra al experto <br />
                                    <span className="text-brand-primary">perfecto para ti</span>
                                </motion.h1>
                                <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0">
                                    Desde reparaciones del hogar hasta clases particulares. Conecta con profesionales verificados y paga de forma segura con nuestra garantía de satisfacción.
                                </p>

                                <div className="bg-white p-2 rounded-2xl sm:rounded-full shadow-lg border border-gray-100 flex flex-col sm:flex-row items-center max-w-xl mx-auto lg:mx-0">
                                    <div className="relative w-full sm:flex-grow">
                                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                        <input
                                            type="text"
                                            placeholder="¿Qué servicio estás buscando?"
                                            className="w-full py-3 pl-12 pr-4 text-gray-700 rounded-xl sm:rounded-full focus:outline-none bg-transparent"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && runHeroSearch()}
                                            onFocus={() => { if (activeRole !== 'client') handleRoleChange('client'); }}
                                        />
                                    </div>
                                    <button
                                        onClick={runHeroSearch}
                                        className="w-full sm:w-auto mt-2 sm:mt-0 bg-brand-primary hover:bg-brand-accent text-white font-bold py-3 px-8 rounded-xl sm:rounded-full transition-all duration-300 shadow-md"
                                    >
                                        Buscar
                                    </button>
                                </div>

                                <div className="mt-4 max-w-xl mx-auto lg:mx-0 rounded-2xl border border-gray-100 bg-white/95 p-4 text-left shadow-md">
                                    <LocationCoverageSelector
                                        regionCode={selectedRegionCode}
                                        communes={selectedCommunes}
                                        onRegionChange={setSelectedRegionCode}
                                        onCommunesChange={setSelectedCommunes}
                                        mode="multiple"
                                        label="Busca por ubicacion"
                                        helperText="Selecciona una o mas comunas para ampliar tu busqueda."
                                    />
                                </div>

                                <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-gray-500">
                                    <span className="flex items-center"><CheckCircleIcon className="h-4 w-4 mr-1 text-green-500" /> Verificados</span>
                                    <span className="flex items-center"><CheckCircleIcon className="h-4 w-4 mr-1 text-green-500" /> Pago Seguro</span>
                                    <span className="flex items-center"><CheckCircleIcon className="h-4 w-4 mr-1 text-green-500" /> Sin Comisiones Ocultas</span>
                                </div>
                            </motion.div>
                        </div>

                        {/* Interactive Video Component */}
                        <div className="lg:w-1/2 w-full max-w-lg">
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="bg-white p-2 rounded-2xl shadow-2xl border border-gray-100"
                            >
                                <div className="flex rounded-xl bg-gray-100 p-1 mb-2 relative">
                                    <button
                                        type="button"
                                        onClick={() => handleRoleChange('client')}
                                        aria-pressed={activeRole === 'client'}
                                        aria-controls="hero-role-content community-growth-message"
                                        className="flex-1 relative z-10 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                                    >
                                        {activeRole === 'client' && (
                                            <motion.div
                                                layoutId="heroTab"
                                                className="absolute inset-0 bg-white shadow-sm rounded-lg border border-gray-200/50"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 flex items-center ${activeRole === 'client' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                                            <User size={16} className="mr-2" /> Busco un servicio
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRoleChange('provider')}
                                        aria-pressed={activeRole === 'provider'}
                                        aria-controls="hero-role-content community-growth-message"
                                        className="flex-1 relative z-10 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                                    >
                                        {activeRole === 'provider' && (
                                            <motion.div
                                                layoutId="heroTab"
                                                className="absolute inset-0 bg-white shadow-sm rounded-lg border border-gray-200/50"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 flex items-center ${activeRole === 'provider' ? 'text-brand-primary' : 'text-gray-500 hover:text-gray-700'}`}>
                                            <Briefcase size={16} className="mr-2" /> Ofrezco mis servicios
                                        </span>
                                    </button>
                                </div>

                                <div id="hero-role-content" className="relative rounded-xl overflow-hidden aspect-[4/3]">

                                    <AnimatePresence mode='wait'>
                                        {activeRole === 'client' ? (
                                            <motion.div
                                                key="client-video"
                                                className="w-full h-full relative z-10"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
                                            >
                                                <video
                                                    src="/videos/Video-clientes.mp4"
                                                    poster="/videos/clientes-poster.webp"
                                                    preload="none"
                                                    muted
                                                    playsInline
                                                    controls
                                                    width={960}
                                                    height={720}
                                                    aria-label="Video con subtítulos integrados sobre cómo contratar un servicio"
                                                    className="w-full h-full object-cover"
                                                />
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                key="provider-video"
                                                className="w-full h-full relative z-10"
                                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
                                            >
                                                <video
                                                    src="/videos/Video-proveedores.mp4"
                                                    poster="/videos/proveedores-poster.webp"
                                                    preload="none"
                                                    muted
                                                    playsInline
                                                    controls
                                                    width={960}
                                                    height={720}
                                                    aria-label="Video con subtítulos integrados sobre cómo ofrecer servicios"
                                                    className="w-full h-full object-cover"
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/60 to-transparent text-white pointer-events-none">
                                        <h3 className="font-bold text-sm">
                                            {activeRole === 'client' ? 'Cómo contratar un servicio seguro' : 'Empieza a ganar dinero hoy mismo'}
                                        </h3>
                                        <p className="text-xs text-gray-200 opacity-90">
                                            {activeRole === 'client' ? 'Descubre lo fácil que es solucionar tus pendientes.' : 'Únete a la red de profesionales más grande del país.'}
                                        </p>
                                    </div>
                                </div>

                                <details className="mt-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                                    <summary className="cursor-pointer font-semibold text-gray-800">Descripción textual del video</summary>
                                    <p className="mt-2 leading-6">{activeRole === 'client' ? 'El video explica cómo buscar un servicio, coordinar la contratación y elegir una fecha para recibirlo. Incluye subtítulos visibles en español.' : 'El video explica cómo publicar servicios, organizar la agenda y utilizar la plataforma para conseguir nuevas contrataciones. Incluye subtítulos visibles en español.'}</p>
                                </details>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community growth message, synchronized with the hero role selector */}
            <section className="relative z-10 bg-slate-50 px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8" aria-label="Estado de la comunidad">
                <div
                    id="community-growth-message"
                    aria-live="polite"
                    aria-atomic="true"
                    className="container mx-auto max-w-5xl"
                >
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.article
                            key={activeRole}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="relative overflow-hidden rounded-3xl border border-brand-primary/20 bg-white px-6 py-7 shadow-[0_18px_45px_-28px_rgba(var(--color-brand-primary-rgb),0.65)] sm:px-8 sm:py-8"
                        >
                            <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-brand-primary/10 blur-3xl" aria-hidden="true" />

                            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-light text-brand-primary ring-1 ring-brand-primary/20" aria-hidden="true">
                                    <Sprout size={30} strokeWidth={1.8} />
                                </div>

                                <div className="max-w-3xl">
                                    <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-primary">
                                        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-40 motion-reduce:animate-none" />
                                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-primary" />
                                        </span>
                                        Plataforma activa y en crecimiento
                                    </div>
                                    <h2 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">
                                        {communityMessage.title}
                                    </h2>
                                    <p className="mt-3 max-w-[72ch] text-[15px] leading-7 text-gray-600 sm:text-base">
                                        {communityMessage.body}
                                    </p>
                                </div>
                            </div>
                        </motion.article>
                    </AnimatePresence>
                </div>
            </section>

            {/* Categories Grid */}
            <section className="py-16 container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12">
                    <motion.h2
                        className="text-3xl font-bold text-gray-900"
                        variants={fadeInUp}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                    >
                        Explora nuestras categorías
                    </motion.h2>
                    <p className="mt-2 text-gray-600">Todo lo que necesitas en un solo lugar</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {mainCategories.map((category) => (
                        <Link
                            key={category.id}
                            to={getCategoryPath(category)}
                            state={{ id: category.id, name: category.name }}
                            className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg hover:shadow-brand-primary/10 border border-gray-100 cursor-pointer flex flex-col items-center text-center transition-all duration-300 group relative overflow-hidden"
                        >
                            {/* Subtle hover background highlight */}
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-brand-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            
                            <div className="relative p-4 bg-gray-50 rounded-full mb-4 group-hover:bg-brand-primary transition-all duration-300 group-hover:shadow-md">
                                <category.icon className="h-8 w-8 text-gray-500 group-hover:text-white transition-colors duration-300" />
                            </div>
                            <h3 className="relative font-bold text-gray-900 text-lg group-hover:text-brand-primary transition-colors mb-2 z-10">{category.name}</h3>
                            <p className="relative text-xs text-gray-500 line-clamp-2 px-2 z-10">{category.description}</p>
                        </Link>
                    ))}
                    {/* Static "Ver Todas" Card */}
                    <Link to="/categories"
                        className="bg-brand-light/40 p-6 rounded-xl border border-brand-primary/20 cursor-pointer flex flex-col items-center text-center justify-center group h-full relative overflow-hidden hover:bg-brand-light/70 transition-colors duration-300"
                    >
                        <div className="relative p-3 bg-white rounded-full mb-3 shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                            <ArrowRight className="h-6 w-6 text-brand-primary" />
                        </div>
                        <span className="relative font-bold text-brand-primary text-lg group-hover:underline z-10">Ver todas</span>
                        <p className="relative text-xs text-brand-primary/70 mt-1 z-10">Explora el catálogo completo</p>
                    </Link>
                </div>
            </section>

            {/* Featured Services */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row justify-between items-end mb-8">
                        <div>
                            <motion.h2
                                className="text-3xl font-bold text-gray-900"
                                variants={fadeInUp}
                                initial="initial"
                                whileInView="animate"
                                viewport={{ once: true }}
                            >
                                Servicios Destacados
                            </motion.h2>
                            <p className="mt-2 text-gray-600">Los mejores profesionales calificados por la comunidad</p>
                        </div>

                        {/* Filters - 4 Tabs with Icons */}
                        <div className="flex overflow-x-auto no-scrollbar snap-x space-x-2 mt-4 sm:mt-0 bg-gray-100 p-1 rounded-lg relative">
                            {[
                                { id: 'recommended', label: 'Recomendados', icon: StarIcon },
                                { id: 'popular', label: 'Populares', icon: null },
                                { id: 'original', label: 'Originales', icon: null },
                                { id: 'new', label: 'Nuevos', icon: null }
                            ].map((filter) => (
                                <button
                                    key={filter.id}
                                    onClick={() => setActiveFilter(filter.id)}
                                    className="relative px-4 py-1.5 text-sm font-medium capitalize rounded-md transition-colors duration-300 focus:outline-none snap-start whitespace-nowrap"
                                >
                                    {activeFilter === filter.id && (
                                        <motion.div
                                            layoutId="serviceFilter"
                                            className="absolute inset-0 bg-brand-primary rounded-md shadow-sm"
                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        />
                                    )}
                                    <span className={`relative z-10 flex items-center ${activeFilter === filter.id ? 'text-white' : 'text-gray-500 hover:text-brand-primary'}`}>
                                        {filter.icon && <filter.icon className="h-4 w-4 mr-1" />}
                                        {filter.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-8">
                        {/* Recomendados - Solo Patrocinados */}
                        {activeFilter === 'recommended' && (
                            featuredServices.sponsored.length > 0 ? (
                                <ServiceCarousel
                                    title=""
                                    services={featuredServices.sponsored}
                                    autoPlayInterval={5000}
                                />
                            ) : (
                                <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <StarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 text-lg">No hay servicios recomendados disponibles.</p>
                                    <p className="text-sm text-gray-400 mt-2">Los proveedores pueden promocionar sus servicios aquí.</p>
                                </div>
                            )
                        )}

                        {/* Populares - Solo Orgánicos (Best Sellers) */}
                        {activeFilter === 'popular' && (
                            featuredServices.bestSellers.length > 0 ? (
                                <ServiceCarousel
                                    title=""
                                    services={featuredServices.bestSellers}
                                    autoPlayInterval={5000}
                                />
                            ) : (
                                <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <p className="text-gray-500 text-lg">No hay servicios populares aún.</p>
                                    <p className="text-sm text-gray-400 mt-2">¡Explora otras categorías!</p>
                                </div>
                            )
                        )}

                        {/* Originales - Staff Picks */}
                        {activeFilter === 'original' && (
                            featuredServices.staffPicks.length > 0 ? (
                                <ServiceCarousel
                                    title=""
                                    services={featuredServices.staffPicks}
                                    autoPlayInterval={5000}
                                />
                            ) : (
                                <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <p className="text-gray-500 text-lg">No hay selecciones del equipo aún.</p>
                                    <p className="text-sm text-gray-400 mt-2">¡Pronto agregaremos nuestras recomendaciones!</p>
                                </div>
                            )
                        )}

                        {/* Nuevos - New Arrivals */}
                        {activeFilter === 'new' && (
                            featuredServices.newArrivals.length > 0 ? (
                                <ServiceCarousel
                                    title=""
                                    services={featuredServices.newArrivals}
                                    autoPlayInterval={5000}
                                />
                            ) : (
                                <div className="py-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                    <p className="text-gray-500 text-lg">No hay servicios nuevos esta semana.</p>
                                    <p className="text-sm text-gray-400 mt-2">¡Vuelve pronto!</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Subtle View All Button */}
                    <div className="mt-8 text-right">
                        <Link to="/search"
                            className="inline-flex items-center text-sm font-medium text-brand-primary hover:text-brand-accent transition-colors group"
                        >
                            Explorar todos los servicios <ArrowRight size={16} className="ml-1 transform group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Weekly Promotions (Renamed to Oportunidades) */}
            <section className="py-16 bg-gray-50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center mb-8">
                        <div className="bg-red-100 p-2 rounded-full mr-3">
                            <PlayCircleIcon className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                            <motion.h2
                                className="text-2xl font-bold text-gray-900"
                                variants={fadeInUp}
                                initial="initial"
                                whileInView="animate"
                                viewport={{ once: true }}
                            >
                                Oportunidades de esta semana
                            </motion.h2>
                            <p className="text-gray-500 text-sm">Ofertas por tiempo limitado en servicios seleccionados</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {promotions.length > 0 ? (
                            promotions.map((promo) => (
                                <article key={promo.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 hover:border-brand-primary/50 transition-all">
                                    <div className="w-full sm:w-48 h-48 sm:h-auto relative rounded-lg overflow-hidden flex-shrink-0">
                                        <img
                                            src={promo.image_url || 'https://images.unsplash.com/photo-1520523839592-bd5ba5c39558?q=80&w=870&auto=format&fit=crop'}
                                            alt={promo.title}
                                            loading="lazy"
                                            decoding="async"
                                            width={870}
                                            height={580}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                                            {promo.discount_label || 'Oferta'}
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between py-2 flex-grow">
                                        <div>
                                            {promo.tag && <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mb-2 inline-block">{promo.tag}</span>}
                                            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2">{promo.title}</h3>
                                            <p className="text-xs text-gray-500 flex items-center mb-4">
                                                <Clock size={14} className="mr-1" /> Válido hasta {new Date(promo.valid_until).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex items-end justify-between mt-auto">
                                            <div>
                                                <span className="text-sm text-gray-400 line-through mr-2">${(promo.original_price || 0).toLocaleString('es-CL')}</span>
                                                <span className="text-xl font-bold text-red-600">${(promo.discounted_price || 0).toLocaleString('es-CL')}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-brand-primary">Oferta informativa</span>
                                        </div>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="col-span-full py-10 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 text-center">
                                <div className="bg-gray-100 p-4 rounded-full mb-3">
                                    <GiftIcon className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-gray-600 font-medium">¡Pronto nuevas oportunidades!</p>
                                <p className="text-sm text-gray-500 mt-1 max-w-md">
                                    Estamos preparando ofertas increíbles para ti. Revisa esta sección más tarde para encontrar descuentos exclusivos.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Trust & Safety - Dark Premium Redesign */}
            <section className="py-20 bg-slate-900 relative">
                {/* Decoración sutil de fondo para el dark mode */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-primary/10 to-transparent pointer-events-none"></div>
                
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-16">
                        <motion.h2
                            className="text-3xl font-bold text-white mb-4"
                            variants={fadeInUp}
                            initial="initial"
                            whileInView="animate"
                            viewport={{ once: true }}
                        >
                            ¿Por qué confiar en nosotros?
                        </motion.h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">Nuestro modelo tecnológico nos permite asegurar cada etapa de la contratación de un servicio.</p>
                    </div>
                
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <SecurityFeature
                            icon={LockKeyhole}
                            title="Pagos Seguros"
                            description="Tu dinero se mantiene en custodia (Escrow) hasta que confirmas que el trabajo se realizó correctamente."
                        />
                        <SecurityFeature
                            icon={Fingerprint}
                            title="Identidad Verificada"
                            description="Revisamos antecedentes y validamos la identidad de cada proveedor para tu tranquilidad."
                        />
                        <SecurityFeature
                            icon={LucideStar}
                            title="Calidad Garantizada"
                            description="Si algo no sale como esperabas, nuestro equipo de soporte intervendrá para encontrar una solución."
                        />
                    </div>
                </div>
            </section>

            {/* Become a Provider & Idea Form Section */}
            <section className="py-20 bg-brand-secondary text-white">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Provider CTA */}
                    <div className="rounded-2xl overflow-hidden">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                            <div className="order-2 lg:order-1">
                                <div className="inline-block bg-orange-500/20 text-orange-400 font-semibold px-4 py-1 rounded-full text-sm mb-6">
                                    Para Profesionales
                                </div>
                                <motion.h2
                                    className="text-3xl md:text-4xl font-bold mb-4 text-white"
                                    variants={fadeInUp}
                                    initial="initial"
                                    whileInView="animate"
                                    viewport={{ once: true }}
                                >
                                    Haz crecer tu negocio con Serviciosatuhogar
                                </motion.h2>
                                <p className="text-lg text-gray-300 mb-8">
                                    Únete a miles de profesionales que encuentran nuevos clientes cada día. Gestiona tu agenda, asegura tus pagos y construye tu reputación online.
                                </p>
                                <ul className="space-y-4 mb-8">
                                    <li className="flex items-center text-gray-200">
                                        <div className="bg-green-500/20 p-1 rounded-full mr-3"><CheckCircleIcon className="h-5 w-5 text-green-400" /></div>
                                        <span>Pagos garantizados semanalmente</span>
                                    </li>
                                    <li className="flex items-center text-gray-200">
                                        <div className="bg-green-500/20 p-1 rounded-full mr-3"><CheckCircleIcon className="h-5 w-5 text-green-400" /></div>
                                        <span>Tú defines tus precios y horarios</span>
                                    </li>
                                    <li className="flex items-center text-gray-200">
                                        <div className="bg-green-500/20 p-1 rounded-full mr-3"><CheckCircleIcon className="h-5 w-5 text-green-400" /></div>
                                        <span>Herramientas de gestión gratuitas</span>
                                    </li>
                                </ul>
                                <Link to="/provider/register" onClick={() => setTheme('provider')}
                                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 shadow-lg hover:shadow-orange-600/20 transform hover:-translate-y-1"
                                >
                                    Comenzar ahora
                                </Link>
                            </div>
                            <div className="order-1 lg:order-2 relative">
                                <div className="absolute -inset-4 bg-orange-500/20 rounded-full blur-3xl"></div>
                                <img
                                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
                                    alt="Equipo de trabajo"
                                    loading="lazy"
                                    decoding="async"
                                    width={2070}
                                    height={1380}
                                    className="relative rounded-xl shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Idea Form Section (New) */}
                    <div className="mt-24 max-w-4xl mx-auto">
                        <div className="bg-slate-600 rounded-2xl p-8 md:p-10 shadow-xl border border-slate-500/50 relative overflow-hidden">
                            {/* Background decoration */}
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand-primary/20 rounded-full blur-3xl"></div>
                            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl"></div>

                            <div className="relative z-10">
                                <div className="text-center mb-8">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-4">
                                        <Lightbulb className="h-6 w-6 text-yellow-300" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">¿No encuentras el servicio que buscas?</h3>
                                    <p className="text-gray-200">
                                        ¿Tienes alguna idea original de servicio inexistente? ¡Completa este formulario y haznos llegar tu idea!
                                    </p>
                                </div>

                                <form className="space-y-6 max-w-2xl mx-auto" onSubmit={handleIdeaSubmit}>
                                    {ideaSubmitted ? (
                                        <div className="bg-green-500/20 text-green-300 p-4 rounded-lg text-center border border-green-500/30">
                                            ¡Gracias por tu idea! La hemos recibido correctamente.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label htmlFor="ideaName" className="block text-sm font-medium text-gray-200 mb-1">Nombre de la idea</label>
                                                    <input 
                                                        type="text" 
                                                        id="ideaName" 
                                                        required
                                                        value={ideaData.ideaName}
                                                        onChange={(e) => setIdeaData({...ideaData, ideaName: e.target.value})}
                                                        className="w-full px-4 py-2 rounded-lg bg-slate-50 border-0 focus:ring-2 focus:ring-brand-primary text-gray-900" 
                                                        placeholder="Ej. Paseador de gatos" 
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="ideaEmail" className="block text-sm font-medium text-gray-200 mb-1">Email*</label>
                                                    <input 
                                                        type="email" 
                                                        id="ideaEmail" 
                                                        value={ideaData.ideaEmail}
                                                        onChange={(e) => setIdeaData({...ideaData, ideaEmail: e.target.value})}
                                                        className="w-full px-4 py-2 rounded-lg bg-slate-50 border-0 focus:ring-2 focus:ring-brand-primary text-gray-900" 
                                                        placeholder="tu@email.com" 
                                                    />
                                                    <p className="text-xs text-gray-400 mt-1">*Solo si necesitamos más info sobre tu genial idea.</p>
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="ideaDesc" className="block text-sm font-medium text-gray-200 mb-1">Descripción de la idea</label>
                                                <textarea 
                                                    id="ideaDesc" 
                                                    rows={3} 
                                                    required
                                                    value={ideaData.ideaDesc}
                                                    onChange={(e) => setIdeaData({...ideaData, ideaDesc: e.target.value})}
                                                    className="w-full px-4 py-2 rounded-lg bg-slate-50 border-0 focus:ring-2 focus:ring-brand-primary text-gray-900" 
                                                    placeholder="Cuéntanos de qué se trata..."
                                                ></textarea>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                                                <p className="text-sm text-green-300 font-medium italic">
                                                    ¡Si implementamos tu idea, te regalaremos descuentos especiales!
                                                </p>
                                                <button 
                                                    type="submit" 
                                                    disabled={isSubmittingIdea}
                                                    className="flex items-center justify-center bg-brand-primary hover:bg-brand-accent text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-lg disabled:opacity-50"
                                                >
                                                    {isSubmittingIdea ? 'Enviando...' : 'Enviar Idea'} <Send size={18} className="ml-2" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </form>
                            </div>
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
};

export default HomePage;
