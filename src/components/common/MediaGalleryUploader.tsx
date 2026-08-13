import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Play, ImageIcon, Film, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface GalleryItem {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
}

interface MediaGalleryUploaderProps {
    items: GalleryItem[];
    onChange: (items: GalleryItem[]) => void;
    maxItems?: number;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
const ALL_ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',');

const MediaGalleryUploader: React.FC<MediaGalleryUploaderProps> = ({ items, onChange, maxItems = 10 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadingCount, setUploadingCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getToken = () => sessionStorage.getItem('auth_token');

    const uploadFile = useCallback(async (file: File): Promise<GalleryItem | null> => {
        const isImage = IMAGE_TYPES.includes(file.type);
        const isVideo = VIDEO_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
            toast.error(`Formato no soportado: ${file.name}`);
            return null;
        }

        // Size limits
        const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
            toast.error(`${file.name} es demasiado grande. Máximo ${isVideo ? '50MB' : '5MB'}.`);
            return null;
        }

        const token = getToken();
        if (!token) {
            toast.error('Sesión expirada. Inicia sesión nuevamente.');
            return null;
        }

        const formData = new FormData();
        const endpoint = isImage ? '/api/services/upload-cover' : '/api/services/upload-video';
        formData.append(isImage ? 'cover' : 'video', file);

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();

            if (res.ok) {
                const url = data.imageUrl || data.videoUrl;
                return {
                    type: isImage ? 'image' : 'video',
                    url,
                    thumbnail: isImage ? url : undefined
                };
            } else {
                toast.error(`Error subiendo ${file.name}: ${data.message || 'Error'}`);
                return null;
            }
        } catch {
            toast.error(`Error de red al subir ${file.name}`);
            return null;
        }
    }, []);

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const remaining = maxItems - items.length;

        if (remaining <= 0) {
            toast.error(`Has alcanzado el máximo de ${maxItems} archivos.`);
            return;
        }

        const toUpload = fileArray.slice(0, remaining);
        if (toUpload.length < fileArray.length) {
            toast(`Solo se subirán ${toUpload.length} de ${fileArray.length} archivos (máximo ${maxItems}).`, { icon: '⚠️' });
        }

        setUploadingCount(prev => prev + toUpload.length);

        const results = await Promise.all(toUpload.map(f => uploadFile(f)));
        const successful = results.filter(Boolean) as GalleryItem[];

        if (successful.length > 0) {
            onChange([...items, ...successful]);
            toast.success(`${successful.length} archivo${successful.length > 1 ? 's' : ''} subido${successful.length > 1 ? 's' : ''}.`);
        }

        setUploadingCount(prev => prev - toUpload.length);
    }, [items, maxItems, onChange, uploadFile]);

    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    // Drag & Drop handlers
    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    };

    const isAtMax = items.length >= maxItems;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Film size={18} className="text-brand-secondary" />
                    Galería Multimedia
                </label>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    isAtMax ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                    {items.length} / {maxItems}
                </span>
            </div>

            <p className="text-sm text-gray-500">
                Agrega fotos y videos adicionales para mostrar más detalles de tu servicio.
            </p>

            {/* Upload zone */}
            {!isAtMax && (
                <div
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
                        isDragging
                            ? 'border-brand-primary bg-brand-primary/5 scale-[1.01]'
                            : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {uploadingCount > 0 ? (
                        <div className="flex flex-col items-center py-2">
                            <Loader2 size={32} className="text-brand-primary animate-spin mb-2" />
                            <p className="text-sm text-brand-primary font-medium">Subiendo {uploadingCount} archivo{uploadingCount > 1 ? 's' : ''}...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-2">
                            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                                <Upload size={22} className="text-gray-500" />
                            </div>
                            <p className="text-sm text-gray-700 font-medium">
                                {isDragging ? '¡Suelta los archivos aquí!' : 'Arrastra archivos o haz clic para seleccionar'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1.5">
                                Imágenes (JPG, PNG, WEBP — 5MB) • Videos (MP4, WebM, MOV — 50MB)
                            </p>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ALL_ACCEPT}
                        multiple
                        onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                        className="hidden"
                    />
                </div>
            )}

            {/* Thumbnail grid */}
            {items.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {items.map((item, index) => (
                        <div
                            key={`${item.url}-${index}`}
                            className="relative group aspect-square rounded-xl overflow-hidden border-2 border-gray-200 hover:border-brand-primary/50 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                            {item.type === 'image' ? (
                                <img
                                    src={item.url}
                                    alt={`Galería ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                                    <Play size={24} className="text-white/80 mb-1" fill="rgba(255,255,255,0.6)" />
                                    <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Video</span>
                                </div>
                            )}

                            {/* Type badge */}
                            <div className="absolute bottom-1.5 left-1.5 z-10">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                                    item.type === 'image'
                                        ? 'bg-blue-500/80 text-white'
                                        : 'bg-purple-500/80 text-white'
                                }`}>
                                    {item.type === 'image' ? <ImageIcon size={10} /> : <Play size={10} fill="white" />}
                                    {item.type === 'image' ? 'IMG' : 'VID'}
                                </span>
                            </div>

                            {/* Delete button */}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                                className="absolute top-1.5 right-1.5 z-10 p-1 rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 shadow-md"
                            >
                                <X size={14} />
                            </button>

                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {items.length === 0 && !uploadingCount && (
                <div className="text-center py-4 text-sm text-gray-400 italic">
                    No has agregado archivos a la galería aún.
                </div>
            )}
        </div>
    );
};

export default MediaGalleryUploader;
