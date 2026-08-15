
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Page } from '../../types';
import { Search, Filter, ChevronDown, ChevronUp, Monitor, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ServiceCard from '../ServiceCard';
import LocationCoverageSelector from '../common/LocationCoverageSelector';
import { getCommunesForRegion, getRegionByCode } from '../../../shared/chileLocations.js';

interface SearchResultsPageProps {
    navigateTo: (page: Page, params?: any) => void;
}

// --- TAXONOMY DATA (From PDF) ---
const taxonomy = [
    {
        id: 'hogar',
        label: 'Hogar y Mantención',
        subcategories: [
            "Limpieza profunda del hogar", "Limpieza de patios", "Gasfitería", "Electricidad",
            "Jardinería", "Pintura", "Instalación de pisos", "Mudanzas", "Cerrajería"
        ]
    },
    {
        id: 'clases',
        label: 'Clases y Tutorías',
        subcategories: [
            "Matemáticas", "Inglés", "Lenguaje", "Ciencias", "Música (Piano, Guitarra)",
            "Entrenamiento Personal", "Yoga"
        ]
    },
    {
        id: 'salud',
        label: 'Salud y Bienestar',
        subcategories: [
            "Enfermería a domicilio", "Kinesiología", "Nutricionista", "Psicología",
            "Podología", "Masajes", "Peluquería", "Manicure"
        ]
    },
    {
        id: 'automoviles',
        label: 'Automóviles',
        subcategories: [
            "Mecánica a domicilio", "Lavado de autos", "Grúa", "Revisión técnica", "Baterías"
        ]
    },
    {
        id: 'eventos',
        label: 'Eventos',
        subcategories: [
            "Banquetera", "Animación", "Decoración", "DJ / Música", "Fotografía"
        ]
    },
    {
        id: 'mascotas',
        label: 'Mascotas',
        subcategories: [
            "Paseador de perros", "Peluquería canina", "Veterinario a domicilio", "Adiestramiento"
        ]
    }
];

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

const SERVICE_TYPE_FILTERS = ['presencial', 'online', 'hibrido'] as const;
const serviceTypeFilterSet = new Set<string>(SERVICE_TYPE_FILTERS);

type UrlFilters = {
    q: string;
    category: string;
    region: string;
    commune: string;
    type: string;
};

const parseServiceTypesParam = (value: string | null): string[] =>
    (value || '')
        .split(',')
        .map(type => type.trim().toLowerCase())
        .filter(type => serviceTypeFilterSet.has(type));

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

const readUrlFilters = (params: URLSearchParams): UrlFilters => {
    const location = normalizeLocationFromParams(params.get('region'), params.get('commune'));
    const serviceTypes = parseServiceTypesParam(params.get('type'));

    return {
        q: params.get('q') || '',
        category: params.get('category') || '',
        region: location.region,
        commune: location.commune,
        type: serviceTypes.join(','),
    };
};

const buildUrlSearch = (filters: UrlFilters) => {
    const params = new URLSearchParams();
    const region = filters.region.trim();
    const commune = region ? filters.commune.trim() : '';

    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.category.trim()) params.set('category', filters.category.trim());
    if (region) params.set('region', region);
    if (commune) params.set('commune', commune);
    if (filters.type.trim()) params.set('type', filters.type.trim());

    return params.toString();
};

