import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    Edit2,
    ExternalLink,
    Loader2,
    MessageCircle,
    Phone,
    Plus,
    Save,
    Trash2,
    Upload,
    UserRound,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ToggleSwitch from '../provider-management/ToggleSwitch';
import {
    buildWhatsAppUrl,
    createWhatsAppAgent,
    DEFAULT_WHATSAPP_SETTINGS,
    getInitialsFromName,
    normalizeWhatsAppSettings,
    sanitizeWhatsAppPhone,
    WhatsAppAgent,
    WhatsAppSettings as WhatsAppSettingsShape,
} from '../../common/whatsappConfig';

const adminFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, { ...options, headers });
};

const AgentAvatar: React.FC<{ agent: WhatsAppAgent; size?: 'sm' | 'md' | 'lg' }> = ({ agent, size = 'md' }) => {
    const sizeClass = {
        sm: 'h-9 w-9 text-xs',
        md: 'h-12 w-12 text-sm',
        lg: 'h-16 w-16 text-base',
    }[size];

    return (
        <div className={`${sizeClass} flex-shrink-0 overflow-hidden rounded-full bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/10`}>
            {agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt={agent.name || 'Agente WhatsApp'} className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center font-bold">
                    {agent.initials || getInitialsFromName(agent.name)}
                </div>
            )}
        </div>
    );
};

