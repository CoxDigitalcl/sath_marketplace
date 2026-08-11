
import React, { useState, useEffect } from 'react';
import { User, Building, AtSign, Phone, Link, Banknote, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Eye, Save, Info } from 'lucide-react';
import { api } from '../../../api/client';
import toast from 'react-hot-toast';
import ChangePasswordSection from '../../common/ChangePasswordSection';
import LocationCoverageSelector from '../../common/LocationCoverageSelector';

// Helper to validate Chilean RUT (Modulo 11)
const validateChileanRut = (rut: string): boolean => {
    if (!rut) return false;
    const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (clean.length < 2) return false;
    
    const body = clean.slice(0, -1);
    const dv = clean.slice(-1);
    
    let sum = 0;
    let multiplier = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i], 10) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const remainder = 11 - (sum % 11);
    let expectedDv = remainder === 11 ? '0' : remainder === 10 ? 'K' : remainder.toString();
    
    return dv === expectedDv;
};

const parseCoverageCommunes = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((commune): commune is string => typeof commune === 'string');
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed)
                ? parsed.filter((commune): commune is string => typeof commune === 'string')
                : [];
        } catch {
            return [];
        }
    }

    return [];
};

// --- INITIAL STATE ---
const initialProfileData = {
    storeName: '',
    publicDescription: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    instagram: '',
    coverageRegionCode: '',
    coverageCommunes: [],
    coverageArea: '',
    profilePicture: '',
    profilePictureStatus: 'approved',
    profilePictureRejectionReason: '',
    bannerImage: '',
    bannerImageStatus: 'approved',
    bannerRejectionReason: '',
    bankDetails: {
        accountHolder: '',
        rut: '',
        bank: '',
        accountType: '',
        accountNumber: ''
    },
    kycStatus: 'Pendiente',
    kycDocuments: {} // Store backend kyc json here
};
// --- INICIO LISTADOS BANCARIOS ---
const CHILEAN_BANKS = [
    'Banco BICE',
    'Banco Condell',
    'Banco Consorcio',
    'Banco de Chile / Edwards',
    'Banco del Desarrollo',
    'Banco Estado',
    'Banco Falabella',
    'Banco Internacional',
    'Banco Itaú',
    'Banco Ripley',
    'Banco Santander',
    'Banco Scotiabank',
    'Banco Security',
    'BCI',
    'Caja Los Andes',
    'Coopeuch',
    'Los Héroes',
    'Mach',
    'Mercado Pago',
    'Prepago Los Héroes',
    'Tenpo'
];

const ACCOUNT_TYPES = [
    'Cuenta Corriente',
    'Cuenta Vista',
    'Cuenta RUT',
    'Cuenta de Ahorro'
];
// --- FIN LISTADOS BANCARIOS ---

// --- END INITIAL STATE ---

const DocumentRow: React.FC<{
    label: string,
    docKey: string,
    docData: any, // { url: string, status: string, rejectionReason?: string }
    onFileChange: (key: string, file: File) => void,
    acceptedFormats?: string,
    description?: string
}> = ({ label, docKey, docData, onFileChange, acceptedFormats, description }) => {

    // Map backend status to UI status
    const statusMap: Record<string, string> = {
        'pending': 'Pendiente',
        'approved': 'Aprobado',
        'rejected': 'Rechazado'
    };

    const status = statusMap[docData?.status] || 'Pendiente';
    const hasFile = !!docData?.url;

    const statusConfig = {
        'Aprobado': { icon: CheckCircle, color: 'text-green-500' },
        'Pendiente': { icon: Clock, color: 'text-yellow-500' },
        'Rechazado': { icon: XCircle, color: 'text-red-500' },
    };

    const Icon = statusConfig[status as keyof typeof statusConfig]?.icon || Clock;
    const color = statusConfig[status as keyof typeof statusConfig]?.color || 'text-gray-500';

    return (
        <li className="py-3 border-b last:border-0">
            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <Icon size={20} className={`mr-3 ${color}`} />
                    <div>
                        <p className="font-medium text-gray-800">{label}</p>
                        {description && !hasFile && (
                            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                        )}
                        {status === 'Rechazado' && docData?.rejectionReason && (
                            <p className="text-xs text-red-600 flex items-center mt-1 font-medium">
                                <Info size={12} className="mr-1" /> Motivo: {docData.rejectionReason}
                            </p>
                        )}
                        {!hasFile && !description && <p className="text-xs text-gray-400">No subido</p>}
                        {hasFile && status === 'Pendiente' && <p className="text-xs text-yellow-600 font-medium">En Revisión</p>}
                    </div>
                </div>
                <label className={`cursor-pointer text-sm font-medium px-4 py-2 rounded-md transition-colors flex items-center ${hasFile
                    ? (status === 'Rechazado' ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'text-brand-secondary hover:opacity-80')
                    : 'bg-brand-primary text-white hover:bg-orange-600 shadow-sm'
                    }`}>
                    {hasFile ? (status === 'Rechazado' ? 'Subir Nueva Versión' : 'Reemplazar') : 'Subir Documento'}
                    <input type="file" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) onFileChange(docKey, e.target.files[0]);
                    }} accept={acceptedFormats || '.pdf,.jpg,.jpeg,.png'} />
                </label>
            </div>
        </li>
    );
};

