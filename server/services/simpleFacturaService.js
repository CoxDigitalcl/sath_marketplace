import axios from 'axios';
import logger from '../config/logger.js';

class SimpleFacturaService {
    constructor() {
        this.baseUrl = 'https://api.simplefactura.cl';

        // --- Token Cache Strategy ---
        this.tokenCache = null;
        this.REFRESH_MARGIN_MS = 10 * 60 * 1000;
    }

    /**
     * Get a valid Bearer Token, using cache if available
     */
    async getAccessToken(credentials, forceRefresh = false) {
        if (!forceRefresh && this.tokenCache) {
            const now = Date.now();
            if (this.tokenCache.expiresAt - now > this.REFRESH_MARGIN_MS) {
                return this.tokenCache.token;
            }
        }
        return this.fetchNewToken(credentials);
    }

    /**
     * INTERNAL: Fetch new token
     */
    async fetchNewToken({ username, password }) {
        try {
            // Mask username in logs for security
            const maskedUser = username ? username.replace(/(.{2}).*@/, '$1***@') : 'unknown';
            logger.info(`[SimpleFactura] Fetching new token for: ${maskedUser}`);

            const payload = { email: username, password };

            const response = await axios.post(`${this.baseUrl}/token`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            if (response.status === 200 && response.data) {
                // Support both camelCase and snake_case
                const { accessToken, access_token, expiresAt, expires_at } = response.data;
                const token = accessToken || access_token;
                const expiration = expiresAt || expires_at;

                if (!token) {
                    const keysReceived = Object.keys(response.data).join(', ');
                    logger.error(`[SimpleFactura] Auth Success (200) but no token. keys: ${keysReceived}`);
                    throw new Error(`No access_token received. Server returned: ${keysReceived}`);
                }

                let expiresAtMs = Date.now() + (23 * 60 * 60 * 1000);
                if (expiration) {
                    const parsed = Date.parse(expiration);
                    if (!isNaN(parsed)) expiresAtMs = parsed;
                }

                this.tokenCache = { token, expiresAt: expiresAtMs };
                return token;
            }
            throw new Error(`Unexpected status ${response.status}`);

        } catch (error) {
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[SimpleFactura] Token Fetch Error: ${msg}`);
            throw new Error(`Auth Failed: ${msg}`, { cause: error });
        }
    }

    /**
     * Generate Boleta (Type 39) or Factura (Type 33) for the platform fee charged to the final client.
     * The provider service amount must not be included here.
     */
    async generatePlatformFeeBoleta(config, booking) {
        const client = booking.client || {};
        // If client has RUT & Activity -> Factura (33), else Boleta (39)
        const isFactura = client.rut && client.rut.length > 8 && client.giro;
        const typeCode = isFactura ? 33 : 39;

        return this._generateDTE(config, {
            typeCode,
            receiver: client,
            amount: booking.amount,
            items: booking.items || [{ name: 'Tarifa de servicio plataforma', price: booking.amount }],
            bookingId: booking.id,
            reason: 'Platform Fee'
        });
    }

    /**
     * Backward-compatible alias. Prefer generatePlatformFeeBoleta.
     */
    async generateBoleta(config, booking) {
        return this.generatePlatformFeeBoleta(config, booking);
    }

    /**
     * Generate Liquidacion Factura (Type 43) for a provider monthly settlement.
     * This is a manual/admin controlled document summarizing platform-mediated operations.
     */
    async generateProviderMonthlySettlement(config, settlement) {
        const provider = settlement.provider || {};

        if (!provider.rut) {
            throw new Error('Provider needs a valid RUT for Liquidacion Factura');
        }

        const periodLabel = `${settlement.periodStart} a ${settlement.periodEnd}`;
        const grossAmount = Math.round(Number(settlement.grossAmount) || 0);
        const platformFee = Math.round(Number(settlement.platformFee) || 0);
        const payoutAmount = Math.round(Number(settlement.providerPayout) || 0);

        return this._generateDTE(config, {
            typeCode: 43, // Liquidacion Factura
            receiver: {
                rut: provider.rut,
                name: provider.full_name || provider.store_name,
                email: provider.email, // Provider's email
                address: provider.address || 'Domicilio Proveedor',
                city: provider.city || 'Ciudad'
            },
            amount: grossAmount,
            items: [{
                name: `Liquidacion mensual operaciones ${periodLabel} | operaciones: ${settlement.bookingsCount} | comision plataforma: ${platformFee} | abono proveedor: ${payoutAmount}`,
                price: grossAmount
            }],
            bookingId: settlement.id,
            reason: 'Provider Monthly Settlement'
        });
    }

    /**
     * Backward-compatible alias for older callers.
     */
    async generateLiquidacion(config, booking) {
        return this.generateProviderMonthlySettlement(config, {
            id: booking.id,
            provider: booking.provider,
            grossAmount: booking.grossAmount || booking.amount || booking.payoutAmount,
            platformFee: booking.platformFee || 0,
            providerPayout: booking.payoutAmount,
            bookingsCount: booking.bookingsCount || 1,
            periodStart: booking.periodStart || 'periodo',
            periodEnd: booking.periodEnd || 'periodo'
        });
    }

    /**
     * Core DTE Generation Logic
     */
    async _generateDTE(config, data) {
        const { username, password, rutEmisor, environment } = config;
        const { typeCode, receiver, amount, items, bookingId, reason } = data;

        try {
            const token = await this.getAccessToken({ username, password });

            // Get today's date in YYYY-MM-DD format for FchEmis
            const today = new Date();
            const fchEmis = today.toISOString().split('T')[0]; // YYYY-MM-DD

            // Construct Payload
            const payload = {
                "Credenciales": {
                    "RutEmisor": rutEmisor || "99.999.999-9", // Fallback for dev
                    "NombreSucursal": "Casa Matriz"
                },
                "DTE": {
                    "Encabezado": {
                        "IdDoc": {
                            "TipoDTE": typeCode,
                            "Folio": 0, // Auto-assigned
                            "FchEmis": fchEmis, // REQUIRED: Emission date
                            "FmaPago": 1, // 1 = Contado (Cash), 2 = Crédito
                            "MntBruto": 1 // 1 = Amounts include IVA (required for Boletas)
                        },
                        "Emisor": {
                            "RUTEmisor": rutEmisor || "99.999.999-9"
                        },
                        "Receptor": {
                            "RUTRecep": (!receiver.rut || receiver.rut === 'Sin RUT') ? "66.666.666-6" : receiver.rut,
                            "RznSocRecep": receiver.name || "Usuario Genérico",
                            "GiroRecep": receiver.giro || "Particular",
                            "DirRecep": receiver.address || "Sin Dirección",
                            "CmnaRecep": receiver.city || "Santiago",
                            "CorreoRecep": receiver.email
                        },
                        "Totales": {
                            "MntTotal": Math.round(amount)
                        }
                    },
                    "Detalle": items.map((item, idx) => ({
                        "NroLinDet": idx + 1,
                        "NmbItem": item.name,
                        "QtyItem": 1,
                        "PrcItem": Math.round(item.price),
                        "MontoItem": Math.round(item.price)
                    }))
                }
            };

            // SECURITY: Mask PII before logging
            const safeLog = this._maskPayload(payload);
            logger.info(`[SimpleFactura] Generating DTE (${reason}) for Booking ${bookingId}.`);
            logger.debug(`[SimpleFactura] Payload: ${JSON.stringify(safeLog)}`);

            // --- REAL API CALL (LIVE/SANDBOX) ---
            // Endpoint: POST https://api.simplefactura.cl/invoiceV2/{Sucursal}
            const sucursal = "Casa Matriz"; // Default branch name
            const url = `${this.baseUrl}/invoiceV2/${encodeURIComponent(sucursal)}`;

            const response = await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 200 || response.status === 201) {
                const result = response.data;
                // Check response structure for URL and Folio
                // Usually returns: { status: 200, mensaje: '...', folio: 123, url: '...' }

                logger.info(`[SimpleFactura] Success! Folio: ${result.folio}`);
                return {
                    status: 'success',
                    data: {
                        folio: result.folio,
                        url: result.url || result.link, // Check docs/response field
                        raw: result
                    }
                };
            }

            throw new Error(`Unexpected Status: ${response.status}`);

        } catch (error) {
            const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[SimpleFactura] DTE Generation Error: ${msg}`);
            throw new Error(`DTE Failed: ${msg}`, { cause: error });
        }
    }

    /**
     * Helper: Mask sensitive data for logs
     */
    _maskPayload(payload) {
        try {
            const safe = JSON.parse(JSON.stringify(payload));
            if (safe.DTE?.Encabezado?.Receptor) {
                const r = safe.DTE.Encabezado.Receptor;
                if (r.RUTRecep) r.RUTRecep = r.RUTRecep.replace(/^(\d+).*?([\dkK])$/, '$1.***-$2');
                if (r.CorreoRecep) r.CorreoRecep = '***@***.com';
                if (r.DirRecep) r.DirRecep = '*** HIDDEN ***';
                if (r.RznSocRecep) r.RznSocRecep = '*** HIDDEN ***';
            }
            return safe;
        } catch (e) {
            return { error: 'Failed to mask payload' };
        }
    }

    /**
     * Test connection
     */
    async testConnection(config) {
        const { username, password } = config;
        if (!username || !password) return { success: false, message: 'Faltan credenciales' };
        try {
            await this.getAccessToken({ username, password }, true);
            return { success: true, message: '✅ Conexión exitosa con SimpleFactura' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    clearCache() {
        this.tokenCache = null;
    }
}

export default new SimpleFacturaService();
