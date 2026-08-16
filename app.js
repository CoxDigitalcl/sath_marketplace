import app, { startApplicationObservability } from './server/index.js';
import logger from './server/config/logger.js';

// cPanel Entry Point
// This file acts as the "Startup File" in the root directory.
// It imports the Express app from the server folder and starts the listener.

const PORT = process.env.PORT || 3001;

startApplicationObservability();
app.listen(PORT, () => {
    logger.info('Server started via cPanel entry point.', {
        event: 'server_started',
        port: Number(PORT),
    });
});
