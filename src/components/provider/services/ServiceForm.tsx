import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { Service, DailySchedule, ServiceAttribute, GalleryMediaItem, FreightVehicle } from '../../../types';
import { X, Calendar, Video, Upload, PlayCircle, AlertCircle, CheckSquare, Square, Clock, Tag, Plus, Trash2, ChevronRight, HelpCircle, Copy, ImageIcon, Camera, Truck, MapPin } from 'lucide-react';
import ToggleSwitch from '../../admin/provider-management/ToggleSwitch';
import WeeklyScheduleGrid from './WeeklyScheduleGrid';
import VideoPlayer from '../../common/VideoPlayer';
import MediaGalleryUploader from '../../common/MediaGalleryUploader';
import FreightVehicleManager from './FreightVehicleManager';
import toast from 'react-hot-toast';

interface ServiceFormProps {
    service: Service | null;
    onSave: (service: Service) => void;
    onCancel: () => void;
}

const weekDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];



// Taxonomy Data (Single Source of Truth from PDF)
const serviceTaxonomy: Record<string, { label: string, subcategories: string[] }> = {
    'hogar': {
        label: 'Hogar y Mantención',
        subcategories: [
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
        ]
    },
    'clases': {
        label: 'Clases y Tutorías',
        subcategories: [
            "Matemáticas (A domicilio)", "Inglés (A domicilio)", "Lenguaje (A domicilio)", "Química (A domicilio)",
            "Física (A domicilio)", "Alemán (A domicilio)", "Matemáticas (Online)", "Idioma Inglés (Online)",
            "Lenguaje (Online)", "Química (Online)", "Física (Online)", "Idioma Alemán (Online)",
            "Entrenamiento Fitness (A domicilio)", "Defensa personal (A domicilio)",
            "Piano (A domicilio)", "Violín (A domicilio)", "Batería (A domicilio)", "Guitarra (A domicilio)",
            "Guitarra eléctrica (A domicilio)", "Bajo (A domicilio)", "Violonchelo (A domicilio)", "Canto (A domicilio)"
        ]
    },
    'salud': {
        label: 'Salud y Bienestar',
        subcategories: [
            "Psicólogo Adulto (A domicilio)", "Psicólogo niños (A domicilio)", "Psicólogo Adulto (Online)", "Psicólogo niños (Online)", "Médico general (Online)",
            "Peluquería adultos (A domicilio)", "Peluquería Niños (A domicilio)", "Enfermería inyecciones (A domicilio)", "Enfermería cuidado de (A domicilio)",
            "Nutricionista (A domicilio)", "Kinesiólogo (A domicilio)", "Médico general (A domicilio)"
        ]
    },
    'eventos': {
        label: 'Eventos y Entretenimiento',
        subcategories: [
            "Niñera por hora", "Decoración cumpleaños", "Payasos para eventos o cumpleaños", "Mago para eventos o cumpleaños", "Animación para eventos o cumpleaños",
            "Juegos inflables a domicilio", "Carritos de comida a domicilio"
        ]
    },
    'automoviles': {
        label: 'Automóviles',
        subcategories: [
            "Vulcanización a domicilio", "Vulcanización con retiro y entrega", "Servicio de grúa Lunes a Viernes (A domicilio)", "Servicio de grúa 24hrs (A domicilio)",
            "Servicio de grúa Lunes a Viernes (A ruta)", "Servicio de grúa 24hrs (A ruta)", "Grúa y Mecánico de diagnóstico (A ruta)", "Reemplazo de baterías a domicilio",
            "Lavado a domicilio de autos por fuera", "Lavado a domicilio de autos por dentro", "Lavado a domicilio de autos por dentro y por fuera",
            "Lavado de tapiz de autos", "Grabado de patentes en espejos y vidrios", "Pulido de focos"
        ]
    },
    'fletes': {
        label: 'Fletes',
        subcategories: [
            "Retiro de encomiendas menores y entrega a destino", "Retiro de encomiendas mayores y entrega a destino"
        ]
    },
    'colegio': {
        label: 'Colegio',
        subcategories: [
            "Elaboración y compra de regalos escolares", "Charlas educativas Educación Sexual", "Charlas educativas Salud mental", "Charlas educativas Uso de tecnología en menores"
        ]
    }
};

