import 'dotenv/config';
import { pool } from '../config/db.js';

async function inspectData() {
    try {
        console.log("Searching for 'Emergency Plumbing' service...");
        const serviceRes = await pool.query("SELECT * FROM services WHERE title ILIKE '%Emergency Plumbing%'");

        if (serviceRes.rows.length === 0) {
            console.log("Service not found.");
            return;
        }

        const service = serviceRes.rows[0];
        console.log("Service found:", service);

        console.log(`Checking Provider ID: ${service.provider_id}`);
        const providerRes = await pool.query("SELECT * FROM provider_profiles WHERE user_id = $1", [service.provider_id]);

        if (providerRes.rows.length === 0) {
            console.log("Provider PROFILE does NOT exist for this service!");
        } else {
            console.log("Provider Profile FOUND:", providerRes.rows[0]);
        }

        const userRes = await pool.query("SELECT * FROM users WHERE id = $1", [service.provider_id]);
        console.log("User entry:", userRes.rows[0]);

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

inspectData();
