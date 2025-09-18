"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiClientService = void 0;
const http_client_1 = require("@actions/http-client");
const form_data_1 = __importDefault(require("form-data"));
const base_service_1 = require("../base/base-service");
class ApiClientService extends base_service_1.BaseService {
    httpClient;
    baseUrl;
    timeout;
    githubService;
    constructor(logger, baseUrl, githubService, timeout = 30000) {
        super(logger);
        this.baseUrl = baseUrl;
        this.timeout = timeout;
        this.githubService = githubService;
        this.httpClient = new http_client_1.HttpClient('iCredible-Git-Security/2.0', undefined, {
            allowRetries: true,
            maxRetries: 3,
        });
    }
    async onInitialize() {
        await this.githubService.initialize();
        try {
            await this.httpClient.get(`${this.baseUrl}/health`, {
                'User-Agent': 'iCredible-Git-Security/2.0',
            });
        }
        catch (error) {
            this.logger.warn('Health check failed, continuing anyway');
        }
    }
    async authenticate(activationCode) {
        this.ensureInitialized();
        try {
            this.logger.info('Authenticating with iCredible API');
            const activationDetails = await this.githubService.getRepositoryActivationDetails();
            const requestBody = {
                activationCode: activationCode,
                ...activationDetails,
            };
            const response = await this.httpClient.post(`${this.baseUrl}/endpoint/activation`, JSON.stringify(requestBody), {
                'Content-Type': 'application/json',
            });
            if (response.message.statusCode !== 200) {
                throw new Error(`Authentication failed: HTTP ${response.message.statusCode}`);
            }
            const responseBody = await response.readBody();
            const apiResponse = JSON.parse(responseBody);
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
            form.append('encryptionType', uploadData.encryptionType);
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
            const response = await this.httpClient.post(`${this.baseUrl}/backup/shield`, form.getBuffer().toString('binary'), headers);
            if (response.message.statusCode !== 200) {
                const errorBody = await response.readBody();
                throw new Error(`Upload failed: HTTP ${response.message.statusCode} - ${errorBody}`);
            }
            const responseBody = await response.readBody();
            const apiResponse = JSON.parse(responseBody);
            if (!apiResponse.success) {
                throw new Error(`Upload failed: ${apiResponse.error || apiResponse.message}`);
            }
            this.logger.info('Backup uploaded successfully');
            return apiResponse.data;
        }
        catch (error) {
            this.handleError(error, 'Failed to upload backup');
        }
    }
    async requestOtp(deliveryMethod, token) {
        this.ensureInitialized();
        try {
            this.logger.info(`Requesting OTP via ${deliveryMethod}`);
            const requestBody = JSON.stringify({
                deliveryMethod: deliveryMethod,
                sourceType: 'FileDownload',
                generationMode: 'Number',
                endpointType: 'Workstation',
                endpointName: `Github Endpoint (${process.env.GITHUB_REPOSITORY || 'Unknown'})`,
            });
            const response = await this.httpClient.post(`${this.baseUrl}/OTP/Send`, requestBody, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'iCredible-Git-Security/2.0',
            });
            if (response.message.statusCode !== 200) {
                const errorBody = await response.readBody();
                throw new Error(`OTP request failed: HTTP ${response.message.statusCode} - ${errorBody}`);
            }
            const responseBody = await response.readBody();
            const apiResponse = JSON.parse(responseBody);
            if (!apiResponse.success) {
                throw new Error(`OTP request failed: ${apiResponse.error || apiResponse.message}`);
            }
            this.logger.info('OTP requested successfully');
            return apiResponse.data;
        }
        catch (error) {
            this.handleError(error, 'Failed to request OTP');
        }
    }
    async verifyOtp(uniqueKey, token) {
        this.ensureInitialized();
        try {
            const requestBody = JSON.stringify({
                uniqueKey: uniqueKey,
            });
            const response = await this.httpClient.post(`${this.baseUrl}/OTP/GetOTPStatus`, requestBody, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'iCredible-Git-Security/2.0',
            });
            if (response.message.statusCode !== 200) {
                return { verified: false };
            }
            const responseBody = await response.readBody();
            const apiResponse = JSON.parse(responseBody);
            return {
                verified: apiResponse.success && apiResponse.data === true,
            };
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
            const headers = {
                'Authorization': `Bearer ${token}`,
                'X-Unique-Key': uniqueKey,
                'User-Agent': 'iCredible-Git-Security/2.0',
            };
            const response = await this.httpClient.get(`${this.baseUrl}/restore/${fileVersionId}`, headers);
            if (response.message.statusCode !== 200) {
                const errorBody = await response.readBody();
                throw new Error(`Download failed: HTTP ${response.message.statusCode} - ${errorBody}`);
            }
            const responseBody = await response.readBody();
            const buffer = Buffer.from(responseBody, 'binary');
            this.logger.info(`Backup downloaded successfully. Size: ${buffer.length} bytes`);
            return buffer;
        }
        catch (error) {
            this.handleError(error, 'Failed to download backup');
        }
    }
    async makeRequest(method, endpoint, token, body, additionalHeaders) {
        this.ensureInitialized();
        try {
            const headers = {
                'User-Agent': 'iCredible-Git-Security/2.0',
                ...additionalHeaders,
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            if (body && typeof body === 'object') {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(body);
            }
            const url = `${this.baseUrl}${endpoint}`;
            let response;
            switch (method) {
                case 'GET':
                    response = await this.httpClient.get(url, headers);
                    break;
                case 'POST':
                    response = await this.httpClient.post(url, body, headers);
                    break;
                case 'PUT':
                    response = await this.httpClient.put(url, body, headers);
                    break;
                case 'DELETE':
                    response = await this.httpClient.del(url, headers);
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${method}`);
            }
            const responseBody = await response.readBody();
            if (response.message.statusCode && response.message.statusCode >= 400) {
                throw new Error(`HTTP ${response.message.statusCode}: ${responseBody}`);
            }
            return JSON.parse(responseBody);
        }
        catch (error) {
            this.handleError(error, `Failed to make ${method} request to ${endpoint}`);
        }
    }
}
exports.ApiClientService = ApiClientService;
//# sourceMappingURL=api-client.service.js.map