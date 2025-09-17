"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto_1 = require("crypto");
const util_1 = require("util");
const base_service_1 = require("../base/base-service");
const pbkdf2Async = (0, util_1.promisify)(crypto_1.pbkdf2);
class CryptoService extends base_service_1.BaseService {
    saltLength = 8;
    keyLength = 32;
    iterations = 100000;
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
            const salt = (0, crypto_1.randomBytes)(this.saltLength);
            const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
            const iv = (0, crypto_1.randomBytes)(16);
            const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, iv);
            const encrypted = Buffer.concat([
                cipher.update(inputBuffer),
                cipher.final()
            ]);
            const result = Buffer.concat([
                Buffer.from('Salted__'),
                salt,
                encrypted
            ]);
            return result;
        }
        catch (error) {
            this.handleError(error, 'Failed to encrypt data');
        }
    }
    async decrypt(encryptedBuffer, password) {
        this.ensureInitialized();
        try {
            const headerLength = 8;
            const saltLength = 8;
            if (encryptedBuffer.length < headerLength + saltLength) {
                throw new Error('Invalid encrypted data format');
            }
            const header = encryptedBuffer.subarray(0, headerLength);
            if (header.toString() !== 'Salted__') {
                throw new Error('Invalid encrypted data header');
            }
            const salt = encryptedBuffer.subarray(headerLength, headerLength + saltLength);
            const encryptedData = encryptedBuffer.subarray(headerLength + saltLength);
            const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
            const decipher = (0, crypto_1.createDecipher)('aes-256-cbc', key);
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            return decrypted;
        }
        catch (error) {
            this.handleError(error, 'Failed to decrypt data');
        }
    }
    async encryptWithIV(inputBuffer, password) {
        this.ensureInitialized();
        try {
            const salt = (0, crypto_1.randomBytes)(this.saltLength);
            const iv = (0, crypto_1.randomBytes)(16);
            const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
            const cipher = require('crypto').createCipheriv('aes-256-cbc', key, iv);
            const encrypted = Buffer.concat([
                cipher.update(inputBuffer),
                cipher.final()
            ]);
            const result = Buffer.concat([
                Buffer.from('Salted__'),
                salt,
                iv,
                encrypted
            ]);
            return result;
        }
        catch (error) {
            this.handleError(error, 'Failed to encrypt data with IV');
        }
    }
    async decryptWithIV(encryptedBuffer, password) {
        this.ensureInitialized();
        try {
            const headerLength = 8;
            const saltLength = 8;
            const ivLength = 16;
            const minLength = headerLength + saltLength + ivLength;
            if (encryptedBuffer.length < minLength) {
                throw new Error('Invalid encrypted data format');
            }
            const header = encryptedBuffer.subarray(0, headerLength);
            if (header.toString() !== 'Salted__') {
                throw new Error('Invalid encrypted data header');
            }
            const salt = encryptedBuffer.subarray(headerLength, headerLength + saltLength);
            const iv = encryptedBuffer.subarray(headerLength + saltLength, headerLength + saltLength + ivLength);
            const encryptedData = encryptedBuffer.subarray(headerLength + saltLength + ivLength);
            const key = await pbkdf2Async(password, salt, this.iterations, this.keyLength, 'sha256');
            const decipher = require('crypto').createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([
                decipher.update(encryptedData),
                decipher.final()
            ]);
            return decrypted;
        }
        catch (error) {
            this.handleError(error, 'Failed to decrypt data with IV');
        }
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=crypto.service.js.map