const ImageStatusBadge: React.FC<{ status: string; reason?: string }> = ({ status, reason }) => {
    if (status === 'approved') return null;

    return (
        <div className="absolute top-2 right-2 flex flex-col items-end">
            <span className={`text-xs font-bold px-2 py-1 rounded shadow-sm ${status === 'pending' ? 'bg-yellow-400 text-yellow-900' : 'bg-red-500 text-white'
                }`}>
                {status === 'pending' ? 'En Revisión' : 'Rechazada'}
            </span>
            {status === 'rejected' && reason && (
                <div className="bg-white/90 backdrop-blur text-red-600 text-[10px] px-2 py-1 rounded mt-1 shadow-sm max-w-[150px] text-right leading-tight border border-red-200">
                    {reason}
                </div>
            )}
        </div>
    );
};


const ProviderProfile: React.FC = () => {
    const [profile, setProfile] = useState<any>(initialProfileData);
    const [loading, setLoading] = useState(true);
    const [selectedFiles, setSelectedFiles] = useState<Record<string, File>>({});
    const [userId, setUserId] = useState<string | null>(null);
    const [kycRequirements, setKycRequirements] = useState<any[]>([]);

    // On mount: get userId from auth storage
    React.useEffect(() => {
        try {
            const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
            const id = authData?.state?.user?.id;
            if (id) setUserId(id);
        } catch (e) {
            console.error('Failed to get user ID from auth storage');
        }
    }, []);

    React.useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/provider/profile');
                if (res.data.status === 'success') {
                    const p = res.data.profile;
                    const kycDocs = p.kyc_documents || {};
                    const bankData = p.bank_data || {};
                    const coverageCommunes = parseCoverageCommunes(p.coverage_communes);

                    setProfile({
                        storeName: p.store_name || '',
                        publicDescription: p.bio || '',
                        contactEmail: p.contact_email || '',
                        contactPhone: p.public_phone || '',
                        website: p.public_website || '',
                        instagram: p.instagram_handle || '',
                        coverageRegionCode: p.coverage_region_code || '',
                        coverageCommunes,
                        coverageArea: p.coverage_area || '',
                        profilePicture: p.profile_image_url || '',
                        profilePictureStatus: p.profile_image_status || 'approved',
                        profilePictureRejectionReason: p.profile_image_rejection_reason || '',
                        bannerImage: p.banner_image_url || '',
                        bannerImageStatus: p.banner_image_status || 'approved',
                        bannerRejectionReason: p.banner_image_rejection_reason || '',
                        bankDetails: {
                            accountHolder: bankData.accountHolder || '',
                            rut: bankData.rut || '',
                            bank: bankData.bank || '',
                            accountType: bankData.accountType || '',
                            accountNumber: bankData.accountNumber || ''
                        },
                        kycStatus: p.is_verified ? 'Verificado' : 'Pendiente',
                        kycDocuments: kycDocs
                    });
                }
            } catch (err) {
                // Silently handle error or set state
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>, section?: string) => {
        const { name, value } = e.target;
        
        let finalValue = value;
        // Auto-formateo del RUT
        if (name === 'rut') {
            let cleanRut = value.replace(/[^0-9kK]/g, '');
            if (cleanRut.length > 0) {
                const dv = cleanRut.slice(-1).toUpperCase();
                let body = cleanRut.slice(0, -1);
                body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                finalValue = body ? `${body}-${dv}` : dv;
            } else {
                finalValue = '';
            }
        }
        
        if (section) {
            setProfile((prev: any) => ({
                ...prev,
                [section]: {
                    ...(prev[section as keyof typeof prev] as object),
                    [name]: finalValue
                }
            }));
        } else {
            setProfile((prev: any) => ({ ...prev, [name]: finalValue }));
        }
    };

    const handleFileChange = (key: string, file: File) => {
        setSelectedFiles(prev => ({ ...prev, [key]: file }));

        // Preview for images
        if (key === 'profile_image' || key === 'banner_image') {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setProfile((prev: any) => ({
                        ...prev,
                        [key === 'profile_image' ? 'profilePicture' : 'bannerImage']: e.target?.result,
                        [key === 'profile_image' ? 'profilePictureStatus' : 'bannerImageStatus']: 'pending'
                    }));
                }
            };
            reader.readAsDataURL(file);
        } else {
            // For KYC documents, update status to 'pending' immediately for UI feedback
            setProfile((prev: any) => ({
                ...prev,
                kycDocuments: {
                    ...prev.kycDocuments,
                    [key]: {
                        ...prev.kycDocuments[key],
                        status: 'pending',
                        url: 'pending_upload' // Mock url to trigger "hasFile" check
                    }
                }
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (profile.bankDetails.rut && !validateChileanRut(profile.bankDetails.rut)) {
            toast.error('El RUT ingresado no es válido (dígito verificador incorrecto).');
            return;
        }

        const coverageCommunes = Array.isArray(profile.coverageCommunes) ? profile.coverageCommunes : [];
        if (profile.coverageRegionCode && coverageCommunes.length === 0) {
            toast.error('Selecciona al menos una comuna para la cobertura del servicio.');
            return;
        }

        try {
            const formData = new FormData();
            // Text fields
            formData.append('store_name', profile.storeName);
            formData.append('bio', profile.publicDescription);
            formData.append('contact_email', profile.contactEmail);
            formData.append('public_phone', profile.contactPhone);
            formData.append('public_website', profile.website);
            formData.append('instagram_handle', profile.instagram);
            formData.append('coverage_region_code', profile.coverageRegionCode);
            formData.append('coverage_communes', JSON.stringify(coverageCommunes));

            // Bank Details (Send as JSON string)
            formData.append('bank_data', JSON.stringify(profile.bankDetails));

            // Files
            Object.keys(selectedFiles).forEach(key => {
                formData.append(key, selectedFiles[key]);
            });

            // Do NOT set Content-Type manually — axios auto-detects FormData
            // BUT we must strip the 'application/json' default from the instance
            // so Axios can compute the correct boundary.
            const res = await api.post('/provider/profile', formData, {
                headers: { 'Content-Type': undefined }
            });

            if (res.data.status === 'success') {
                toast.success('Perfil actualizado exitosamente.');
                // Refresh kyc doc status in local state if needed
                window.location.reload();
            }

        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            toast.error(message || "Error al guardar perfil.");
        }
    };

    // Fetch KYC requirements from DB
    useEffect(() => {
        const fetchKycReqs = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/provider/kyc-requirements', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'success' && data.data.length > 0) {
                        setKycRequirements(data.data);
                        return;
                    }
                }
            } catch (err) {
                console.error('Error fetching KYC requirements:', err);
            }
            // Fallback if API fails
            setKycRequirements([
                { id: 'kyc_id_front', name: 'Cédula de Identidad (Frente)', accepted_formats: '.jpg,.jpeg,.png' },
                { id: 'kyc_id_back', name: 'Cédula de Identidad (Dorso)', accepted_formats: '.jpg,.jpeg,.png' },
                { id: 'kyc_sii', name: 'Carpeta Tributaria (SII)', accepted_formats: '.pdf,.jpg,.jpeg,.png' },
                { id: 'kyc_address', name: 'Comprobante de Domicilio', accepted_formats: '.pdf,.jpg,.jpeg,.png' },
                { id: 'kyc_criminal_record', name: 'Certificado de Antecedentes', accepted_formats: '.pdf' }
            ]);
        };
        fetchKycReqs();
    }, []);

    if (loading) return <div>Cargando perfil...</div>;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Perfil de Tienda y KYC</h1>
                    <p className="mt-1 text-gray-600">Configura tu información pública y sube los documentos para la verificación.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => userId && window.open(`/provider/${userId}`, '_blank')}
                        disabled={!userId}
                        className={`flex items-center justify-center gap-2 w-full sm:w-auto font-semibold py-2 px-4 rounded-md transition-colors duration-300 ${userId
                            ? 'bg-gray-200 hover:bg-gray-300 text-gray-800 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Eye size={18} />
                        <span>Ver Perfil Público</span>
                    </button>
                    <button type="submit" className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-secondary hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-300">
                        <Save size={18} />
                        <span>Guardar Cambios</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Public Information */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Building size={20} className="mr-2 text-brand-secondary" />Información Pública</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="storeName" className="block text-sm font-medium text-gray-700">Nombre de la Tienda</label>
                                <input type="text" id="storeName" name="storeName" value={profile.storeName} onChange={handleChange} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="publicDescription" className="block text-sm font-medium text-gray-700">Descripción Pública</label>
                                <textarea id="publicDescription" name="publicDescription" value={profile.publicDescription} onChange={handleChange} rows={4} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">Email de Contacto <span className="text-red-500">*</span></label>
                                <input type="email" id="contactEmail" name="contactEmail" required value={profile.contactEmail} onChange={handleChange} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">Teléfono de Contacto <span className="text-red-500">*</span></label>
                                <input type="tel" id="contactPhone" name="contactPhone" required value={profile.contactPhone} onChange={handleChange} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            
                            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mt-4 flex items-start text-yellow-800 text-sm">
                                <Info size={18} className="mr-2 flex-shrink-0 mt-0.5" />
                                <p>Tu <strong>correo electrónico</strong> y <strong>teléfono</strong> son de carácter privado en tu perfil público. <strong>Solo</strong> se compartirán con aquellos clientes que hayan reservado y pagado a través de nuestra plataforma, favoreciendo tu contratación.</p>
                            </div>

                            <div className="border-t border-gray-200 pt-4 mt-4">
                                <LocationCoverageSelector
                                    regionCode={profile.coverageRegionCode}
                                    communes={profile.coverageCommunes}
                                    onRegionChange={(coverageRegionCode) => setProfile((prev: any) => ({ ...prev, coverageRegionCode }))}
                                    onCommunesChange={(coverageCommunes) => setProfile((prev: any) => ({ ...prev, coverageCommunes }))}
                                    label="Cobertura del servicio"
                                    helperText="Elige la region y comunas donde atiendes servicios presenciales. Esta informacion se usara en busqueda y checkout."
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bank Details for Payouts */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Banknote size={20} className="mr-2 text-brand-secondary" />Datos Bancarios para Pagos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700">Nombre del Titular</label>
                                <input type="text" id="accountHolder" name="accountHolder" value={profile.bankDetails.accountHolder} onChange={(e) => handleChange(e, 'bankDetails')} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="rut" className="block text-sm font-medium text-gray-700">RUT del Titular</label>
                                <input type="text" id="rut" name="rut" value={profile.bankDetails.rut} onChange={(e) => handleChange(e, 'bankDetails')} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                            <div>
                                <label htmlFor="bank" className="block text-sm font-medium text-gray-700">Banco</label>
                                <select 
                                    id="bank" 
                                    name="bank" 
                                    value={profile.bankDetails.bank} 
                                    onChange={(e) => handleChange(e, 'bankDetails')} 
                                    className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors"
                                >
                                    <option value="">Seleccione un banco</option>
                                    {CHILEAN_BANKS.map(banco => (
                                        <option key={banco} value={banco}>{banco}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">Tipo de Cuenta</label>
                                <select 
                                    id="accountType" 
                                    name="accountType" 
                                    value={profile.bankDetails.accountType} 
                                    onChange={(e) => handleChange(e, 'bankDetails')} 
                                    className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors"
                                >
                                    <option value="">Seleccione tipo de cuenta</option>
                                    {ACCOUNT_TYPES.map(tipo => (
                                        <option key={tipo} value={tipo}>{tipo}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">Número de Cuenta</label>
                                <input type="text" id="accountNumber" name="accountNumber" value={profile.bankDetails.accountNumber} onChange={(e) => handleChange(e, 'bankDetails')} className="mt-1.5 block w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-secondary/30 focus:border-brand-secondary transition-colors" />
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <ChangePasswordSection />
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><User size={20} className="mr-2 text-brand-secondary" />Imágenes de Perfil</h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Foto de Perfil o Logo</label>
                                <div className="relative inline-block">
                                    <img src={profile.profilePicture || '/placeholder-avatar.png'} alt="Profile" className="w-20 h-20 rounded-full object-cover border border-gray-200" />
                                    <ImageStatusBadge status={profile.profilePictureStatus} reason={profile.profilePictureRejectionReason} />
                                </div>
                                <div className="mt-4">
                                    <label className="inline-flex items-center justify-center w-full px-4 py-2 border border-brand-secondary rounded-md shadow-sm text-sm font-medium text-brand-secondary bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-colors cursor-pointer">
                                        <Upload size={16} className="mr-2" />
                                        Cambiar Foto
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                            if (e.target.files?.[0]) handleFileChange('profile_image', e.target.files[0]);
                                        }} />
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Imagen de Banner</label>
                                <div className="relative">
                                    <img src={profile.bannerImage || '/placeholder-banner.png'} alt="Banner" className="w-full h-24 rounded-md object-cover border border-gray-200" />
                                    <ImageStatusBadge status={profile.bannerImageStatus} reason={profile.bannerRejectionReason} />
                                </div>
                                <div className="mt-4">
                                    <label className="inline-flex items-center justify-center w-full px-4 py-2 border border-brand-secondary rounded-md shadow-sm text-sm font-medium text-brand-secondary bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary transition-colors cursor-pointer">
                                        <Upload size={16} className="mr-2" />
                                        Cambiar Banner
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                            if (e.target.files?.[0]) handleFileChange('banner_image', e.target.files[0]);
                                        }} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`bg-white p-6 rounded-lg shadow-sm border ${profile.kycStatus !== 'Verificado' ? 'border-orange-300 ring-4 ring-orange-50 shadow-lg' : 'border-gray-200'}`}>
                        <h2 className={`text-lg font-semibold mb-2 ${profile.kycStatus !== 'Verificado' ? 'text-orange-700' : 'text-gray-800'}`}>Estado de Verificación (KYC)</h2>
                        {profile.kycStatus !== 'Verificado' && (
                            <div className="flex items-start p-3 rounded-md bg-orange-50 text-orange-800 border border-orange-200 mb-4 animate-pulse">
                                <AlertTriangle size={20} className="mr-3 mt-0.5 flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-sm">Acción Requerida</h3>
                                    <p className="text-xs mt-1">Sube tus documentos para verificar tu identidad y activar tu cuenta.</p>
                                </div>
                            </div>
                        )}
                        <ul className="mt-4">
                            {kycRequirements.map(item => (
                                <DocumentRow
                                    key={item.id}
                                    label={item.name}
                                    docKey={item.id}
                                    docData={profile.kycDocuments[item.id]}
                                    onFileChange={handleFileChange}
                                    acceptedFormats={item.accepted_formats}
                                    description={item.description}
                                />
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default ProviderProfile;
