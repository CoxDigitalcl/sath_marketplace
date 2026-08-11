
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Page } from '../../types';
import { ChevronLeft, Filter, ArrowRight, List } from 'lucide-react';
import ServiceCard from '../ServiceCard';
import LocationCoverageSelector from '../common/LocationCoverageSelector';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCommunesForRegion, getRegionByCode } from '../../../shared/chileLocations.js';

interface CategoryDetailPageProps {
    navigateTo: (page: Page, params?: any) => void;
    categoryId?: string;
    categoryName?: string;
}

// PDF Data Extracted
const pdfSubcategories: Record<string, string[]> = {
    'hogar': [
        "Limpieza profunda del hogar", "Limpieza de patios y bodegas", "Limpieza exterior ventanas", "Sello de cocinas y baños",
        "Limpieza campana/encimera/horno (Gas)", "Limpieza campana/encimera/horno (Eléc)", "Limpieza de canaletas",
        "Mantención equipos A/C", "Mantención estufas a pellet", "Mantención calefont/calderas", "Limpieza radiadores calefacción",
        "Mantención estufas combustión lenta", "Limpieza/peinado pasto sintético", "Pintura interior por m2", "Pintura exterior por m2", "Instalación papel mural por m2",
        "Limpieza y mantención de lavadora", "Retiro de escombros", "Instalación pasto sintético", "Cortar césped natural", "Plantación de césped",
        "Limpieza y mantención de secadora", "Instalación estufa a pellet", "Instalación estufa a combustión lenta", "Instalación KIT solar eléctrico",
        "Instalación KIT solar agua caliente", "Instalación Calefont", "Instalación A/C", "Instalación KIT cámaras y alarma",
        "Instalación cierre perimetral PVC (terraza)", "Instalación cierre perimetral motorizado PVC", "Mantenimiento de puertas y aislación",
        "Mantenimiento de ventanas Termopanel", "Arreglo de lavaplatos", "Arreglo de WC/duchas/Tinas", "Instalacion extractor humedad baño",
        "Instalación ventilación pasiva muros", "Mantenimiento de jardines", "Instalación de jardinería (arbustos, árboles, flores)",
        "Diseño de jardinería", "Instalacion extractor olores automático", "Arreglo muebles closet/cocina", "Arreglo de lavamanos",
        "Cerrajería - Cambio de chapas y copia llaves"
    ],
    'clases': [
        "Matemáticas (A domicilio)", "Inglés (A domicilio)", "Lenguaje (A domicilio)", "Química (A domicilio)",
        "Física (A domicilio)", "Alemán (A domicilio)", "Matemáticas (Online)", "Idioma Inglés (Online)",
        "Lenguaje (Online)", "Química (Online)", "Física (Online)", "Idioma Alemán (Online)",
        "Entrenamiento Fitness (A domicilio)", "Defensa personal (A domicilio)",
        "Piano (A domicilio)", "Violín (A domicilio)", "Batería (A domicilio)", "Guitarra (A domicilio)",
        "Guitarra eléctrica (A domicilio)", "Bajo (A domicilio)", "Violonchelo (A domicilio)", "Canto (A domicilio)"
    ],
    'salud': [
        "Psicólogo Adulto (A domicilio)", "Psicólogo niños (A domicilio)", "Psicólogo Adulto (Online)", "Psicólogo niños (Online)", "Médico general (Online)",
        "Peluquería adultos (A domicilio)", "Peluquería Niños (A domicilio)", "Enfermería inyecciones (A domicilio)", "Enfermería cuidado de (A domicilio)",
        "Nutricionista (A domicilio)", "Kinesiólogo (A domicilio)", "Médico general (A domicilio)"
    ],
    'eventos': [
        "Niñera por hora", "Decoración cumpleaños", "Payasos para eventos o cumpleaños", "Mago para eventos o cumpleaños", "Animación para eventos o cumpleaños",
        "Juegos inflables a domicilio", "Carritos de comida a domicilio"
    ],
    'automoviles': [
        "Vulcanización a domicilio", "Vulcanización con retiro y entrega", "Servicio de grúa Lunes a Viernes (A domicilio)", "Servicio de grúa 24hrs (A domicilio)",
        "Servicio de grúa Lunes a Viernes (A ruta)", "Servicio de grúa 24hrs (A ruta)", "Grúa y Mecánico de diagnóstico (A ruta)", "Reemplazo de baterías a domicilio",
        "Lavado a domicilio de autos por fuera", "Lavado a domicilio de autos por dentro", "Lavado a domicilio de autos por dentro y por fuera",
        "Lavado de tapiz de autos", "Grabado de patentes en espejos y vidrios", "Pulido de focos"
    ],
    'fletes': [
        "Retiro de encomiendas menores y entrega a destino", "Retiro de encomiendas mayores y entrega a destino"
    ],
    'colegio': [
        "Elaboración y compra de regalos escolares", "Charlas educativas Educación Sexual", "Charlas educativas Salud mental", "Charlas educativas Uso de tecnología en menores"
    ]
};

