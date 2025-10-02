import { BaseService } from "../base/base-service";
import { ICryptoService, ILogger } from "../base/interfaces";
import { CryptoConfig } from "@/types/config";
export declare class CryptoService extends BaseService implements ICryptoService {
    private cryptoConfig;
    constructor(logger: ILogger, cryptoConfig: CryptoConfig);
    protected onInitialize(): Promise<void>;
    encrypt(inputBuffer: Buffer, password: string): Promise<Buffer>;
    decrypt(encryptedBuffer: Buffer, password: string): Promise<Buffer>;
    decryptBackup(encryptedBuffer: Buffer, password: string): Promise<Buffer>;
    encryptArchive(filePath: string, password: string): Promise<Buffer>;
    getEncryptedFileName(password: string): string;
}
//# sourceMappingURL=crypto.service.d.ts.map