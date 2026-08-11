import { pool } from '../config/db.js';

const run = async () => {
    try {
        console.log("1. Finding a provider with services...");
        const providerRes = await pool.query("SELECT DISTINCT provider_id FROM services LIMIT 1");

        if (providerRes.rows.length === 0) {
            console.log("No services found in DB at all.");
            process.exit(0);
        }

        const userId = providerRes.rows[0].provider_id;
        console.log(`Found Provider ID: ${userId}`);

        console.log("2. Running getMyServices Query logic...");
        const query = `
            SELECT s.*, p.full_name as provider_name 
            FROM services s 
            LEFT JOIN provider_profiles p ON s.provider_id = p.user_id 
            WHERE s.provider_id = $1
            ORDER BY s.created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        console.log(`Query returned ${result.rows.length} rows.`);
        console.log("First row raw:", result.rows[0]);

        console.log("3. Testing Map Logic...");
        const services = result.rows.map(row => {
            try {
                return {
                    ...row,
                    id: String(row.id),
                    name: row.title,
                    price_clp: row.price,
                    iva_clp: Math.round(row.price * 0.19),
                    status: row.is_active ? 'active' : 'paused',
                    videoUrl: row.video_url,
                    categories: [{
                        categoryId: row.category,
                        subcategory: row.subcategory || row.category
                    }],
                    availability_type: 'agenda',
                    requires_kyc: false,
                    type: 'online'
                };
            } catch (mapErr) {
                console.error("Error mapping row:", row, mapErr);
                throw mapErr;
            }
        });

        console.log("Mapping successful!");
        console.log("Mapped Service 0:", services[0]);

    } catch (err) {
        console.error("CRASH DETECTED:");
        console.error(err);
    } finally {
        pool.end();
    }
};

run();
