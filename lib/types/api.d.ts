export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    error?: string;
}
export interface AuthTokenResponse {
    token: string;
    expires_at: string;
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