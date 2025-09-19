"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto_1 = require("crypto");
const util_1 = require("util");
const base_service_1 = require("../base/base-service");
const pbkdf2Async = (0, util_1.promisify)(crypto_1.pbkdf2);
class CryptoService extends base_service_1.BaseService {
    constructor(logger) {
        super(logger);
    }
    async onInitialize() {
        try {
            const testHash = (0, crypto_1.createHash)('sha256');
            testHash.update('test');
            testHash.digest('hex');
        }
        catch (error) {
            throw new Error('Crypto functionality not available');
        }
    }
    hashPassword(password) {
        this.ensureInitialized();
        try {
            const hash = (0, crypto_1.createHash)('sha256');
            hash.update(password, 'utf8');
            return hash.digest('hex');
        }
        catch (error) {
            this.handleError(error, 'Failed to hash password');
        }
    }
    async encrypt(inputBuffer, password) {
        this.ensureInitialized();
        try {
            const saltLength = 8;
            const ivLength = 16;
            const keyLength = 32;
            const iterations = 100000;
            const algorithm = 'aes-256-cbc';
            const digest = 'sha256';
            const salt = (0, crypto_1.randomBytes)(saltLength);
            const key = await pbkdf2Async(password, salt, iterations, keyLength, digest);
            const iv = (0, crypto_1.randomBytes)(ivLength);
            const cipher = (0, crypto_1.createCipheriv)(algorithm, key, iv);
            const encryptedData = Buffer.concat([cipher.update(inputBuffer), cipher.final()]);
            return Buffer.concat([Buffer.from('Salted__'), salt, iv, encryptedData]);
        }
        catch (error) {
            this.handleError(error, 'Failed to encrypt data');
        }
    }
    async decrypt(encryptedBuffer, password) {
        this.ensureInitialized();
        try {
            const saltLength = 8;
            const ivLength = 16;
            const keyLength = 32;
            const iterations = 100000;
            const algorithm = 'aes-256-cbc';
            const digest = 'sha256';
            const salt = encryptedBuffer.subarray(8, 8 + saltLength);
            const iv = encryptedBuffer.subarray(8 + saltLength, 8 + saltLength + ivLength);
            const encryptedData = encryptedBuffer.subarray(8 + saltLength + ivLength);
            const key = await pbkdf2Async(password, salt, iterations, keyLength, digest);
            const decipher = (0, crypto_1.createDecipheriv)(algorithm, key, iv);
            const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
            return decryptedData;
        }
        catch (error) {
            this.handleError(error, 'Failed to decrypt data');
        }
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=crypto.service.js.map