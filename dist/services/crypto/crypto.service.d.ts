import { BaseService } from '../base/base-service';
import { ICryptoService, ILogger } from '../base/interfaces';
export declare class CryptoService extends BaseService implements ICryptoService {
    private readonly saltLength;
    private readonly keyLength;
    private readonly iterations;
    constructor(logger: ILogger);
    protected onInitialize(): Promise<void>;
    hashPassword(password: string): string;
    encrypt(inputBuffer: Buffer, password: string): Promise<Buffer>;
    decrypt(encryptedBuffer: Buffer, password: string): Promise<Buffer>;
    encryptWithIV(inputBuffer: Buffer, password: string): Promise<Buffer>;
    decryptWithIV(encryptedBuffer: Buffer, password: string): Promise<Buffer>;
}
//# sourceMappingURL=crypto.service.d.ts.map