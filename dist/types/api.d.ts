export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}
export interface AuthTokenRequest {
    activationCode: string;
    uniqueId: string;
    ip?: string;
    operatingSystem?: string;
    endpointType?: string;
    endpointName: string;
}
export interface RepositoryActivationDetails {
    uniqueId: string;
    operatingSystem: 'Linux' | 'Windows' | 'MacOS';
    endpointName: string;
    ip: string;
    endpointType: string;
}
export interface AuthTokenResponse {
    endpointCode: string;
    endpointId: number;
    endpointName: string;
    token: string;
    refreshtoken: string;
    userId: number;
    ip: string;
    uniqueId: string;
    activationCode: string;
    operatingSystem: string | null;
    endpointType: string | null;
    specialPassword: string | null;
}
export interface BackupUploadResponse {
    recordId: string;
    directoryRecordId: string;
}
export interface CommitMetadata {
    commit: string;
    commitShort: string;
    parents: string;
    author: string;
    date: string;
    committer: string;
    message: string;
}
export interface BackupMetadata extends CommitMetadata {
    event: string;
    ref: string;
    actor: string;
    owner: string;
    ownerType: string;
}
export interface OtpRequest {
    deliveryMethod: 'MAIL' | 'AUTHENTICATOR';
    sourceType: string;
    generationMode: string;
    endpointType: string;
    endpointName: string;
}
export interface OtpResponse {
    uniqueKey: string;
    createdAt: string;
    expiresAt: string;
}
export interface OtpStatusRequest {
    uniqueKey: string;
}
export interface OtpStatusResponse {
    verified: boolean;
}
export interface RestoreRequest {
    fileVersionId: string;
    authorization: string;
    uniqueKey: string;
}
export interface FileUploadData {
    file: Buffer;
    size: number;
    compressedFileSize: number;
    attributes: number;
    fileName: string;
    fullPath: string;
    compressionEngine: string;
    compressionLevel: string;
    encryptionType: string;
    revisionType: number;
    metadata: BackupMetadata;
}
//# sourceMappingURL=api.d.ts.map