const CATEGORY_LABELS: Record<string, string> = {
    hogar: 'Hogar y Mantención',
    clases: 'Clases y Tutorías',
    salud: 'Salud y Bienestar',
    eventos: 'Eventos y Entretenimiento',
    automoviles: 'Automóviles',
    fletes: 'Fletes',
    colegio: 'Colegio',
};

import { api } from '../../api/client';

const parseArrayField = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const normalizeLocationFromParams = (regionParam: string | null, communeParam: string | null) => {
    const region = String(regionParam || '').trim().toUpperCase();
    if (!region || !getRegionByCode(region)) {
        return { region: '', commune: '' };
    }

    const requestedCommunes = String(communeParam || '')
        .split(',')
        .map(commune => commune.trim())
        .filter(Boolean);
    const validCommunes = getCommunesForRegion(region) as string[];
    const communes = validCommunes.filter(commune => requestedCommunes.includes(commune));

    return {
        region,
        commune: communes.join(','),
    };
};

const buildLocationSearch = (currentParams: URLSearchParams, regionCode: string, commune: string) => {
    const params = new URLSearchParams(currentParams);
    const region = regionCode.trim();
    const safeCommune = region ? commune.trim() : '';

    params.delete('region');
    params.delete('commune');

    if (region) params.set('region', region);
    if (safeCommune) params.set('commune', safeCommune);

    return params.toString();
};

