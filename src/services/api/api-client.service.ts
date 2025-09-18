import { HttpClient } from '@actions/http-client';
import { BearerCredentialHandler } from '@actions/http-client/lib/auth';
import FormData from 'form-data';
import axios from 'axios';
import { BaseService } from '../base/base-service';
import { GitHubService } from '../github/github.service';
import { IApiClient, IGitHubService, ILogger } from '../base/interfaces';
import {
  AuthTokenResponse,
  BackupUploadResponse,
  OtpResponse,
  OtpStatusResponse,
  FileUploadData,
  ApiResponse,
  AuthTokenRequest,
} from '@/types/api';

export class ApiClientService extends BaseService implements IApiClient {
  private httpClient: HttpClient;
  private baseUrl: string;
  private timeout: number;
  private githubService: GitHubService;

  constructor(logger: ILogger, baseUrl: string,githubService: GitHubService, timeout: number = 30000) {
    super(logger);
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.githubService = githubService;
    this.httpClient = new HttpClient('iCredible-Git-Security/2.0', undefined, {
      allowRetries: true,
      maxRetries: 3,
    });
  }

  protected async onInitialize(): Promise<void> {
    await this.githubService.initialize();
    // Test HTTP client functionality
    try {
      await this.httpClient.get(`${this.baseUrl}/health`, {
        'User-Agent': 'iCredible-Git-Security/2.0',
      });
    } catch (error) {
      this.logger.warn('Health check failed, continuing anyway');
    }
  }

  public async authenticate(activationCode: string): Promise<AuthTokenResponse> {
    this.ensureInitialized();

    try {
      this.logger.info('Authenticating with iCredible API');
    const activationDetails = await this.githubService.getRepositoryActivationDetails();
    const requestBody : AuthTokenRequest  = {
        activationCode: activationCode,
        ...activationDetails,
    };

      const response = await this.httpClient.post(
        `${this.baseUrl}/endpoint/activation`,
        JSON.stringify(requestBody),
        {
          'Content-Type': 'application/json',
        }
      );

      if (response.message.statusCode !== 200) {
        throw new Error(`Authentication failed: HTTP ${response.message.statusCode}`);
      }

      const responseBody = await response.readBody();
      const apiResponse: ApiResponse<AuthTokenResponse> = JSON.parse(responseBody);

      if (!apiResponse.success) {
        throw new Error(`Authentication failed: ${apiResponse.error || apiResponse.message}`);
      }

      this.logger.info('Authentication successful');
      return apiResponse.data;
    } catch (error) {
      this.handleError(error, 'Failed to authenticate with iCredible API');
    }
  }
  // ... constructor ve diğer metodlar aynı kalır ...

