const INTERNAL_SERVICE_FIELDS = new Set([
    'commission_percentage',
    'commission_type',
    'fixed_commission',
    'payment_status',
    'promotion_start_date',
    'target_keywords',
    'rut',
    'email',
    'bank_data',
    'kyc_documents',
    'payouts_enabled'
]);

export const toPublicServiceDto = (row = {}) => Object.fromEntries(
    Object.entries(row).filter(([key]) => !INTERNAL_SERVICE_FIELDS.has(key))
);

export const getPublicProviderName = (profile = {}) => {
    const candidates = [profile.store_name, profile.full_name];
    const name = candidates.find(value => typeof value === 'string' && value.trim());
    return name ? name.trim() : 'Proveedor';
};
