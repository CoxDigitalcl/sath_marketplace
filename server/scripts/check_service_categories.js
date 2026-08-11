
import { pool } from '../config/db.js';

const checkServices = async () => {
    try {
        console.log("Connecting to DB...");
        const res = await pool.query(`
            SELECT id, title, categories_json 
            FROM services 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        console.log("Found services:", res.rows.length);
        res.rows.forEach(s => {
            console.log(`Service ID: ${s.id}`);
            console.log(`Title: ${s.title}`);
            console.log(`Categories JSON (Raw):`, s.categories_json);
            console.log(`Type of Categories JSON:`, typeof s.categories_json);
            console.log('-------------------');
        });

    } catch (err) {
        console.error("Error:", err);
    } finally {
        pool.end();
    }
};

checkServices();
