const enabled = import.meta.env.PROJECT_LOGGER_ENABLED === 'true';

export const createLogger = (namespace) => ({
    log: (...args) => {
        if (enabled) {
            console.log(`[${namespace}]`, ...args);
        }
    },

    warn: (...args) => {
        if (enabled) {
            console.warn(`[${namespace}]`, ...args);
        }
    },

    error: (...args) => {
        if (enabled) {
            console.error(`[${namespace}]`, ...args);
        }
    },
    debug: (...args) => {
        if (enabled) {
            console.debug(`[${namespace}]`, ...args);
        }
    },
});