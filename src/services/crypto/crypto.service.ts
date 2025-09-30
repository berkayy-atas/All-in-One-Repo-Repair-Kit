import { createHash, pbkdf2, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';
import { BaseService } from '../base/base-service';
import { ICryptoService, ILogger } from '../base/interfaces';
import { promises as fs } from 'fs';
import { CryptoConfig } from '@/types/config';


const pbkdf2Async = promisify(pbkdf2);

export class CryptoService extends BaseService implements ICryptoService {
  private cryptoConfig: CryptoConfig;

  constructor(logger: ILogger, cryptoConfig: CryptoConfig) {
    super(logger);
    this.cryptoConfig = cryptoConfig;
  }

  protected async onInitialize(): Promise<void> {
    try {
      const testHash = createHash('sha256');
      testHash.update('test');
      testHash.digest('hex');
    } catch (error) {
      throw new Error('Crypto functionality not available');
    }
  }


public async encrypt(inputBuffer: Buffer, password: string): Promise<Buffer> {
  this.ensureInitialized();
  try {
    const salt = randomBytes(this.cryptoConfig.saltLength); 
    const key = await pbkdf2Async(password, salt, this.cryptoConfig.iterations, this.cryptoConfig.keyLength, this.cryptoConfig.digest);
    const iv = randomBytes(this.cryptoConfig.ivLength);
    
    const cipher = createCipheriv(this.cryptoConfig.algorithm, key, iv);
    const encryptedData = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // Include authTag in the output: Salted__ + salt + iv + authTag + encryptedData
    return Buffer.concat([Buffer.from('Salted__'), salt, iv, authTag, encryptedData]);
  } catch (error) {
    this.handleError(error, 'Failed to encrypt data');
  }
}


  public async decrypt(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
  this.ensureInitialized();
  try {

    const salt = encryptedBuffer.subarray(8, 8 + this.cryptoConfig.saltLength);
    const iv = encryptedBuffer.subarray(8 + this.cryptoConfig.saltLength, 8 + this.cryptoConfig.saltLength + this.cryptoConfig.ivLength);
    const authTag = encryptedBuffer.subarray(8 + this.cryptoConfig.saltLength + this.cryptoConfig.ivLength, 8 + this.cryptoConfig.saltLength + this.cryptoConfig.ivLength + this.cryptoConfig.authTagLength);
    const encryptedData = encryptedBuffer.subarray(8 + this.cryptoConfig.saltLength + this.cryptoConfig.ivLength + this.cryptoConfig.authTagLength);

    const key = await pbkdf2Async(password, salt, this.cryptoConfig.iterations, this.cryptoConfig.keyLength, this.cryptoConfig.digest);

    const decipher = createDecipheriv(this.cryptoConfig.algorithm, key, iv);
    
    decipher.setAuthTag(authTag);

    const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decryptedData;
  } catch (error) {
    this.handleError(error, 'Failed to decrypt data');
  }
}
    public async decryptBackup(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
    return await this.decrypt(encryptedBuffer, password);
  }

    public async encryptArchive(filePath: string, password: string): Promise<Buffer> {
      const fileBuffer = await fs.readFile(filePath);
      return await this.encrypt(fileBuffer, password);
    }
  
    public getEncryptedFileName(password: string): string {
      const repoName = process.env.GITHUB_REPOSITORY?.split('/').pop() || 'repository';
      return `${repoName}.tar.zst.enc`;
    }
}