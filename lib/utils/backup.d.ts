import { FileUploadData } from '@/types/api';
export declare class BackupUtils {
    static createUploadData(encryptedBuffer: Buffer, fileName: string, originalSize: number, encryptedSize: number, commitInfo: any, config: any): FileUploadData;
    static formatBytes(bytes: number): string;
}
//# sourceMappingURL=backup.d.ts.map