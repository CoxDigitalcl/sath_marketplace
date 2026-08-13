const PUBLIC_SERVICE_FIELDS = new Set([
    'id',
    'provider_id',
    'title',
    'name',
    'description',
    'category',
    'price',
    'price_clp',
    'duration_minutes',
    'type',
    'availability_type',
    'calendar_config',
    'features',
    'image_urls',
    'imageUrls',
    'categories_json',
    'categories',
    'is_staff_pick',
    'cover_image_url',
    'coverImageUrl',
    'video_url',
    'videoUrl',
    'gallery_media',
    'galleryMedia',
    'pricing_type',
    'freight_base_price',
    'freight_price_per_km',
    'freight_max_distance_km',
    'provider_name',
    'provider_image',
    'location',
    'coverage_region_code',
    'coverage_region_name',
    'coverage_communes',
    'coverage_area',
    'is_active',
    'status',
    'isSponsored',
    'avg_rating',
    'review_count',
    'sales_count',
    'rating',
    'created_at'
]);

export const toPublicServiceDto = (row = {}) => Object.fromEntries(
    Object.entries(row).filter(([key]) => PUBLIC_SERVICE_FIELDS.has(key))
);

export const getPublicProviderName = (profile = {}) => {
    const candidates = [profile.store_name, profile.full_name];
    const name = candidates.find(value => typeof value === 'string' && value.trim());
    return name ? name.trim() : 'Proveedor';
};
