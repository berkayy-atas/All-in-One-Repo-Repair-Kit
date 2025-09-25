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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClientService = void 0;
const form_data_1 = __importDefault(require("form-data"));
const base_service_1 = require("../base/base-service");
const github_service_1 = require("../github/github.service");
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
const github_1 = require("@actions/github");
class ApiClientService extends base_service_1.BaseService {
    configService;
    baseUrl;
    timeout;
    userAgent;
    axiosInstance;
    constructor(logger, configService, timeout = 30000) {
        super(logger);
        this.configService = configService;
        this.timeout = timeout;
        this.baseUrl = configService.getApiConfig().baseUrl;
        this.userAgent = configService.getApiConfig().UserAgent;
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: this.timeout,
            headers: {
                'User-Agent': this.userAgent,
            },
        });
        this.axiosInstance.interceptors.response.use((response) => response, (error) => {
            this.handleAxiosError(error, 'API request failed');
        });
    }
    async onInitialize() {
    }
    async authenticate(activationCode) {
        this.ensureInitialized();
        try {
            this.logger.info('Authenticating with iCredible API');
            const defaultToken = core.getInput('github-token', { required: true });
            const defaultTokenGitHubService = new github_service_1.GitHubService(this.logger, defaultToken, github_1.context.repo.owner, github_1.context.repo.repo, this.configService);
            await defaultTokenGitHubService.initialize();
            const activationDetails = await defaultTokenGitHubService.getRepositoryActivationDetails();
            const requestBody = {
                activationCode: activationCode,
                ...activationDetails,
            };
            const response = await this.axiosInstance.post('/endpoint/activation', requestBody);
            const apiResponse = response.data;
            if (!apiResponse.success) {
                throw new Error(`Authentication failed: ${apiResponse.error || apiResponse.message}`);
            }
            this.logger.info('Authentication successful');
            return apiResponse.data;
        }
        catch (error) {
            this.handleError(error, 'Failed to authenticate with iCredible API');
        }
    }
    async uploadBackup(uploadData, token) {
        this.ensureInitialized();
        try {
            this.logger.info(`Uploading backup file: ${uploadData.fileName}`);
            const form = new form_data_1.default();
            form.append('file', uploadData.file, {
                filename: uploadData.fileName,
                contentType: 'application/octet-stream',
            });
            form.append('Size', uploadData.size.toString());
            form.append('CompressedFileSize', uploadData.compressedFileSize.toString());
            form.append('Attributes', uploadData.attributes.toString());
            form.append('FileName', uploadData.fileName);
            form.append('CompressionEngine', uploadData.compressionEngine);
            form.append('CompressionLevel', uploadData.compressionLevel);
            form.append('FullPath', uploadData.fullPath);
            form.append('EncryptionType', uploadData.encryptionType);
            form.append('RevisionType', uploadData.revisionType.toString());
            form.append('MetaData[Event]', uploadData.metadata.event);
            form.append('MetaData[Ref]', uploadData.metadata.ref);
            form.append('MetaData[Actor]', uploadData.metadata.actor);
            form.append('MetaData[Owner]', uploadData.metadata.owner);
            form.append('MetaData[OwnerType]', uploadData.metadata.ownerType);
            if (uploadData.metadata.commit) {
                form.append('MetaData[Commit]', uploadData.metadata.commit);
                form.append('MetaData[CommitShort]', uploadData.metadata.commitShort);
                form.append('MetaData[Author]', uploadData.metadata.author);
                form.append('MetaData[Date]', uploadData.metadata.date);
                form.append('MetaData[Committer]', uploadData.metadata.committer);
                form.append('MetaData[Message]', uploadData.metadata.message);
            }
            const headers = {
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'iCredible-Git-Security/2.0',
                ...form.getHeaders(),
            };
            const response = await this.axiosInstance.post('/backup/shield', form, {
                headers: headers,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            const apiResponse = response.data;
            if (!apiResponse.success) {
                throw new Error(`Upload failed: ${apiResponse.error || apiResponse.message}`);
            }
            this.logger.info('Backup uploaded successfully');
            return apiResponse.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response) {
                const serverError = JSON.stringify(error.response.data);
                this.handleError(new Error(`Upload failed: HTTP ${error.response.status} - ${serverError}`), 'Failed to upload backup');
            }
            else {
                this.handleError(error, 'Failed to upload backup');
            }
        }
    }
    async requestOtp(deliveryMethod, token) {
        this.ensureInitialized();
        try {
            this.logger.info(`Requesting OTP via ${deliveryMethod}`);
            const requestBody = {
                Type: deliveryMethod,
                Source: 'FileDownload',
                OtpGenerationMode: 'Number',
            };
            const response = await this.axiosInstance.post('/OTP/Send', requestBody, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const apiResponse = response.data;
            if (!apiResponse.success) {
                throw new Error(`OTP request failed: ${apiResponse.error || apiResponse.message}`);
            }
            this.logger.info('OTP requested successfully');
            return apiResponse.data;
        }
        catch (error) {
            this.handleAxiosError(error, 'Failed to request OTP');
        }
    }
    async verifyOtp(uniqueKey, token) {
        this.ensureInitialized();
        try {
            const requestBody = { uniqueKey: uniqueKey };
            const response = await this.axiosInstance.post('/OTP/GetOTPStatus', requestBody, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const apiResponse = response.data;
            return { verified: apiResponse.success && apiResponse.data === true };
        }
        catch (error) {
            this.logger.warn(`OTP verification check failed: ${String(error)}`);
            return { verified: false };
        }
    }
    async downloadBackup(fileVersionId, token, uniqueKey) {
        this.ensureInitialized();
        try {
            this.logger.info(`Downloading backup with version ID: ${fileVersionId}`);
            const response = await this.axiosInstance.get(`/restore/${fileVersionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Unique-Key': uniqueKey,
                    'X-Verification-Key': '1',
                },
                responseType: 'arraybuffer',
            });
            const buffer = Buffer.from(response.data);
            this.logger.info(`Backup downloaded successfully. Size: ${buffer.length} bytes`);
            return buffer;
        }
        catch (error) {
            this.handleAxiosError(error, 'Failed to download backup');
        }
    }
    handleAxiosError(error, contextMessage) {
        if (axios_1.default.isAxiosError(error) && error.response) {
            const serverError = JSON.stringify(error.response.data);
            this.handleError(new Error(`${contextMessage}: HTTP ${error.response.status} - ${serverError}`), contextMessage);
        }
        else {
            this.handleError(error, contextMessage);
        }
    }
}
exports.ApiClientService = ApiClientService;
//# sourceMappingURL=api-client.service.js.map