  public async uploadBackup(uploadData: FileUploadData, token: string): Promise<BackupUploadResponse> {
    this.ensureInitialized();

    try {
      this.logger.info(`Uploading backup file: ${uploadData.fileName}`);

      const requestData = {
        // PascalCase anahtarları kullanmaya devam ediyoruz, bu doğru bir pratik.
        Size: uploadData.size,
        CompressedFileSize: uploadData.compressedFileSize,
        Attributes: uploadData.attributes,
        FileName: uploadData.fileName,
        FullPath: uploadData.fullPath,
        CompressionEngine: uploadData.compressionEngine,
        CompressionLevel: uploadData.compressionLevel,
        EncryptionType: uploadData.encryptionType,
        RevisionType: uploadData.revisionType,
        MetaData: {
          Event: uploadData.metadata.event,
          Ref: uploadData.metadata.ref,
          Actor: uploadData.metadata.actor,
          Owner: uploadData.metadata.owner,
          OwnerType: uploadData.metadata.ownerType,
          Commit: uploadData.metadata.commit,
          CommitShort: uploadData.metadata.commitShort,
          Author: uploadData.metadata.author,
          Date: uploadData.metadata.date,
          Committer: uploadData.metadata.committer,
          Message: uploadData.metadata.message,
        }
      };

      const requestJson = JSON.stringify(requestData);

      const form = new FormData();
      form.append('file', uploadData.file, {
        filename: uploadData.fileName,
        contentType: 'application/octet-stream',
      });
      form.append('request', requestJson, {
        contentType: 'application/json'
      });
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'iCredible-Git-Security/2.0',
        ...form.getHeaders(), // axios, form-data kütüphanesiyle sorunsuz çalışır
      };

      // @actions/http-client yerine axios kullanarak POST isteği yap
      const response = await axios.post(
        `${this.baseUrl}/backup/shield`,
        form, // axios, FormData stream'ini doğal olarak destekler
        {
          headers: headers,
          maxContentLength: Infinity, // Büyük dosyalar için limitleri kaldır
          maxBodyLength: Infinity,
        }
      );

      // axios'ta başarılı cevap doğrudan response.data içinde gelir
      const apiResponse: ApiResponse<BackupUploadResponse> = response.data;

      if (!apiResponse.success) {
        // axios'ta hata yönetimi genellikle try-catch bloğunun catch kısmında yapılır
        // ama API'niz 200 OK içinde { success: false } dönebileceği için bu kontrol kalmalı
        throw new Error(`Upload failed: ${apiResponse.error || apiResponse.message}`);
      }

      this.logger.info('Backup uploaded successfully');
      return apiResponse.data;

    } catch (error) {
      // axios'un hata nesnesi daha zengindir, sunucudan gelen cevabı içerir
      if (axios.isAxiosError(error) && error.response) {
        // Sunucudan bir cevap geldiyse (422, 500 vb.), o cevabı logla
        const serverError = JSON.stringify(error.response.data);
        this.handleError(
          new Error(`Upload failed: HTTP ${error.response.status} - ${serverError}`),
          'Failed to upload backup'
        );
      } else {
        // Ağ hatası gibi başka bir sorun varsa
        this.handleError(error, 'Failed to upload backup');
      }
    }
  }

  public async requestOtp(deliveryMethod: 'MAIL' | 'AUTHENTICATOR', token: string): Promise<OtpResponse> {
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

      const response = await this.httpClient.post(
        `${this.baseUrl}/OTP/Send`,
        requestBody,
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'iCredible-Git-Security/2.0',
        }
      );

      if (response.message.statusCode !== 200) {
        const errorBody = await response.readBody();
        throw new Error(`OTP request failed: HTTP ${response.message.statusCode} - ${errorBody}`);
      }

      const responseBody = await response.readBody();
      const apiResponse: ApiResponse<OtpResponse> = JSON.parse(responseBody);

      if (!apiResponse.success) {
        throw new Error(`OTP request failed: ${apiResponse.error || apiResponse.message}`);
      }

      this.logger.info('OTP requested successfully');
      return apiResponse.data;
    } catch (error) {
      this.handleError(error, 'Failed to request OTP');
    }
  }

  public async verifyOtp(uniqueKey: string, token: string): Promise<OtpStatusResponse> {
    this.ensureInitialized();

    try {
      const requestBody = JSON.stringify({
        uniqueKey: uniqueKey,
      });

      const response = await this.httpClient.post(
        `${this.baseUrl}/OTP/GetOTPStatus`,
        requestBody,
        {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'iCredible-Git-Security/2.0',
        }
      );

      if (response.message.statusCode !== 200) {
        return { verified: false };
      }

      const responseBody = await response.readBody();
      const apiResponse: ApiResponse<boolean> = JSON.parse(responseBody);

      return {
        verified: apiResponse.success && apiResponse.data === true,
      };
    } catch (error) {
      this.logger.warn(`OTP verification check failed: ${String(error)}`);
      return { verified: false };
    }
  }

  public async downloadBackup(fileVersionId: string, token: string, uniqueKey: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      this.logger.info(`Downloading backup with version ID: ${fileVersionId}`);
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'X-Unique-Key': uniqueKey,
        'User-Agent': 'iCredible-Git-Security/2.0',
      };

      const response = await this.httpClient.get(
        `${this.baseUrl}/restore/${fileVersionId}`,
        headers
      );

      if (response.message.statusCode !== 200) {
        const errorBody = await response.readBody();
        throw new Error(`Download failed: HTTP ${response.message.statusCode} - ${errorBody}`);
      }

      const responseBody = await response.readBody();
      const buffer = Buffer.from(responseBody, 'binary');
      this.logger.info(`Backup downloaded successfully. Size: ${buffer.length} bytes`);
      
      return buffer;
    } catch (error) {
      this.handleError(error, 'Failed to download backup');
    }
  }

  // Utility method for making generic API requests
  public async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    token?: string,
    body?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    this.ensureInitialized();

    try {
      const headers: Record<string, string> = {
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
    } catch (error) {
      this.handleError(error, `Failed to make ${method} request to ${endpoint}`);
    }
  }
}