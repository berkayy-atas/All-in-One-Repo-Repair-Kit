import { BaseService } from '../base/base-service';
import { GitHubService } from '../github/github.service';
import { IApiClient, ILogger } from '../base/interfaces';
import { AuthTokenResponse, BackupUploadResponse, OtpResponse, OtpStatusResponse, FileUploadData, ApiResponse } from '@/types/api';
export declare class ApiClientService extends BaseService implements IApiClient {
    private httpClient;
    private baseUrl;
    private timeout;
    private githubService;
    constructor(logger: ILogger, baseUrl: string, githubService: GitHubService, timeout?: number);
    protected onInitialize(): Promise<void>;
    authenticate(activationCode: string): Promise<AuthTokenResponse>;
    uploadBackup(uploadData: FileUploadData, fileSecToken: string): Promise<BackupUploadResponse>;
    requestOtp(deliveryMethod: 'MAIL' | 'AUTHENTICATOR', token: string): Promise<OtpResponse>;
    verifyOtp(uniqueKey: string, token: string): Promise<OtpStatusResponse>;
    downloadBackup(fileVersionId: string, token: string, uniqueKey: string): Promise<Buffer>;
    makeRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', endpoint: string, token?: string, body?: any, additionalHeaders?: Record<string, string>): Promise<ApiResponse<T>>;
}
//# sourceMappingURL=api-client.service.d.ts.map