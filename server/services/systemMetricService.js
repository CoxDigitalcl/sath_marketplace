// In-Memory Metric Store (Transient)
const latencyHistory = []; // Last 100 requests
const errorHistory = [];   // Last 5 critical errors
const MAX_LATENCY_HISTORY = 100;
const MAX_ERROR_HISTORY = 5;

export const recordLatency = (durationMs) => {
    latencyHistory.push(durationMs);
    if (latencyHistory.length > MAX_LATENCY_HISTORY) {
        latencyHistory.shift(); // Remove oldest
    }
};

export const recordError = (error, req) => {
    const errorEntry = {
        timestamp: new Date(),
        message: error.message,
        path: req?.originalUrl || 'unknown',
        method: req?.method || 'UNKNOWN',
        stack: error.stack ? error.stack.split('\n')[0] : '' // Just first line
    };

    errorHistory.unshift(errorEntry); // Add to top
    if (errorHistory.length > MAX_ERROR_HISTORY) {
        errorHistory.pop(); // Remove oldest
    }
};

export const getStats = () => {
    // Calculate Average Latency
    const total = latencyHistory.reduce((acc, curr) => acc + curr, 0);
    const avg = latencyHistory.length > 0 ? (total / latencyHistory.length).toFixed(2) : 0;

    return {
        uptime: process.uptime(),
        avgLatency: parseFloat(avg),
        totalRequestsMonitored: latencyHistory.length, // approximation of recent activity
        recentErrors: errorHistory,
        memoryUsage: process.memoryUsage().rss / 1024 / 1024 // MB
    };
};

export default {
    recordLatency,
    recordError,
    getStats
};