const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ navigateTo }) => {
    // URL Params & Navigation
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialFilters = readUrlFilters(searchParams);
    const initialServiceTypes = parseServiceTypesParam(initialFilters.type);
    const previousUrlCategoryRef = useRef(initialFilters.category);
    const pendingRegionCodeRef = useRef<string | null>(null);

    // State
    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [expandedCategory, setExpandedCategory] = useState<string | null>(initialFilters.category || null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialFilters.category || '');
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

    const [selectedRegionCode, setSelectedRegionCode] = useState<string>(initialFilters.region);
    const [selectedCommunes, setSelectedCommunes] = useState<string[]>(initialFilters.commune ? initialFilters.commune.split(',') : []);
    const selectedLocation = selectedRegionCode ? selectedCommunes.join(',') : '';
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 100000]);
    const [serviceTypes, setServiceTypes] = useState<string[]>(initialServiceTypes); // 'presencial', 'online', 'hibrido'
    const [searchTerm, setSearchTerm] = useState(initialFilters.q);
    const [internalSearchInput, setInternalSearchInput] = useState(initialFilters.q);
    const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

    const syncFiltersToUrl = useCallback((nextFilters: Partial<UrlFilters>) => {
        const nextQ = nextFilters.q ?? searchTerm;
        const nextCategory = nextFilters.category ?? selectedCategoryId;
        const nextRegion = nextFilters.region ?? selectedRegionCode;
        const nextCommune = nextRegion ? (nextFilters.commune ?? selectedCommunes.join(',')) : '';
        const nextType = nextFilters.type ?? serviceTypes.join(',');

        const nextSearch = buildUrlSearch({
            q: nextQ,
            category: nextCategory,
            region: nextRegion,
            commune: nextCommune,
            type: nextType,
        });
        if (nextSearch === searchParams.toString()) return;

        navigate({ search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
    }, [navigate, searchParams, searchTerm, selectedCategoryId, selectedRegionCode, selectedCommunes, serviceTypes]);

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

    // Fetch Services
    useEffect(() => {
        const controller = new AbortController();

        const fetchServices = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (searchTerm.trim()) params.set('q', searchTerm.trim());
                if (selectedCategoryId) params.set('category', selectedCategoryId);
                if (selectedRegionCode) params.set('region', selectedRegionCode);
                if (selectedLocation) params.set('commune', selectedLocation);

                const queryString = params.toString();
                const res = await api.get(`/services${queryString ? `?${queryString}` : ''}`, {
                    signal: controller.signal
                });
                if (res.data.status === 'success') {
                    const mapped = res.data.services.map((s: any) => {
                        const cats = parseArrayField(s.categories_json);
                        const serviceSubs = cats.map((c: any) => c.subcategory).filter(Boolean);

                        return {
                            id: s.id,
                            title: s.title,
                            description: s.description || '',
                            provider: s.provider_name || 'Proveedor',
                            provider_name: s.provider_name,
                            providerId: s.provider_id,
                            rating: 5.0, // Mock
                            reviews: 0,
                            price: typeof s.price === 'string' ? parseFloat(s.price) : s.price,
                            priceUnit: s.price_unit || '',
                            categoryId: s.category,
                            subcategories: serviceSubs,
                            type: s.type || 'presencial',
                            location: s.location || '',
                            coverage_region_code: s.coverage_region_code || '',
                            coverage_region_name: s.coverage_region_name || '',
                            coverage_communes: parseArrayField(s.coverage_communes),
                            video_url: s.video_url || null,
                            image_urls: parseArrayField(s.image_urls),
                            cover_image_url: s.cover_image_url || null,
                            gallery_media: parseArrayField(s.gallery_media),
                            targetKeywords: parseArrayField(s.target_keywords),
                            isSponsored: Boolean(s.isSponsored ?? s.is_sponsored)
                        };
                    });
                    setServices(mapped);
                }
            } catch (error: any) {
                if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                    return;
                }
                console.error("Error fetching services:", error);
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        fetchServices();

        return () => controller.abort();
    }, [searchTerm, selectedCategoryId, selectedRegionCode, selectedLocation]);

    // Update filters if URL params change
    useEffect(() => {
        const sanitized = readUrlFilters(searchParams);
        const cat = sanitized.category;
        const sanitizedSearch = buildUrlSearch(sanitized);
        const categoryChanged = previousUrlCategoryRef.current !== cat;

        if (sanitizedSearch !== searchParams.toString()) {
            navigate({ search: sanitizedSearch ? `?${sanitizedSearch}` : '' }, { replace: true });
        }

        previousUrlCategoryRef.current = cat;
        pendingRegionCodeRef.current = null;

        setSearchTerm(sanitized.q);
        setInternalSearchInput(sanitized.q);
        setSelectedCategoryId(cat);
        setExpandedCategory(cat || null);
        if (categoryChanged) {
            setSelectedSubcategories([]);
        }
        setSelectedRegionCode(sanitized.region);
        setSelectedCommunes(sanitized.commune ? sanitized.commune.split(',') : []);
        setServiceTypes(parseServiceTypesParam(sanitized.type));
    }, [navigate, searchParams]);

    // Internal search handler — updates URL and searchTerm state
    const handleInternalSearch = () => {
        const trimmed = internalSearchInput.trim();
        setSearchTerm(trimmed);
        syncFiltersToUrl({ q: trimmed });
    };


    // Handlers
    const toggleCategory = (id: string) => {
        if (expandedCategory === id) {
            setExpandedCategory(null);
        } else {
            setExpandedCategory(id);
            if (selectedCategoryId !== id) {
                setSelectedCategoryId(id);
                setSelectedSubcategories([]);
                syncFiltersToUrl({ category: id });
            }
        }
    };

    const handleRegionChange = (regionCode: string) => {
        pendingRegionCodeRef.current = regionCode;
        setSelectedRegionCode(regionCode);
        setSelectedCommunes([]);
        syncFiltersToUrl({ region: regionCode, commune: '' });
    };

    const handleCommunesChange = (communes: string[]) => {
        const regionCode = pendingRegionCodeRef.current ?? selectedRegionCode;

        pendingRegionCodeRef.current = null;
        setSelectedCommunes(communes);
        syncFiltersToUrl({ region: regionCode, commune: communes.join(',') });
    };

    const toggleSubcategory = (sub: string) => {
        setSelectedSubcategories(prev =>
            prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
        );
    };

    const toggleServiceType = (type: string) => {
        const nextServiceTypes = serviceTypes.includes(type)
            ? serviceTypes.filter(t => t !== type)
            : [...serviceTypes, type];

        setServiceTypes(nextServiceTypes);
        syncFiltersToUrl({ type: nextServiceTypes.join(',') });
    };

    const resetFilters = () => {
        pendingRegionCodeRef.current = null;
        previousUrlCategoryRef.current = '';
        setSelectedCategoryId('');
        setSelectedSubcategories([]);
        setExpandedCategory(null);
        setSelectedRegionCode('');
        setSelectedCommunes([]);
        setPriceRange([0, 100000]);
        setServiceTypes([]);
        setSearchTerm('');
        setInternalSearchInput('');
        navigate('/search', { replace: true });
    };

    // Filtering Logic — Multi-field search
    const filteredServices = useMemo(() => {
        return services.filter(s => {
            // Multi-field search: ALL words must match somewhere in service data
            const matchSearch = searchTerm ? (() => {
                const words = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                return words.every(word => {
                    // Match in title
                    if (s.title.toLowerCase().includes(word)) return true;
                    // Match in provider name
                    if (s.provider.toLowerCase().includes(word)) return true;
                    // Match in description
                    if (s.description?.toLowerCase().includes(word)) return true;
                    // Match in category label (e.g., "clases" matches "Clases y Tutorías")
                    const catMatch = taxonomy.find(cat => cat.id === s.categoryId);
                    if (catMatch && catMatch.label.toLowerCase().includes(word)) return true;
                    // Match in category ID (e.g., "clases", "hogar")
                    if (s.categoryId?.toLowerCase().includes(word)) return true;
                    // Match in subcategory names
                    if (s.subcategories?.some((sub: string) => sub.toLowerCase().includes(word))) return true;
                    // Match paid promotion keywords returned by the backend
                    if (s.targetKeywords?.some((keyword: string) => keyword.toLowerCase().includes(word))) return true;
                    return false;
                });
            })() : true;

            // 1. Category Filter
            const matchCat = selectedCategoryId
                ? s.categoryId?.toLowerCase() === selectedCategoryId.toLowerCase()
                : true;

            // 2. Subcategory Filter
            // Check if ANY of the selected checkboxes matches ANY of the service's subcategories (partial match)
            // Filter: "Inglés" vs Service: "Idioma Inglés (Online)" -> MATCH
            const matchSub = selectedSubcategories.length > 0
                ? selectedSubcategories.some(filterSub =>
                    s.subcategories?.some((serviceSub: string) =>
                        serviceSub.toLowerCase().includes(filterSub.toLowerCase())
                    )
                )
                : true;

            // 3. Price Filter
            const matchPrice = s.price >= priceRange[0] && s.price <= priceRange[1];

            // 4. Service Type Filter
            const matchType = serviceTypes.length > 0 ? serviceTypes.includes(s.type) : true;

            return matchSearch && matchCat && matchSub && matchPrice && matchType;
        });
    }, [services, searchTerm, selectedCategoryId, selectedSubcategories, priceRange, serviceTypes]);

    return (
        <div className="bg-gray-50 min-h-screen py-8">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">

                {/* Search Bar + Header */}
                <div className="mb-8">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-6">
                        <div className="relative flex items-center">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar servicios, categorías o proveedores..."
                                className="w-full pl-12 pr-28 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-gray-50 text-gray-800 transition-all"
                                value={internalSearchInput}
                                onChange={(e) => setInternalSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleInternalSearch()}
                            />
                            <button
                                onClick={handleInternalSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-brand-primary hover:bg-brand-accent text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm"
                            >
                                Buscar
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between">
                        <h1 className="text-3xl font-bold text-gray-900">
                            {searchTerm ? `Resultados para "${searchTerm}"` : 'Explorar Servicios'}
                            <span className="text-gray-500 text-lg font-normal ml-2">({filteredServices.length} servicios)</span>
                        </h1>
                        <div className="mt-4 md:mt-0 flex items-center space-x-2">
                            <span className="text-gray-600 text-sm">Ordenar por:</span>
                            <select className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary/50 text-sm">
                                <option>Relevancia</option>
                                <option>Precio: Menor a Mayor</option>
                                <option>Precio: Mayor a Menor</option>
                                <option>Mejor Calificados</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Filters */}
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
                            <div className="flex items-center justify-between mb-6 border-b pb-4">
                                <h3 className="font-bold text-gray-900 flex items-center"><Filter size={20} className="mr-2" /> Filtros</h3>
                                <button
                                    onClick={resetFilters}
                                    className="text-xs text-brand-primary hover:underline font-medium"
                                >
                                    Limpiar todo
                                </button>
                            </div>

                            {/* 1. Categorías (Accordion) */}
                            <div className="mb-8">
                                <h4 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Categorías</h4>
                                <div className="space-y-1">
                                    {taxonomy.map(cat => {
                                        const isExpanded = expandedCategory === cat.id;
                                        const isSelected = selectedCategoryId === cat.id;

                                        return (
                                            <div key={cat.id} className="border-b border-gray-100 last:border-0">
                                                <button
                                                    onClick={() => toggleCategory(cat.id)}
                                                    className={`w-full flex items-center justify-between py-2.5 text-left text-sm font-medium transition-colors ${isSelected ? 'text-brand-primary' : 'text-gray-700 hover:text-brand-primary'}`}
                                                >
                                                    <span>{cat.label}</span>
                                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} className="text-gray-400" />}
                                                </button>

                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="pl-2 pb-3 space-y-2">
                                                                {cat.subcategories.map(sub => (
                                                                    <label key={sub} className="flex items-start cursor-pointer group">
                                                                        <div className="relative flex items-center h-5">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedSubcategories.includes(sub)}
                                                                                onChange={() => toggleSubcategory(sub)}
                                                                                className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer"
                                                                            />
                                                                        </div>
                                                                        <span className={`ml-2 text-xs ${selectedSubcategories.includes(sub) ? 'text-gray-900 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>
                                                                            {sub}
                                                                        </span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2. Modalidad (Service Type) */}
                            <div className="mb-8">
                                <h4 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Modalidad</h4>
                                <div className="space-y-2">
                                    {[
                                        { id: 'presencial', label: 'Presencial', icon: User },
                                        { id: 'online', label: 'Online', icon: Monitor },
                                        { id: 'hibrido', label: 'Híbrido', icon: Filter }
                                    ].map(type => (
                                        <label key={type.id} className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-all ${serviceTypes.includes(type.id) ? 'bg-brand-primary/5 border-brand-primary' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                                            <div className="flex items-center">
                                                <type.icon size={16} className={`mr-2 ${serviceTypes.includes(type.id) ? 'text-brand-primary' : 'text-gray-400'}`} />
                                                <span className={`text-sm ${serviceTypes.includes(type.id) ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{type.label}</span>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={serviceTypes.includes(type.id)}
                                                onChange={() => toggleServiceType(type.id)}
                                                className="h-4 w-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Ubicación */}
                            <div className="mb-8">
                                <LocationCoverageSelector
                                    regionCode={selectedRegionCode}
                                    communes={selectedCommunes}
                                    onRegionChange={handleRegionChange}
                                    onCommunesChange={handleCommunesChange}
                                    mode="multiple"
                                    label="Filtrar por comuna"
                                    helperText="Veras proveedores que atienden al menos una de las comunas seleccionadas."
                                />
                            </div>

                            {/* 4. Precio */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Presupuesto Máximo</h4>
                                <div className="px-1">
                                    <input
                                        type="range"
                                        min="0"
                                        max="100000"
                                        step="5000"
                                        value={priceRange[1]}
                                        onChange={(e) => setPriceRange([0, parseInt(e.target.value)])}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                                        <span>$0</span>
                                        <span>${priceRange[1].toLocaleString('es-CL')}</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Results Grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="text-center py-20 text-gray-500">Cargando servicios...</div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredServices.map(service => (
                                        <div key={service.id} className="h-full">
                                            <ServiceCard
                                                service={{
                                                    ...service,
                                                    isFavorite: favoriteIds.has(service.id)
                                                }}
                                                isSponsored={service.isSponsored}
                                            />
                                        </div>
                                    ))}
                                </div>

                                {filteredServices.length === 0 && (
                                    <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                                        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Search className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No encontramos resultados</h3>
                                        <p className="text-gray-500 max-w-md mx-auto">
                                            Intenta ajustar los filtros, usar términos más generales o cambiar la ubicación de búsqueda.
                                        </p>
                                        <button
                                            onClick={resetFilters}
                                            className="mt-6 px-6 py-2 bg-brand-primary text-white rounded-md font-medium hover:bg-orange-600 transition-colors shadow-sm"
                                        >
                                            Limpiar todos los filtros
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchResultsPage;