// Standard features list with descriptions (Mocked from Admin Config)
const standardFeaturesList: ServiceAttribute[] = [
    { id: '1', label: "Trae sus propios materiales", description: "El proveedor incluye todos los insumos necesarios para realizar el trabajo." },
    { id: '2', label: "Factura disponible", description: "El proveedor puede emitir factura electrónica afecta a IVA." },
    { id: '3', label: "Garantía de satisfacción", description: "Si no quedas conforme, el proveedor volverá a realizar el trabajo sin costo." },
    { id: '4', label: "Pet Friendly", description: "El proveedor utiliza productos seguros para mascotas o se siente cómodo trabajando con ellas cerca." },
    { id: '5', label: "Servicio Express", description: "Disponibilidad para realizar el servicio en menos de 24 horas." },
    { id: '6', label: "Habla Inglés", description: "El proveedor puede comunicarse fluidamente en inglés." },
    { id: '7', label: "Transporte incluido", description: "El precio incluye los costos de traslado dentro de la zona de cobertura." },
    { id: '8', label: "Seguro contra daños", description: "El servicio cuenta con un seguro de responsabilidad civil." }
];

// Default description template (Mocked from Admin Config)
const defaultDescriptionTemplate = `**Resumen del servicio:**
[Describe brevemente en qué consiste tu servicio]

**Características principales:**
- [Característica 1]
- [Característica 2]

**Requisitos previos:**
[Lo que necesitas del cliente]

**Garantía:**
[Detalles sobre tu garantía]`;

const initialSchedule: DailySchedule[] = weekDays.map(day => ({
    day,
    active: false,
    timeRanges: []
}));

const initialFormData: Omit<Service, 'id'> = {
    name: '',
    description: '',
    duration_minutes: 60,
    price_clp: 0,
    iva_clp: 0,
    type: 'online',
    availability_type: 'agenda',
    categories: [],
    calendar_config: { schedule: initialSchedule },
    requires_kyc: false,
    status: 'draft',
    videoUrl: '',
    coverImageUrl: '',
    imageUrls: [],
    galleryMedia: [],
    features: [],
    pricing_type: 'per_event',
};