const CategoryDetailPage: React.FC<CategoryDetailPageProps> = ({ navigateTo, categoryId = 'hogar', categoryName }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialLocation = normalizeLocationFromParams(searchParams.get('region'), searchParams.get('commune'));
    const resolvedCategoryName = categoryName || CATEGORY_LABELS[categoryId] || 'Servicios';
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
    const [selectedRegionCode, setSelectedRegionCode] = useState(initialLocation.region);
    const [selectedCommunes, setSelectedCommunes] = useState<string[]>(initialLocation.commune ? initialLocation.commune.split(',') : []);
    const selectedLocation = selectedRegionCode ? selectedCommunes.join(',') : '';
    const pendingRegionCodeRef = useRef<string | null>(null);

    const syncLocationToUrl = useCallback((regionCode: string, commune: string) => {
        const nextSearch = buildLocationSearch(searchParams, regionCode, commune);
        if (nextSearch === searchParams.toString()) return;

        navigate({ search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
    }, [navigate, searchParams]);

    // Fetch Favorites IDs
    useEffect(() => {
        const fetchFavorites = async () => {
            try {
                const res = await api.get('/favorites');
                if (res.data.status === 'success') {
                    const ids = new Set(res.data.favorites.map((f: any) => f.id));
                    setFavoriteIds(ids);
                }
            } catch (error) {
                // Ignore error (user might not be logged in)
            }
        };
        fetchFavorites();
    }, []);

    // Parse image JSON if needed or use single URL
    // The backend returns image_urls as JSON string or array, we need to handle that.

    useEffect(() => {
        setSelectedSubcategory(null);
    }, [categoryId]);

    useEffect(() => {
        const sanitized = normalizeLocationFromParams(searchParams.get('region'), searchParams.get('commune'));
        const sanitizedSearch = buildLocationSearch(searchParams, sanitized.region, sanitized.commune);

        if (sanitizedSearch !== searchParams.toString()) {
            navigate({ search: sanitizedSearch ? `?${sanitizedSearch}` : '' }, { replace: true });
        }

        pendingRegionCodeRef.current = null;
        setSelectedRegionCode(sanitized.region);
        setSelectedCommunes(sanitized.commune ? sanitized.commune.split(',') : []);
    }, [navigate, searchParams]);

    useEffect(() => {
        const controller = new AbortController();
        const fetchServices = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.set('category', categoryId);
                if (selectedRegionCode) params.set('region', selectedRegionCode);
                if (selectedLocation) params.set('commune', selectedLocation);

                const res = await api.get(`/services?${params.toString()}`, {
                    signal: controller.signal
                });
                if (res.data.status === 'success') {
                    const mapped = res.data.services.map((s: any) => {
                        const images = parseArrayField(s.image_urls);
                        const categories = parseArrayField(s.categories_json);

                        return {
                            id: s.id,
                            title: s.title,
                            description: s.description,
                            provider: s.provider_name || 'Proveedor Verificado',
                            provider_name: s.provider_name,
                            providerId: s.provider_id,
                            rating: 5.0,
                            reviews: 0,
                            price: typeof s.price === 'string' ? parseFloat(s.price) : s.price,
                            priceUnit: '',
                            categoryId: s.category,
                            categories,
                            type: s.type || 'presencial',
                            location: s.location || '',
                            coverage_region_code: s.coverage_region_code || '',
                            coverage_region_name: s.coverage_region_name || '',
                            coverage_communes: parseArrayField(s.coverage_communes),
                            video_url: s.video_url || null,
                            image_urls: images,
                            cover_image_url: s.cover_image_url || null,
                            gallery_media: parseArrayField(s.gallery_media),
                            isSponsored: Boolean(s.isSponsored ?? s.is_sponsored)
                        };
                    });
                    setServices(mapped);
                }
            } catch (error: any) {
                // Ignore errors caused by component unmounting
                if (error.name === 'CanceledError' || error.message?.includes('canceled') || error.code === 'ERR_CANCELED') {
                    return;
                }
                console.error("Failed to fetch category services:", error);
            } finally {
                // Only stop loading if the component is still mounted
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        if (categoryId) {
            fetchServices();
        }

        return () => {
            controller.abort();
        };
    }, [categoryId, selectedRegionCode, selectedLocation]);

    const handleRegionChange = (regionCode: string) => {
        pendingRegionCodeRef.current = regionCode;
        setSelectedRegionCode(regionCode);
        setSelectedCommunes([]);
        syncLocationToUrl(regionCode, '');
    };

    const handleCommunesChange = (communes: string[]) => {
        const regionCode = pendingRegionCodeRef.current ?? selectedRegionCode;

        pendingRegionCodeRef.current = null;
        setSelectedCommunes(communes);
        syncLocationToUrl(regionCode, communes.join(','));
    };

    const filteredServices = useMemo(() => {
        const sortSponsoredFirst = (items: any[]) =>
            [...items].sort((a, b) => Number(Boolean(b.isSponsored)) - Number(Boolean(a.isSponsored)));

        if (!selectedSubcategory) return sortSponsoredFirst(services);

        return sortSponsoredFirst(services.filter(s => {
            // Check structured categories for exact subcategory match
            if (s.categories && Array.isArray(s.categories)) {
                // Debugging: Log what we are comparing
                // console.log("Filtering service:", s.title, s.categories);
                return s.categories.some((c: any) => {
                    const match = c.subcategory === selectedSubcategory;
                    // Try relaxed match too just in case of whitespace
                    const relaxedMatch = c.subcategory?.trim() === selectedSubcategory.trim();
                    return match || relaxedMatch;
                });
            }
            return false;
        }));
    }, [services, selectedSubcategory]);

    const subcategories = pdfSubcategories[categoryId as keyof typeof pdfSubcategories] || [];

    return (
        <div className="bg-gray-50 min-h-screen pb-12">

            {/* Category Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-4 py-8">
                    <button onClick={() => navigateTo('categories')} className="flex items-center text-sm text-gray-500 hover:text-brand-primary mb-4 transition-colors">
                        <ChevronLeft size={16} className="mr-1" /> Volver a todas las categorías
                    </button>
                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">{resolvedCategoryName}</h1>
                            <p className="text-gray-600 mt-2">Encuentra a los mejores expertos en {resolvedCategoryName} verificados por nuestra comunidad.</p>
                            {selectedSubcategory && (
                                <button
                                    onClick={() => setSelectedSubcategory(null)}
                                    className="mt-2 text-sm text-brand-primary hover:underline flex items-center"
                                >
                                    <Filter size={14} className="mr-1" /> Filtrado por: {selectedSubcategory} (Borrar)
                                </button>
                            )}
                        </div>
                        <div className="mt-4 md:mt-0 flex gap-3">
                            <div className="bg-gray-100 px-4 py-2 rounded-lg text-center">
                                <span className="block font-bold text-lg text-gray-800">4.8</span>
                                <span className="text-xs text-gray-500 uppercase">Rating Prom.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                    {/* Sidebar (Subcategories from PDF) */}
                    <div className="lg:col-span-1 order-2 lg:order-1">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-24">
                            <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                                <List size={18} className="mr-2" /> Especialidades {selectedSubcategory && <span className="ml-2 text-xs font-normal text-brand-primary cursor-pointer hover:underline" onClick={() => setSelectedSubcategory(null)}>(Ver todas)</span>}
                            </h3>
                            {subcategories.length > 0 ? (
                                <ul className="space-y-2 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                                    {subcategories.map((sub, idx) => (
                                        <li key={idx}>
                                            <button
                                                onClick={() => setSelectedSubcategory(sub === selectedSubcategory ? null : sub)}
                                                className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${sub === selectedSubcategory ? 'bg-brand-primary/10 text-brand-primary font-medium' : 'text-gray-700 hover:bg-gray-50 hover:text-brand-primary'}`}
                                            >
                                                <span className="truncate">{sub}</span>
                                                {sub === selectedSubcategory && <ArrowRight size={14} className="text-brand-primary flex-shrink-0 ml-2" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500 mb-4">Explora los servicios generales de esta categoría.</p>
                            )}

                            <div className="border-t border-gray-200 pt-5 mb-6">
                                <LocationCoverageSelector
                                    regionCode={selectedRegionCode}
                                    communes={selectedCommunes}
                                    onRegionChange={handleRegionChange}
                                    onCommunesChange={handleCommunesChange}
                                    mode="multiple"
                                    label="Ubicacion"
                                    helperText="Filtra por una o mas comunas atendidas."
                                />
                            </div>

                            <div className="border-t border-gray-200 pt-6">
                                <button
                                    onClick={() => navigateTo('categories')}
                                    className="w-full py-2 border border-brand-secondary text-brand-secondary rounded-md font-medium hover:bg-brand-secondary hover:text-white transition-colors text-sm"
                                >
                                    Ver otras categorías
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content (Services Grid) */}
                    <div className="lg:col-span-3 order-1 lg:order-2">

                        {/* Quick Filter Bar */}
                        <div className="flex items-center justify-between mb-6 bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex items-center text-sm text-gray-600">
                                <Filter size={18} className="mr-2" />
                                <span className="hidden sm:inline">Ordenar por:</span>
                                <select className="ml-2 bg-transparent border-none font-medium text-gray-900 focus:ring-0 cursor-pointer">
                                    <option>Recomendados</option>
                                    <option>Precio: Menor a Mayor</option>
                                    <option>Mejor Valorados</option>
                                </select>
                            </div>
                            <span className="text-sm text-gray-500">{filteredServices.length} resultados</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredServices.map(service => (
                                <div key={service.id} className="h-full">
                                    <ServiceCard
                                        service={{
                                            ...service,
                                            isFavorite: favoriteIds.has(service.id)
                                        }}
                                        onClick={() => navigateTo('service-detail', { id: service.id })}
                                        isSponsored={service.isSponsored}
                                    />
                                </div>
                            ))}
                        </div>

                        {filteredServices.length === 0 && (
                            <div className="text-center py-12">
                                <h3 className="text-lg text-gray-600">No hay servicios disponibles en esta categoría por el momento.</h3>
                                <p className="text-sm text-gray-500 mt-2">Prueba seleccionando otra especialidad de la lista.</p>
                                <button onClick={() => navigateTo('categories')} className="mt-4 text-brand-primary font-medium">Explorar otras categorías</button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryDetailPage;
