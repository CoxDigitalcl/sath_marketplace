import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink, AlertTriangle, Info, ShieldCheck, Image, MessageCircle, ShoppingBag } from 'lucide-react';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';

interface Notification {
    id: string;
    title: string;
    message: string;
    type: string; // 'info' | 'success' | 'warning' | 'error' | 'moderation' | 'kyc' | 'booking' | 'support'
    link: string | null;
    is_read: boolean;
    created_at: string;
}

const POLLING_INTERVAL = 30_000; // 30 seconds

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    info:       { icon: Info,           color: 'text-blue-500',   bg: 'bg-blue-50' },
    success:    { icon: ShieldCheck,    color: 'text-green-500',  bg: 'bg-green-50' },
    warning:    { icon: AlertTriangle,  color: 'text-yellow-500', bg: 'bg-yellow-50' },
    error:      { icon: AlertTriangle,  color: 'text-red-500',    bg: 'bg-red-50' },
    moderation: { icon: Image,          color: 'text-purple-500', bg: 'bg-purple-50' },
    kyc:        { icon: ShieldCheck,    color: 'text-indigo-500', bg: 'bg-indigo-50' },
    booking:    { icon: ShoppingBag,    color: 'text-emerald-500',bg: 'bg-emerald-50' },
    support:    { icon: MessageCircle,  color: 'text-sky-500',    bg: 'bg-sky-50' },
};

const timeAgo = (dateStr: string): string => {
    const now = new Date();
    const then = new Date(dateStr);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `hace ${diffDays}d`;
    return then.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
};

const NotificationDropdown: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Fetch full notifications
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications');
            if (res.data.status === 'success') {
                setNotifications(res.data.notifications || []);
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch {
            // Silently fail — notifications are non-critical
        } finally {
            setLoading(false);
        }
    }, []);

    // Lightweight poll: only fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        try {
            const res = await api.get('/notifications/unread-count');
            if (res.data.status === 'success') {
                setUnreadCount(res.data.unreadCount || 0);
            }
        } catch {
            // Silently fail
        }
    }, []);

    // Initial fetch + polling
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, POLLING_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // When dropdown opens, fetch full list
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = async (id: string) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { /* silent */ }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch { /* silent */ }
    };

    const handleClickNotification = (notif: Notification) => {
        if (!notif.is_read) handleMarkAsRead(notif.id);
        if (notif.link) {
            setIsOpen(false);
            // Handle internal links like /admin?view=moderation
            if (notif.link.startsWith('/')) {
                navigate(notif.link);
            } else {
                window.open(notif.link, '_blank');
            }
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative text-gray-500 hover:text-gray-800 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                aria-label="Notificaciones"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-red-500 rounded-full px-1 shadow-sm animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white rounded-xl shadow-2xl border border-gray-200 z-[60] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <Bell size={16} className="text-brand-primary" />
                            Notificaciones
                            {unreadCount > 0 && (
                                <span className="text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5">
                                    {unreadCount}
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs text-brand-secondary hover:text-gray-900 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                    title="Marcar todas como leídas"
                                >
                                    <CheckCheck size={14} />
                                    Leer todo
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="overflow-y-auto flex-1">
                        {loading && notifications.length === 0 ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <Bell size={36} className="mb-3 opacity-40" />
                                <p className="text-sm font-medium">Sin notificaciones</p>
                                <p className="text-xs mt-1">Cuando algo requiera tu atención,<br />aparecerá aquí.</p>
                            </div>
                        ) : (
                            notifications.map((notif) => {
                                const cfg = typeConfig[notif.type] || typeConfig.info;
                                const Icon = cfg.icon;
                                return (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleClickNotification(notif)}
                                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-all duration-150 group
                                            ${notif.is_read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50/70'}
                                        `}
                                    >
                                        {/* Icon */}
                                        <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                                            <Icon size={16} className={cfg.color} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm leading-tight ${notif.is_read ? 'font-normal text-gray-700' : 'font-semibold text-gray-900'}`}>
                                                    {notif.title}
                                                </p>
                                                {!notif.is_read && (
                                                    <span className="flex-shrink-0 w-2 h-2 mt-1.5 bg-blue-500 rounded-full" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {timeAgo(notif.created_at)}
                                                </span>
                                                {notif.link && (
                                                    <span className="text-[10px] text-brand-secondary font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                                        Ver <ExternalLink size={9} />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Mark as read button */}
                                        {!notif.is_read && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif.id); }}
                                                className="flex-shrink-0 mt-1 p-1 rounded hover:bg-white text-gray-300 hover:text-green-500 transition-colors opacity-0 group-hover:opacity-100"
                                                title="Marcar como leída"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