const ServiceForm: React.FC<ServiceFormProps> = ({ service, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Omit<Service, 'id'>>(initialFormData);
    const [providerCoverage, setProviderCoverage] = useState<{
        coverage_area?: string;
        coverage_region_name?: string;
        coverage_communes?: string[];
    } | null>(null);

    // Freight-specific state
    const [freightVehicles, setFreightVehicles] = useState<FreightVehicle[]>([]);
    const [freightBasePrice, setFreightBasePrice] = useState<string>('');
    const [freightPricePerKm, setFreightPricePerKm] = useState<string>('');

    // Detect if any selected category is "fletes"
    const isFreightService = formData.categories.some(c => c.categoryId === 'fletes');
    const providerCoverageCommunes = Array.isArray(providerCoverage?.coverage_communes)
        ? providerCoverage.coverage_communes
        : [];
    const providerCoverageSummary = providerCoverage?.coverage_area
        || (providerCoverage?.coverage_region_name && providerCoverageCommunes.length > 0
            ? `${providerCoverage.coverage_region_name}: ${providerCoverageCommunes.join(', ')}`
            : providerCoverage?.coverage_region_name || '');

    // States for adding a category
    const [selectedCatId, setSelectedCatId] = useState('');
    const [selectedSub, setSelectedSub] = useState('');

    // Cover image upload states
    const [isUploadingCover, setIsUploadingCover] = useState(false);

    // Video upload states
    const [videoSourceType, setVideoSourceType] = useState<'url' | 'upload'>('url');
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);

    // Handle cover image upload
    const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            toast.error('La imagen es demasiado grande. El tamaño máximo es 5MB.');
            return;
        }

        setIsUploadingCover(true);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('cover', file);

            const token = sessionStorage.getItem('auth_token');
            if (!token) {
                toast.error('No se encontró un token de sesión. Por favor inicia sesión nuevamente.');
                setIsUploadingCover(false);
                return;
            }

            const response = await fetch('/api/services/upload-cover', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formDataUpload
            });

            const data = await response.json();

            if (response.ok && data.imageUrl) {
                setFormData(prev => ({ ...prev, coverImageUrl: data.imageUrl }));
                toast.success('Imagen de portada subida exitosamente.');
            } else {
                toast.error(`Error: ${data.message || 'Error desconocido'}`);
            }
        } catch (err) {
            console.error('Cover image upload error:', err);
            toast.error('Error al subir la imagen. Intenta nuevamente.');
        } finally {
            setIsUploadingCover(false);
        }
    };

    // Handle video file upload
    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error('El video es demasiado grande. El tamaño máximo es 50MB.');
            return;
        }

        setIsUploadingVideo(true);

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('video', file);

            // NOTE: authStore uses 'auth_token' key, not 'token'
            const token = sessionStorage.getItem('auth_token');
            if (!token) {
                toast.error("No se encontró un token de sesión. Por favor inicia sesión nuevamente.");
                setIsUploadingVideo(false);
                return;
            }

            const response = await fetch('/api/services/upload-video', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formDataUpload
            });

            const data = await response.json();

            if (response.ok && data.videoUrl) {
                setFormData(prev => ({ ...prev, videoUrl: data.videoUrl }));
                toast.success('Video subido exitosamente.');
            } else {
                toast.error(`Error del servidor: ${data.message || 'Error desconocido'}`);
            }
        } catch (err) {
            console.error('Video upload error:', err);
            toast.error('Error al subir el video. Intenta nuevamente.');
        } finally {
            setIsUploadingVideo(false);
        }
    };

    useEffect(() => {
        if (service) {
            setFormData(service);
            // Detect video source type from existing URL
            if (service.videoUrl) {
                if (service.videoUrl.startsWith('/uploads/')) {
                    setVideoSourceType('upload');
                } else {
                    setVideoSourceType('url');
                }
            }
            // Load freight data if editing a freight service
            if ((service as any).freight_base_price) {
                setFreightBasePrice(String((service as any).freight_base_price));
            }
            if ((service as any).freight_price_per_km) {
                setFreightPricePerKm(String((service as any).freight_price_per_km));
            }
            // Load vehicles from the API
            if (service.id) {
                fetch(`/api/freight/services/${service.id}/vehicles`)
                    .then(r => r.json())
                    .then(data => { if (data.vehicles) setFreightVehicles(data.vehicles); })
                    .catch(() => {});
            }
        } else {
            // If creating new, set the description template
            setFormData({
                ...initialFormData,
                description: defaultDescriptionTemplate
            });
        }
    }, [service]);

    useEffect(() => {
        const token = sessionStorage.getItem('auth_token');
        if (!token) return;

        fetch('/api/provider/profile', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                const profile = data?.profile;
                if (!profile) return;
                setProviderCoverage({
                    coverage_area: profile.coverage_area || '',
                    coverage_region_name: profile.coverage_region_name || '',
                    coverage_communes: Array.isArray(profile.coverage_communes) ? profile.coverage_communes : [],
                });
            })
            .catch(() => {
                setProviderCoverage(null);
            });
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number';

        setFormData(prev => {
            const newData = { ...prev, [name]: isNumber ? parseInt(value) || 0 : value };
            return newData;
        });
    };

    const handleAddCategory = () => {
        if (selectedCatId && selectedSub) {
            // Check if already exists
            const exists = formData.categories.some(c => c.categoryId === selectedCatId && c.subcategory === selectedSub);
            if (!exists) {
                setFormData(prev => ({
                    ...prev,
                    categories: [...prev.categories, { categoryId: selectedCatId, subcategory: selectedSub }]
                }));
                // Reset inputs
                setSelectedCatId('');
                setSelectedSub('');
            }
        }
    };

    const handleRemoveCategory = (index: number) => {
        setFormData(prev => ({
            ...prev,
            categories: prev.categories.filter((_, i) => i !== index)
        }));
    };



    const handleFeatureToggle = (featureLabel: string) => {
        const currentFeatures = formData.features || [];
        const newFeatures = currentFeatures.includes(featureLabel)
            ? currentFeatures.filter(f => f !== featureLabel)
            : [...currentFeatures, featureLabel];
        setFormData(prev => ({ ...prev, features: newFeatures }));
    };

    // --- Freight vehicle CRUD handlers ---
    const handleAddVehicle = useCallback(async (vehicle: Omit<FreightVehicle, 'id' | 'service_id' | 'is_available' | 'volume_m3'>) => {
        if (!service?.id) {
            // For new services, store locally (will be saved after service creation)
            const tempVehicle: FreightVehicle = {
                ...vehicle,
                id: `temp_${Date.now()}`,
                service_id: '',
                is_available: true,
                volume_m3: parseFloat(((vehicle.height_cm * vehicle.width_cm * vehicle.depth_cm) / 1000000).toFixed(2)),
            };
            setFreightVehicles(prev => [...prev, tempVehicle]);
            toast.success('Vehículo agregado');
            return;
        }
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`/api/freight/services/${service.id}/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(vehicle),
        });
        const data = await res.json();
        if (res.ok && data.vehicle) {
            setFreightVehicles(prev => [...prev, data.vehicle]);
            toast.success('Vehículo agregado');
        } else {
            toast.error(data.message || 'Error al agregar vehículo');
        }
    }, [service?.id]);

    const handleUpdateVehicle = useCallback(async (vehicleId: string, updates: Partial<FreightVehicle>) => {
        if (vehicleId.startsWith('temp_')) {
            setFreightVehicles(prev => prev.map(v => v.id === vehicleId ? {
                ...v, ...updates,
                volume_m3: parseFloat((((updates.height_cm || v.height_cm) * (updates.width_cm || v.width_cm) * (updates.depth_cm || v.depth_cm)) / 1000000).toFixed(2)),
            } : v));
            toast.success('Vehículo actualizado');
            return;
        }
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`/api/freight/services/${service?.id}/vehicles/${vehicleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (res.ok && data.vehicle) {
            setFreightVehicles(prev => prev.map(v => v.id === vehicleId ? data.vehicle : v));
            toast.success('Vehículo actualizado');
        } else {
            toast.error(data.message || 'Error al actualizar');
        }
    }, [service?.id]);

    const handleDeleteVehicle = useCallback(async (vehicleId: string) => {
        if (vehicleId.startsWith('temp_')) {
            setFreightVehicles(prev => prev.filter(v => v.id !== vehicleId));
            toast.success('Vehículo eliminado');
            return;
        }
        const token = sessionStorage.getItem('auth_token');
        const res = await fetch(`/api/freight/services/${service?.id}/vehicles/${vehicleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
            setFreightVehicles(prev => prev.filter(v => v.id !== vehicleId));
            toast.success('Vehículo eliminado');
        } else {
            toast.error('Error al eliminar vehículo');
        }
    }, [service?.id]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Freight-specific validation
        if (isFreightService) {
            if (!freightBasePrice || parseInt(freightBasePrice) <= 0) {
                toast.error("Debes indicar el valor base del flete.");
                return;
            }
            if (!freightPricePerKm || parseInt(freightPricePerKm) <= 0) {
                toast.error("Debes indicar el valor por kilómetro.");
                return;
            }
            if (freightVehicles.length === 0) {
                toast.error("Debes registrar al menos un vehículo para tu servicio de flete.");
                return;
            }
        } else {
            if (formData.price_clp <= 0) {
                toast.error("El precio debe ser mayor a cero.");
                return;
            }
        }
        if (!formData.coverImageUrl) {
            toast.error("Debes subir una imagen de portada para tu servicio.");
            return;
        }
        if (formData.categories.length === 0) {
            toast.error("Debes agregar al menos una categoría.");
            return;
        }

        const saveData: any = { ...formData, id: service?.id || '' };
        if (isFreightService) {
            saveData.freight_base_price = parseInt(freightBasePrice);
            saveData.freight_price_per_km = parseInt(freightPricePerKm);
            // Set price to 0 for freight — dynamic pricing is used
            saveData.price_clp = 0;
            // Attach temp vehicles for post-creation persistence
            const tempVehicles = freightVehicles.filter(v => String(v.id).startsWith('temp_'));
            if (tempVehicles.length > 0) {
                saveData._tempFreightVehicles = tempVehicles;
            }
        }
        onSave(saveData);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
            <h2 className="text-xl font-bold text-gray-800">{service ? 'Editar Servicio' : 'Crear Nuevo Servicio'}</h2>

            <div className={`rounded-lg border p-4 ${providerCoverageSummary ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                    <MapPin className={`mt-0.5 h-5 w-5 flex-shrink-0 ${providerCoverageSummary ? 'text-green-600' : 'text-amber-600'}`} />
                    <div className="min-w-0">
                        <h3 className={`text-sm font-bold ${providerCoverageSummary ? 'text-green-900' : 'text-amber-900'}`}>
                            Cobertura heredada del perfil
                        </h3>
                        {providerCoverageSummary ? (
                            <>
                                <p className="mt-1 text-sm text-green-800">
                                    Este servicio usara la cobertura configurada en Perfil y KYC.
                                </p>
                                <p className="mt-2 line-clamp-2 text-sm font-medium text-green-900">{providerCoverageSummary}</p>
                            </>
                        ) : (
                            <p className="mt-1 text-sm text-amber-800">
                                Aun no tienes region y comunas configuradas. Ve a Perfil y KYC para definir donde atiendes servicios presenciales.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Categorization Section */}
            <div className="border-b pb-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Tag size={20} className="mr-2 text-brand-secondary" /> Categorización
                </h3>
                <p className="text-sm text-gray-500 mb-4">Agrega todas las categorías que correspondan a tu servicio. Esto mejora tu visibilidad en las búsquedas.</p>

                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label htmlFor="catSelect" className="block text-sm font-medium text-gray-700 mb-1">Categoría Principal</label>
                        <select
                            id="catSelect"
                            value={selectedCatId}
                            onChange={(e) => { setSelectedCatId(e.target.value); setSelectedSub(''); }}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary py-3 px-4"
                        >
                            <option value="">Selecciona una categoría</option>
                            {Object.entries(serviceTaxonomy).map(([key, val]) => (
                                <option key={key} value={key}>{val.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 w-full">
                        <label htmlFor="subSelect" className="block text-sm font-medium text-gray-700 mb-1">Especialidad (Subcategoría)</label>
                        <select
                            id="subSelect"
                            value={selectedSub}
                            onChange={(e) => setSelectedSub(e.target.value)}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary py-3 px-4 disabled:bg-gray-100 disabled:text-gray-400"
                            disabled={!selectedCatId}
                        >
                            <option value="">Selecciona una especialidad</option>
                            {selectedCatId && serviceTaxonomy[selectedCatId]?.subcategories.map((sub) => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleAddCategory}
                        disabled={!selectedCatId || !selectedSub}
                        className="bg-brand-primary hover:bg-orange-600 text-white font-medium py-3 px-6 rounded-md shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                        <Plus size={18} className="mr-1" /> Agregar
                    </button>
                </div>

                {/* Selected Categories Chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                    {formData.categories.map((cat, index) => (
                        <div key={`${cat.categoryId}-${index}`} className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-full px-3 py-1 text-sm">
                            <span className="font-medium text-gray-700 mr-1">{serviceTaxonomy[cat.categoryId]?.label}:</span>
                            <span className="text-gray-600">{cat.subcategory}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveCategory(index)}
                                className="ml-2 text-gray-400 hover:text-red-500 rounded-full p-0.5"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {formData.categories.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No has agregado ninguna categoría aún.</p>
                    )}
                </div>
            </div>

            {/* Media Section */}
            <div className="border-b pb-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Camera size={20} className="mr-2 text-brand-secondary" /> Imagen y Video
                </h3>

                {/* COVER IMAGE - MANDATORY */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Imagen de Portada <span className="text-red-500">*</span>
                    </label>
                    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3 text-sm text-amber-800 flex items-start">
                        <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                        <p>Esta imagen se mostrará como portada de tu servicio en las tarjetas, búsquedas y listados. Usa una imagen representativa y de buena calidad.</p>
                    </div>

                    {formData.coverImageUrl ? (
                        <div className="relative group w-full max-w-md">
                            <img
                                src={formData.coverImageUrl}
                                alt="Portada del servicio"
                                className="w-full h-48 object-cover rounded-lg border-2 border-brand-primary/30 shadow-sm"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                                <label className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity bg-white text-gray-800 px-4 py-2 rounded-md font-medium text-sm shadow-lg hover:bg-gray-100">
                                    Cambiar imagen
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleCoverImageUpload}
                                        disabled={isUploadingCover}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                        </div>
                    ) : (
                        <label className="cursor-pointer block w-full max-w-md">
                            <div className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors ${
                                isUploadingCover ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-brand-primary/50'
                            }`}>
                                {isUploadingCover ? (
                                    <>
                                        <svg className="animate-spin h-8 w-8 text-brand-primary mb-2" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <p className="text-sm text-blue-600 font-medium">Subiendo imagen...</p>
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon size={36} className="text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-600 font-medium">Haz clic para subir tu imagen de portada</p>
                                        <p className="text-xs text-gray-400 mt-1">JPG, PNG o WEBP. Máximo 5MB.</p>
                                    </>
                                )}
                            </div>
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleCoverImageUpload}
                                disabled={isUploadingCover}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                {/* VIDEO SECTION - OPTIONAL */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 text-sm text-blue-800 flex items-start">
                    <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                    <p>El video demostrativo es opcional pero altamente recomendado. Ayuda a los clientes a conocer mejor tu trabajo.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Video Demostrativo (Opcional)</label>

                        {/* Tab selector for video source */}
                        <div className="flex gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => setVideoSourceType && setVideoSourceType('url')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${(!videoSourceType || videoSourceType === 'url')
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                URL de YouTube/Vimeo
                            </button>
                            <button
                                type="button"
                                onClick={() => setVideoSourceType && setVideoSourceType('upload')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${videoSourceType === 'upload'
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <Upload size={16} className="inline mr-1" /> Subir Video
                            </button>
                        </div>

                        {/* URL Input */}
                        {(!videoSourceType || videoSourceType === 'url') && (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Video size={32} className="text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600 mb-2">Pega la URL de tu video (YouTube o Vimeo)</p>
                                <input
                                    type="text"
                                    name="videoUrl"
                                    placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/..."
                                    value={formData.videoUrl || ''}
                                    onChange={handleChange}
                                    className="w-full max-w-sm text-sm border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
                                />
                                <p className="text-xs text-gray-400 mt-2">Soportamos YouTube y Vimeo.</p>
                            </div>
                        )}

                        {/* Upload Input */}
                        {videoSourceType === 'upload' && (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Upload size={32} className="text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600 mb-2">Sube un video desde tu equipo</p>
                                <input
                                    type="file"
                                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                                    onChange={handleVideoUpload}
                                    disabled={isUploadingVideo}
                                    className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-orange-600 disabled:opacity-50"
                                />
                                <p className="text-xs text-gray-400 mt-2">Máximo 50MB. Formatos: MP4, WebM, MOV.</p>
                                {isUploadingVideo && (
                                    <div className="mt-3 flex items-center text-sm text-blue-600">
                                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Subiendo video...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Previsualización</label>
                        <div className="bg-black rounded-lg overflow-hidden border border-gray-300">
                            <VideoPlayer url={formData.videoUrl} />
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                    <MediaGalleryUploader
                        items={formData.galleryMedia || []}
                        onChange={(newItems) => setFormData(prev => ({ ...prev, galleryMedia: newItems as GalleryMediaItem[] }))}
                        maxItems={10}
                    />
                </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre del Servicio</label>
                    <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2" />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descripción</label>
                    <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={8} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary font-mono text-sm" />
                    <p className="text-xs text-gray-500 mt-1">Usa la plantilla precargada como guía.</p>
                </div>

                <div className="md:col-span-2 border border-gray-200 rounded-lg p-5 bg-gray-50">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center">
                        <CheckSquare size={16} className="mr-2 text-brand-secondary" /> ¿Qué incluye tu servicio?
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {standardFeaturesList.map((feature) => {
                            const isSelected = formData.features?.includes(feature.label);
                            return (
                                <div
                                    key={feature.id}
                                    className={`flex items-center justify-between p-3 rounded-md border transition-all duration-200 ${isSelected
                                        ? 'bg-white border-brand-secondary shadow-sm ring-1 ring-brand-secondary/20'
                                        : 'bg-gray-100 border-transparent hover:bg-white hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center cursor-pointer flex-grow" onClick={() => handleFeatureToggle(feature.label)}>
                                        <div className={`mr-3 ${isSelected ? 'text-brand-secondary' : 'text-gray-400'}`}>
                                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                        </div>
                                        <span className={`text-sm ${isSelected ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                            {feature.label}
                                        </span>
                                    </div>
                                    <div className="ml-2 group relative">
                                        <HelpCircle size={16} className="text-gray-400 cursor-help" />
                                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-800 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                                            {feature.description}
                                            <div className="absolute top-full right-1 w-2 h-2 bg-gray-800 transform rotate-45 -translate-y-1"></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* === FREIGHT CONFIGURATION SECTION === */}
                {isFreightService && (
                    <div className="md:col-span-2 border-2 border-indigo-200 rounded-lg p-5 bg-indigo-50/30">
                        <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center">
                            <Truck size={20} className="mr-2 text-indigo-600" /> Configuración de Flete
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Configura tus vehículos y tarifas para el servicio de flete.</p>

                        {/* Freight pricing */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Valor Base por Viaje/Vehículo (CLP)</label>
                                <input
                                    type="number"
                                    value={freightBasePrice}
                                    onChange={(e) => setFreightBasePrice(e.target.value)}
                                    placeholder="15000"
                                    min={0}
                                    className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"
                                />
                                <p className="text-xs text-gray-400 mt-1">Costo fijo mínimo por cada viaje o vehículo utilizado.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Valor por Kilómetro (CLP/km)</label>
                                <input
                                    type="number"
                                    value={freightPricePerKm}
                                    onChange={(e) => setFreightPricePerKm(e.target.value)}
                                    placeholder="500"
                                    min={0}
                                    className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2"
                                />
                                <p className="text-xs text-gray-400 mt-1">Cobro adicional por cada km recorrido.</p>
                            </div>
                        </div>

                        {/* Example price */}
                        {freightBasePrice && freightPricePerKm && (
                            <div className="bg-white border border-indigo-100 rounded-md p-3 mb-5 text-sm">
                                <span className="text-gray-500">Ejemplo:</span> Un viaje de 20 km costaría <strong className="text-indigo-700">${(parseInt(freightBasePrice) + 20 * parseInt(freightPricePerKm)).toLocaleString('es-CL')} CLP</strong>
                            </div>
                        )}

                        {/* Vehicles manager */}
                        <FreightVehicleManager
                            vehicles={freightVehicles}
                            onAdd={handleAddVehicle}
                            onUpdate={handleUpdateVehicle}
                            onDelete={handleDeleteVehicle}
                        />
                    </div>
                )}

                {!isFreightService && (
                <div>
                    <label htmlFor="price_clp" className="block text-sm font-medium text-gray-700">Precio (CLP)</label>
                    <input type="number" name="price_clp" id="price_clp" value={formData.price_clp} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2" />
                </div>
                )}
                <div>
                    <label htmlFor="pricing_type" className="block text-sm font-medium text-gray-700">¿Cómo se cobra este servicio?</label>
                    <select name="pricing_type" id="pricing_type" value={formData.pricing_type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2">
                        <option value="per_event">Por evento (Ej: Reparación de lavadora)</option>
                        <option value="per_hour">Por hora (Ej: Niñera, Clases)</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700">Duración (minutos)</label>
                    <input type="number" name="duration_minutes" id="duration_minutes" step="30" value={formData.duration_minutes} onChange={handleChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2" />
                </div>
                <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700">Tipo de Servicio</label>
                    <select name="type" id="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2">
                        <option value="online">Online</option>
                        <option value="presencial">Presencial</option>
                        <option value="hibrido">Híbrido</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="availability_type" className="block text-sm font-medium text-gray-700">Disponibilidad</label>
                    <select name="availability_type" id="availability_type" value={formData.availability_type} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-brand-secondary focus:border-brand-secondary px-3 py-2">
                        <option value="agenda">Por Agenda</option>
                        <option value="inmediato">Inmediato</option>
                        <option value="24h">En 24 horas</option>
                    </select>
                </div>
            </div>

            {/* Granular Agenda Configuration */}
            {formData.availability_type === 'agenda' && (
                <div className="p-4 border border-gray-200 rounded-md space-y-4 bg-gray-50">
                    <h3 className="font-semibold flex items-center text-gray-800"><Calendar size={18} className="mr-2" />Configuración de Agenda Semanal</h3>
                    <p className="text-sm text-gray-500">Selecciona los bloques horarios en los que estarás disponible. Haz clic y arrastra para seleccionar múltiples celdas.</p>

                    <WeeklyScheduleGrid
                        schedule={formData.calendar_config?.schedule || initialSchedule}
                        onChange={(newSchedule) => {
                            setFormData(prev => ({
                                ...prev,
                                calendar_config: { schedule: newSchedule }
                            }));
                        }}
                    />
                </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t">
                <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md transition duration-300">
                    Cancelar
                </button>
                <button type="submit" className="bg-brand-secondary hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-300">
                    Guardar Servicio
                </button>
            </div>
        </form >
    );
};

export default ServiceForm;
