import app from './server/index.js';

// cPanel Entry Point
// This file acts as the "Startup File" in the root directory.
// It imports the Express app from the server folder and starts the listener.

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server started via app.js on port ${PORT}`);
});
