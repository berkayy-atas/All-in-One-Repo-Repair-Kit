import { createHash, createCipher, createDecipher, pbkdf2, randomBytes } from 'crypto';
import { promisify } from 'util';
import { BaseService } from '../base/base-service';
import { ICryptoService, ILogger } from '../base/interfaces';

const pbkdf2Async = promisify(pbkdf2);

export class CryptoService extends BaseService implements ICryptoService {
  private readonly saltLength = 8;
  private readonly keyLength = 32; // 256 bits
  private readonly iterations = 100000; // PBKDF2 iterations

  constructor(logger: ILogger) {
    super(logger);
  }

  protected async onInitialize(): Promise<void> {
    // Test crypto functionality is available
    try {
      const testHash = createHash('sha256');
      testHash.update('test');
      testHash.digest('hex');
    } catch (error) {
      throw new Error('Crypto functionality not available');
    }
  }

  public hashPassword(password: string): string {
    this.ensureInitialized();
    
    try {
      const hash = createHash('sha256');
      hash.update(password, 'utf8');
      return hash.digest('hex');
    } catch (error) {
      this.handleError(error, 'Failed to hash password');
    }
  }

  public async encrypt(inputBuffer: Buffer, password: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      // Generate random salt
      const salt = randomBytes(this.saltLength);
      
      // Derive key using PBKDF2
      const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
      
      // Generate random IV
      const iv = randomBytes(16); // 128 bits for AES
      
      // Create cipher
      const cipher = createCipher('aes-256-cbc', key);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(inputBuffer),
        cipher.final()
      ]);
      
      // Combine salt, iv, and encrypted data
      // Format: [salt(8)][iv(16)][encrypted_data]
      const result = Buffer.concat([
        Buffer.from('Salted__'), // OpenSSL compatible header
        salt,
        encrypted
      ]);
      
      return result;
    } catch (error) {
      this.handleError(error, 'Failed to encrypt data');
    }
  }

  public async decrypt(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      // Check for OpenSSL compatible header
      const headerLength = 8; // "Salted__"
      const saltLength = 8;
      
      if (encryptedBuffer.length < headerLength + saltLength) {
        throw new Error('Invalid encrypted data format');
      }
      
      const header = encryptedBuffer.subarray(0, headerLength);
      if (header.toString() !== 'Salted__') {
        throw new Error('Invalid encrypted data header');
      }
      
      // Extract salt and encrypted data
      const salt = encryptedBuffer.subarray(headerLength, headerLength + saltLength);
      const encryptedData = encryptedBuffer.subarray(headerLength + saltLength);
      
      // Derive key using PBKDF2
      const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
      
      // Create decipher
      const decipher = createDecipher('aes-256-cbc', key);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      this.handleError(error, 'Failed to decrypt data');
    }
  }

  // Alternative implementation using createCipheriv for more control
  public async encryptWithIV(inputBuffer: Buffer, password: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      // Generate random salt and IV
      const salt = randomBytes(this.saltLength);
      const iv = randomBytes(16);
      
      // Derive key using PBKDF2
      const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
      
      // Create cipher with explicit IV
      const cipher = require('crypto').createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(inputBuffer),
        cipher.final()
      ]);
      
      // Combine salt, iv, and encrypted data
      // Format: [header(8)][salt(8)][iv(16)][encrypted_data]
      const result = Buffer.concat([
        Buffer.from('Salted__'),
        salt,
        iv,
        encrypted
      ]);
      
      return result;
    } catch (error) {
      this.handleError(error, 'Failed to encrypt data with IV');
    }
  }

  public async decryptWithIV(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
    this.ensureInitialized();

    try {
      const headerLength = 8;
      const saltLength = 8;
      const ivLength = 16;
      const minLength = headerLength + saltLength + ivLength;
      
      if (encryptedBuffer.length < minLength) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Extract components
      const header = encryptedBuffer.subarray(0, headerLength);
      if (header.toString() !== 'Salted__') {
        throw new Error('Invalid encrypted data header');
      }
      
      const salt = encryptedBuffer.subarray(headerLength, headerLength + saltLength);
      const iv = encryptedBuffer.subarray(headerLength + saltLength, headerLength + saltLength + ivLength);
      const encryptedData = encryptedBuffer.subarray(headerLength + saltLength + ivLength);
      
      // Derive key
      const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
      
      // Create decipher
      const decipher = require('crypto').createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      return decrypted;
    } catch (error) {
      this.handleError(error, 'Failed to decrypt data with IV');
    }
  }
}