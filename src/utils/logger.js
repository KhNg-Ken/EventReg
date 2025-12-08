const inProduction = import.meta.env.VITE_PROJECT_PROD;

export const createLogger = (namespace) => ({
    log: (...args) => {
        if (!inProduction) {
            console.log(`[${namespace}]`, ...args);
        }
    },

    warn: (...args) => {
        if (!inProduction) {
            console.warn(`[${namespace}]`, ...args);
        }
    },

    error: (...args) => {
        if (!inProduction) {
            console.error(`[${namespace}]`, ...args);
        }
    },
    debug: (...args) => {
        if (!inProduction) {
            console.debug(`[${namespace}]`, ...args);
        }
    },
});
