"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const base_service_1 = require("../base/base-service");
class ValidationService extends base_service_1.BaseService {
    constructor(logger) {
        super(logger);
    }
    async onInitialize() {
    }
    validatePassword(password) {
        this.ensureInitialized();
        if (!password) {
            throw new Error('Encryption password is required');
        }
        if (password.length < 8) {
            throw new Error(`Encryption password must be at least 8 characters (got ${password.length})`);
        }
        const allowedPattern = /^[a-zA-Z0-9!@#$%^&*(),.?":{}|<>]*$/;
        if (!allowedPattern.test(password)) {
            throw new Error('Encryption password can only contain alphanumeric characters and the following special characters: !@#$%^&*(),.?":{}|<>. ' +
                'Emojis, unicode characters, and other symbols are not allowed.');
        }
        const hasUppercase = /[A-Z]/.test(password);
        const hasLowercase = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        if (!hasUppercase) {
            throw new Error('Encryption password must contain at least one uppercase letter');
        }
        if (!hasLowercase) {
            throw new Error('Encryption password must contain at least one lowercase letter');
        }
        if (!hasDigit) {
            throw new Error('Encryption password must contain at least one digit');
        }
        if (!hasSpecialChar) {
            throw new Error('Encryption password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
        }
    }
    validateActionType(action) {
        this.ensureInitialized();
        if (!action) {
            throw new Error('Action type is required');
        }
        if (action !== 'backup' && action !== 'restore') {
            throw new Error("Invalid action type. Must be 'backup' or 'restore'");
        }
    }
    validateOtpMethod(method) {
        this.ensureInitialized();
        if (!method) {
            throw new Error('OTP delivery method is required');
        }
        if (method !== 'MAIL' && method !== 'AUTHENTICATOR') {
            throw new Error("Invalid otp_delivery_method. Must be 'MAIL' or 'AUTHENTICATOR'");
        }
    }
    validateRestoreInputs(fileVersionId, suspendActions) {
        this.ensureInitialized();
        if (!fileVersionId) {
            throw new Error("Input 'file_version_id' is required when action is 'restore'");
        }
        if (suspendActions === undefined) {
            throw new Error("Input 'suspend_actions' is required when action is 'restore'");
        }
        if (typeof suspendActions !== 'boolean') {
            throw new Error("Invalid suspend_actions. Must be 'true' or 'false'");
        }
    }
}
exports.ValidationService = ValidationService;
//# sourceMappingURL=validation.service.js.map