import { createHash, createDecipher, pbkdf2, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';
import { BaseService } from '../base/base-service';
import { ICryptoService, ILogger } from '../base/interfaces';

const pbkdf2Async = promisify(pbkdf2);

export class CryptoService extends BaseService implements ICryptoService {

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
      // Statik Kriptografi Ayarları
      const saltLength = 8;
      const ivLength = 16;
      const keyLength = 32;
      const iterations = 100000;
      const algorithm = 'aes-256-cbc';
      const digest = 'sha256';

      // 1. Rastgele bir "salt" (tuz) oluştur.
      const salt = randomBytes(saltLength);
      // 2. Parola ve salt'ı kullanarak yavaş ve güvenli bir şekilde anahtar türet (PBKDF2).
      const key = await pbkdf2Async(password, salt, iterations, keyLength, digest);
      // 3. Rastgele bir "iv" (başlatma vektörü) oluştur.
      const iv = randomBytes(ivLength);
      // 4. Anahtar ve IV kullanarak modern şifreleyiciyi oluştur.
      const cipher = createCipheriv(algorithm, key, iv);
      // 5. Veriyi şifrele.
      const encryptedData = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
      
      // 6. DÜZELTME: Sonuç artık IV'yi de içeriyor.
      // Format: [header(8)][salt(8)][iv(16)][encrypted_data]
      return Buffer.concat([Buffer.from('Salted__'), salt, iv, encryptedData]);
    } catch (error) {
      this.handleError(error, 'Failed to encrypt data');
    }
  }

  /**
   * Şifrelenmiş bir veriyi (Buffer) verilen parolayla çözer.
   * Bu metod, yukarıdaki 'encrypt' metodunun oluşturduğu formatı bekler.
   */
  public async decrypt(encryptedBuffer: Buffer, password: string): Promise<Buffer> {
    this.ensureInitialized();
    try {
      // Statik Kriptografi Ayarları (encrypt ile aynı olmalı)
      const saltLength = 8;
      const ivLength = 16;
      const keyLength = 32;
      const iterations = 100000;
      const algorithm = 'aes-256-cbc';
      const digest = 'sha256';

      // 1. Dosyanın başından salt ve IV'yi ayıkla.
      const salt = encryptedBuffer.subarray(8, 8 + saltLength);
      const iv = encryptedBuffer.subarray(8 + saltLength, 8 + saltLength + ivLength);
      const encryptedData = encryptedBuffer.subarray(8 + saltLength + ivLength);

      // 2. Şifreleme sırasında kullanılan AYNI anahtarı yeniden türet.
      const key = await pbkdf2Async(password, salt, iterations, keyLength, digest);

      // 3. Anahtar ve IV kullanarak modern şifre çözücüyü oluştur.
      const decipher = createDecipheriv(algorithm, key, iv);

      // 4. Verinin şifresini çöz.
      const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
      return decryptedData;
    } catch (error) {
      // Hata genellikle burada "bad decrypt" olarak fırlatılır.
      this.handleError(error, 'Failed to decrypt data');
    }
  }
  
}