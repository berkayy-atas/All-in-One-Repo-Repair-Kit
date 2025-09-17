"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
class BaseService {
    logger;
    initialized = false;
    constructor(logger) {
        this.logger = logger;
    }
    async initialize() {
        if (this.initialized) {
            return;
        }
        await this.onInitialize();
        this.initialized = true;
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error(`${this.constructor.name} must be initialized before use`);
        }
    }
    handleError(error, context) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const fullMessage = `${context}: ${errorMessage}`;
        this.logger.error(fullMessage, error instanceof Error ? error : new Error(errorMessage));
        throw new Error(fullMessage);
    }
    async safeExecute(operation, context, fallback) {
        try {
            return await operation();
        }
        catch (error) {
            if (fallback !== undefined) {
                this.logger.warn(`${context} failed, using fallback: ${String(error)}`);
                return fallback;
            }
            this.handleError(error, context);
        }
    }
}
exports.BaseService = BaseService;
//# sourceMappingURL=base-service.js.map