"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const base_service_1 = require("../base/base-service");
class ConfigService extends base_service_1.BaseService {
    config = null;
    validationService;
    constructor(logger, validationService) {
        super(logger);
        this.validationService = validationService;
    }
    async onInitialize() {
        await this.validationService.initialize();
        this.config = this.buildConfig();
    }
    async validateInputs(inputs) {
        this.ensureInitialized();
        this.validationService.validatePassword(inputs.icredible_encryption_password);
        this.validationService.validateActionType(inputs.action);
        this.validationService.validateOtpMethod(inputs.otp_delivery_method);
        if (inputs.action === 'restore') {
            this.validationService.validateRestoreInputs(inputs.file_version_id, inputs.suspend_actions);
        }
    }
    getConfig() {
        this.ensureInitialized();
        if (!this.config) {
            throw new Error('Configuration not properly initialized');
        }
        return this.config;
    }
    getApiConfig() {
        return this.getConfig().api;
    }
    getCryptoConfig() {
        return this.getConfig().crypto;
    }
    getEnpointConfig() {
        return this.getConfig().endpoint;
    }
    getFileConfig() {
        return this.getConfig().files;
    }
    buildConfig() {
        const inputs = this.getInputsFromEnvironment();
        return {
            inputs,
            api: {
                baseUrl: 'https://dev.api.file-security.icredible.com',
                managementBaseUrl: 'https://dev.management.file-security.icredible.com',
                timeout: 30000,
                userAgent: 'iCredible-Git-Security/2.0',
            },
            crypto: {
                algorithm: 'aes-256-gcm',
                keyDerivation: 'pbkdf2',
                compressionLevel: 10,
                digest: 'sha256',
                saltLength: 8,
                ivLength: 16,
                keyLength: 32,
                iterations: 100000,
                authTagLength: 16,
            },
            files: {
                sourceArchiveDir: 'repo-mirror',
                tarArchiveFile: 'repo-mirror.tar',
                compressedArchiveFile: 'repo-mirror.tar.zst',
                encryptedArchiveFile: 'repo-mirror.tar.zst.enc',
            },
            endpoint: {
                endpointType: 'PC'
            },
            git: {
                userName: 'iCredible Git Security',
                userEmail: 'icredible-git-sec@icredible.com',
            },
            otp: {
                sourceType: 'FileDownload',
                generationMode: 'Number',
                endpointType: 'Workstation',
                verificationKey: '1',
            },
            upload: {
                attributes: 32,
                compressionEngine: 'None',
                compressionLevel: 'NoCompression',
                encryptionType: 'None',
                revisionType: 1,
            },
        };
    }
    getInputsFromEnvironment() {
        const getInput = (name, required = true) => {
            const value = process.env[`INPUT_${name.toUpperCase()}`] || '';
            if (required && !value) {
                throw new Error(`Required input '${name}' is missing`);
            }
            return value;
        };
        const getBooleanInput = (name, defaultValue = false) => {
            const value = getInput(name, false).toLowerCase();
            if (value === 'true')
                return true;
            if (value === 'false')
                return false;
            return defaultValue;
        };
        return {
            icredible_activation_code: getInput('icredible_activation_code'),
            icredible_encryption_password: getInput('icredible_encryption_password'),
            action: getInput('action', false) || 'backup',
            file_version_id: getInput('file_version_id', false),
            icredible_repository_restore_token: getInput('icredible_repository_restore_token', false),
            suspend_actions: getBooleanInput('suspend_actions', true),
            otp_delivery_method: getInput('otp_delivery_method', false) || 'MAIL',
        };
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=config.service.js.map