const WhatsAppSettings: React.FC = () => {
    const [settings, setSettings] = useState<WhatsAppSettingsShape>(DEFAULT_WHATSAPP_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [modalAgent, setModalAgent] = useState<WhatsAppAgent | null>(null);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await adminFetch('/api/admin/settings/whatsapp');
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'success') {
                        setSettings(normalizeWhatsAppSettings(data.data));
                    }
                }
            } catch (error) {
                console.error('Error loading WhatsApp settings:', error);
                toast.error('No se pudo cargar la configuracion de WhatsApp.');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const activeAgents = useMemo(
        () => settings.agents.filter(agent => agent.isActive && sanitizeWhatsAppPhone(agent.phone)),
        [settings.agents]
    );

    const updateSettings = (nextSettings: Partial<WhatsAppSettingsShape>) => {
        setSettings(prev => ({ ...prev, ...nextSettings }));
        setIsDirty(true);
    };

    const updateAgentList = (agents: WhatsAppAgent[]) => {
        updateSettings({ agents });
    };

    const openNewAgentModal = () => {
        setEditingAgentId(null);
        setModalAgent(createWhatsAppAgent());
    };

    const openEditAgentModal = (agent: WhatsAppAgent) => {
        setEditingAgentId(agent.id);
        setModalAgent({ ...agent });
    };

    const closeModal = () => {
        setModalAgent(null);
        setEditingAgentId(null);
        setIsUploadingAvatar(false);
    };

    const saveAgent = () => {
        if (!modalAgent) return;

        const trimmedName = modalAgent.name.trim();
        const trimmedPhone = modalAgent.phone.trim();

        if (!trimmedName) {
            toast.error('El nombre del agente es obligatorio.');
            return;
        }

        if (!sanitizeWhatsAppPhone(trimmedPhone)) {
            toast.error('Debes ingresar un telefono con codigo de pais.');
            return;
        }

        const agentToSave: WhatsAppAgent = {
            ...modalAgent,
            name: trimmedName,
            phone: trimmedPhone,
            initials: (modalAgent.initials || getInitialsFromName(trimmedName)).slice(0, 3).toUpperCase(),
            welcomeMessage: modalAgent.welcomeMessage.trim() || 'Hola, necesito ayuda.',
        };

        if (editingAgentId) {
            updateAgentList(settings.agents.map(agent => agent.id === editingAgentId ? agentToSave : agent));
        } else {
            updateAgentList([...settings.agents, agentToSave]);
        }

        closeModal();
    };

    const deleteAgent = (agentId: string) => {
        updateAgentList(settings.agents.filter(agent => agent.id !== agentId));
    };

    const toggleAgent = (agentId: string, isActive: boolean) => {
        updateAgentList(settings.agents.map(agent => agent.id === agentId ? { ...agent, isActive } : agent));
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !modalAgent) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Solo puedes subir imagenes JPG, PNG o WEBP.');
            event.target.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen no puede superar 5MB.');
            event.target.value = '';
            return;
        }

        const token = localStorage.getItem('auth_token');
        if (!token) {
            toast.error('Sesion expirada. Inicia sesion nuevamente.');
            event.target.value = '';
            return;
        }

        setIsUploadingAvatar(true);

        try {
            const formData = new FormData();
            formData.append('cover', file);

            const response = await fetch('/api/services/upload-cover', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            const data = await response.json();

            if (response.ok && data.imageUrl) {
                setModalAgent(prev => prev ? { ...prev, avatarUrl: data.imageUrl } : prev);
                toast.success('Avatar subido correctamente.');
            } else {
                toast.error(data.message || 'No se pudo subir el avatar.');
            }
        } catch (error) {
            console.error('WhatsApp avatar upload error:', error);
            toast.error('Error de red al subir el avatar.');
        } finally {
            setIsUploadingAvatar(false);
            event.target.value = '';
        }
    };

    const handleSaveSettings = async () => {
        if (settings.enabled && activeAgents.length === 0) {
            toast.error('Activa al menos un agente con telefono antes de habilitar el modulo.');
            return;
        }

        setSaving(true);

        try {
            const response = await adminFetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group: 'whatsapp',
                    settings,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Error al guardar configuracion.');
            }

            setIsDirty(false);
            toast.success('Modulo de WhatsApp guardado.');
        } catch (error: any) {
            console.error('Error saving WhatsApp settings:', error);
            toast.error(error.message || 'No se pudo guardar WhatsApp.');
        } finally {
            setSaving(false);
        }
    };

    const openAgentTest = (agent: WhatsAppAgent) => {
        if (!sanitizeWhatsAppPhone(agent.phone)) {
            toast.error('Este agente no tiene telefono valido.');
            return;
        }
        window.open(buildWhatsAppUrl(agent), '_blank', 'noopener,noreferrer');
    };

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-gray-200 bg-white">
                <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 size={20} className="animate-spin text-brand-primary" />
                    <span className="text-sm font-medium">Cargando modulo de WhatsApp...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Gestion de WhatsApp</h1>
                    <p className="mt-1 text-gray-600">
                        Configura el boton publico, el mensaje de bienvenida y los agentes que recibiran conversaciones.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar cambios
                </button>
            </div>

            {isDirty && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                    <span>Tienes cambios sin guardar. El widget publico se actualizara despues de guardar.</span>
                </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Configuracion general</h2>
                            <p className="mt-1 text-sm text-gray-500">Define como aparece el acceso rapido en el sitio publico.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-600">{settings.enabled ? 'Activo' : 'Inactivo'}</span>
                            <ToggleSwitch enabled={settings.enabled} onChange={(enabled) => updateSettings({ enabled })} />
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Titulo de bienvenida</label>
                            <input
                                type="text"
                                value={settings.welcomeTitle}
                                onChange={(event) => updateSettings({ welcomeTitle: event.target.value })}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                placeholder="Hablemos por WhatsApp"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Texto del boton flotante</label>
                            <input
                                type="text"
                                value={settings.buttonText}
                                onChange={(event) => updateSettings({ buttonText: event.target.value })}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                placeholder="Necesitas ayuda?"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Texto pie del panel</label>
                            <input
                                type="text"
                                value={settings.footerText}
                                onChange={(event) => updateSettings({ footerText: event.target.value })}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                placeholder="El equipo suele responder en unos minutos."
                            />
                        </div>
                    </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Agentes ({settings.agents.length})</h2>
                            <p className="mt-1 text-sm text-gray-500">{activeAgents.length} disponible(s) para el widget publico.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openNewAgentModal}
                            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                        >
                            <Plus size={16} />
                            Nuevo
                        </button>
                    </div>

                    <div className="space-y-3">
                        {settings.agents.map(agent => (
                            <div key={agent.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 transition hover:border-brand-primary/40 hover:bg-gray-50">
                                <AgentAvatar agent={agent} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate font-semibold text-gray-900">{agent.name || 'Agente sin nombre'}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${agent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {agent.isActive ? 'Activo' : 'Pausado'}
                                        </span>
                                    </div>
                                    <p className="truncate text-sm text-gray-500">{agent.role || 'Sin cargo'} · {agent.phone || 'Sin telefono'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ToggleSwitch enabled={agent.isActive} onChange={(enabled) => toggleAgent(agent.id, enabled)} />
                                    <button
                                        type="button"
                                        onClick={() => openAgentTest(agent)}
                                        className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-brand-primary"
                                        title="Probar enlace"
                                    >
                                        <ExternalLink size={17} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditAgentModal(agent)}
                                        className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
                                        title="Editar agente"
                                    >
                                        <Edit2 size={17} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteAgent(agent.id)}
                                        className="rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                        title="Eliminar agente"
                                    >
                                        <Trash2 size={17} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {settings.agents.length === 0 && (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                                <UserRound size={28} className="mx-auto mb-2 text-gray-400" />
                                <p className="font-semibold text-gray-700">No hay agentes configurados.</p>
                                <p className="mt-1 text-sm text-gray-500">Crea un agente para activar conversaciones desde el sitio publico.</p>
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Vista previa</h2>
                        <p className="mt-1 text-sm text-gray-500">Aproximacion del panel que vera un visitante antes de abrir WhatsApp.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${settings.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {settings.enabled ? 'Visible si hay agentes activos' : 'Oculto'}
                    </span>
                </div>

                <div className="max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
                    <div className="bg-brand-primary px-5 py-4 text-white">
                        <p className="text-base font-bold">{settings.welcomeTitle}</p>
                        <p className="mt-1 text-xs text-white/80">{settings.buttonText}</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {(activeAgents.length > 0 ? activeAgents : settings.agents).slice(0, 3).map(agent => (
                            <div key={agent.id} className="flex items-center gap-3 px-5 py-4">
                                <AgentAvatar agent={agent} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-bold text-gray-900">{agent.name || 'Agente sin nombre'}</p>
                                    <p className="truncate text-xs text-gray-500">{agent.role || 'WhatsApp'}</p>
                                </div>
                                <MessageCircle size={19} className="text-[#25D366]" />
                            </div>
                        ))}
                    </div>
                    <div className="bg-gray-50 px-5 py-3 text-xs text-gray-500">{settings.footerText}</div>
                </div>
            </section>

            {modalAgent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{editingAgentId ? 'Editar agente' : 'Nuevo agente'}</h3>
                                <p className="mt-1 text-sm text-gray-500">Cada agente puede tener telefono, avatar y mensaje propio.</p>
                            </div>
                            <button type="button" onClick={closeModal} className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">Nombre</label>
                                <input
                                    type="text"
                                    value={modalAgent.name}
                                    onChange={(event) => {
                                        const name = event.target.value;
                                        setModalAgent(prev => prev ? { ...prev, name, initials: prev.initials || getInitialsFromName(name) } : prev);
                                    }}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                    placeholder="Ej: Antonia Merino"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">Iniciales</label>
                                <input
                                    type="text"
                                    value={modalAgent.initials}
                                    onChange={(event) => setModalAgent(prev => prev ? { ...prev, initials: event.target.value.toUpperCase().slice(0, 3) } : prev)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                    placeholder="AM"
                                />
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">Rol / cargo</label>
                                <input
                                    type="text"
                                    value={modalAgent.role}
                                    onChange={(event) => setModalAgent(prev => prev ? { ...prev, role: event.target.value } : prev)}
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                    placeholder="Ej: Soporte tecnico"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold text-gray-700">Telefono con codigo pais</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={modalAgent.phone}
                                        onChange={(event) => setModalAgent(prev => prev ? { ...prev, phone: event.target.value } : prev)}
                                        className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                        placeholder="Ej: 56991450091"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Mensaje de bienvenida</label>
                            <textarea
                                value={modalAgent.welcomeMessage}
                                onChange={(event) => setModalAgent(prev => prev ? { ...prev, welcomeMessage: event.target.value } : prev)}
                                rows={4}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                placeholder="Hola, en que te ayudo?"
                            />
                        </div>

                        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                            <label className="mb-3 block text-sm font-semibold text-gray-700">Avatar</label>
                            <div className="flex flex-wrap items-center gap-4">
                                <AgentAvatar agent={modalAgent} size="lg" />
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                        className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                    >
                                        {isUploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                        Examinar
                                    </button>
                                    {modalAgent.avatarUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setModalAgent(prev => prev ? { ...prev, avatarUrl: '' } : prev)}
                                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100"
                                        >
                                            Quitar imagen
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleAvatarUpload}
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-800">Agente activo</p>
                                <p className="text-xs text-gray-500">Si esta pausado, no aparecera en el widget publico.</p>
                            </div>
                            <ToggleSwitch
                                enabled={modalAgent.isActive}
                                onChange={(enabled) => setModalAgent(prev => prev ? { ...prev, isActive: enabled } : prev)}
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={closeModal}
                                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={saveAgent}
                                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                            >
                                Guardar agente
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WhatsAppSettings;
