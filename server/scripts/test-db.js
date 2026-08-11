// Standalone script to verify DB connection
// Run with: node server/scripts/test-db.js

const { pool } = require('../config/db');
const logger = require('../config/logger');

async function testConnection() {
    console.log('--- Starting Database Handshake ---');
    console.log(`Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT} as ${process.env.DB_USER}`);

    try {
        const start = Date.now();
        const res = await pool.query('SELECT NOW() as current_time, version()');
        const duration = Date.now() - start;

        console.log('✅ Connection Successful!');
        console.log(`⏱️ Latency: ${duration}ms`);
        console.log(`📅 Server Time: ${res.rows[0].current_time}`);
        console.log(`ℹ️ Version: ${res.rows[0].version}`);

        // Success log
        logger.info('Database handshake verification successful', {
            latency: duration,
            version: res.rows[0].version
        });

    } catch (err) {
        console.error('❌ Connection Failed!');
        console.error('Error details:', err.message);

        if (err.code === '28P01') {
            console.error('💡 Hint: Check your username or password in .env');
        } else if (err.code === '3D000') {
            console.error(`💡 Hint: The database "${process.env.DB_DATABASE}" does not exist. Check the name in cPanel.`);
        } else if (err.code === 'ECONNREFUSED') {
            console.error('💡 Hint: Is the database server running? Check Host/Port.');
        }

        process.exit(1);
    } finally {
        // Close the pool to allow the script to exit cleanly
        await pool.end();
        console.log('--- Handshake Completed ---');
    }
}

testConnection();
