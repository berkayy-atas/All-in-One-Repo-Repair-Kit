"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceContainer = void 0;
const github_1 = require("@actions/github");
const logger_1 = require("@/utils/logger");
const config_service_1 = require("../config/config.service");
const validation_service_1 = require("../validation/validation.service");
const crypto_service_1 = require("../crypto/crypto.service");
const compression_service_1 = require("../compression/compression.service");
const git_service_1 = require("../git/git.service");
const api_client_service_1 = require("../api/api-client.service");
const otp_service_1 = require("../otp/otp.service");
const github_service_1 = require("../github/github.service");
const backup_workflow_service_1 = require("../workflow/backup-workflow.service");
const restore_workflow_service_1 = require("../workflow/restore-workflow.service");
const core = __importStar(require("@actions/core"));
class ServiceContainer {
    logger;
    services = new Map();
    constructor() {
        this.logger = new logger_1.GitHubActionsLogger();
    }
    getLogger() {
        return this.logger;
    }
    getConfigService() {
        if (!this.services.has('config')) {
            const validationService = this.getValidationService();
            this.services.set('config', new config_service_1.ConfigService(this.logger, validationService));
        }
        return this.services.get('config');
    }
    getValidationService() {
        if (!this.services.has('validation')) {
            this.services.set('validation', new validation_service_1.ValidationService(this.logger));
        }
        return this.services.get('validation');
    }
    getCryptoService() {
        if (!this.services.has('crypto')) {
            this.services.set('crypto', new crypto_service_1.CryptoService(this.logger));
        }
        return this.services.get('crypto');
    }
    getCompressionService() {
        if (!this.services.has('compression')) {
            this.services.set('compression', new compression_service_1.CompressionService(this.logger));
        }
        return this.services.get('compression');
    }
    getGitService() {
        if (!this.services.has('git')) {
            this.services.set('git', new git_service_1.GitService(this.logger));
        }
        return this.services.get('git');
    }
    getApiClient() {
        this.logger.info(`${core.getInput('github-token', { required: true })}`);
        const githubService = this.getGitHubService(core.getInput('github-token', { required: true }));
        if (!githubService) {
            throw new Error('ApiClientService could not be created because GitHubService is unavailable (a token is likely missing).');
        }
        if (!this.services.has('api')) {
            const config = this.getConfigService().getApiConfig();
            this.services.set('api', new api_client_service_1.ApiClientService(this.logger, config.baseUrl, githubService, config.timeout));
        }
        return this.services.get('api');
    }
    getOtpService() {
        if (!this.services.has('otp')) {
            const apiClient = this.getApiClient();
            const config = this.getConfigService().getApiConfig();
            this.services.set('otp', new otp_service_1.OtpService(this.logger, apiClient, config.managementBaseUrl));
        }
        return this.services.get('otp');
    }
    getGitHubService(token) {
        if (!token) {
            return null;
        }
        const configService = this.getConfigService();
        const serviceKey = `github_${token.substring(0, 8)}`;
        if (!this.services.has(serviceKey)) {
            this.services.set(serviceKey, new github_service_1.GitHubService(this.logger, token, github_1.context.repo.owner, github_1.context.repo.repo, configService));
        }
        return this.services.get(serviceKey);
    }
    getBackupWorkflowService() {
        if (!this.services.has('backup-workflow')) {
            this.services.set('backup-workflow', new backup_workflow_service_1.BackupWorkflowService(this.logger, this.getConfigService(), this.getCryptoService(), this.getCompressionService(), this.getGitService(), this.getApiClient()));
        }
        return this.services.get('backup-workflow');
    }
    getRestoreWorkflowService(patToken) {
        const serviceKey = patToken ? `restore-workflow-${patToken.substring(0, 8)}` : 'restore-workflow';
        if (!this.services.has(serviceKey)) {
            const githubService = this.getGitHubService(patToken);
            this.services.set(serviceKey, new restore_workflow_service_1.RestoreWorkflowService(this.logger, this.getConfigService(), this.getCryptoService(), this.getCompressionService(), this.getGitService(), this.getApiClient(), this.getOtpService(), githubService || undefined));
        }
        return this.services.get(serviceKey);
    }
    async initializeServices() {
        try {
            this.logger.info('Initializing services...');
            await this.getValidationService().initialize();
            await this.getConfigService().initialize();
            await this.getCryptoService().initialize();
            await this.getCompressionService().initialize();
            await this.getGitService().initialize();
            await this.getApiClient().initialize();
            this.logger.info('Core services initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize services', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    dispose() {
        this.logger.debug('Disposing service container');
        this.services.clear();
    }
    async validateConfiguration() {
        const configService = this.getConfigService();
        const config = configService.getConfig();
        await configService.validateInputs(config.inputs);
        this.logger.info('Configuration validation completed');
    }
    maskSecrets() {
        const config = this.getConfigService().getConfig();
        this.logger.setSecret(config.inputs.icredible_encryption_password);
        this.logger.setSecret(config.inputs.icredible_activation_code);
        if (config.inputs.icredible_repository_restore_token) {
            this.logger.setSecret(config.inputs.icredible_repository_restore_token);
        }
        this.logger.debug('Sensitive information masked in logs');
    }
}
exports.ServiceContainer = ServiceContainer;
//# sourceMappingURL=service-container.js.map