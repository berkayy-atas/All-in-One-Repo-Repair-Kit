"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
const base_service_1 = require("../base/base-service");
class OtpService extends base_service_1.BaseService {
    apiClient;
    token = '';
    managementBaseUrl;
    constructor(logger, apiClient, managementBaseUrl) {
        super(logger);
        this.apiClient = apiClient;
        this.managementBaseUrl = managementBaseUrl;
    }
    async onInitialize() {
        await this.apiClient.initialize();
    }
    setAuthToken(token) {
        this.token = token;
    }
    async requestOtp(deliveryMethod) {
        this.ensureInitialized();
        if (!this.token) {
            throw new Error('Authentication token not set. Call setAuthToken first.');
        }
        try {
            const otpResponse = await this.apiClient.requestOtp(deliveryMethod, this.token);
            const verificationUrl = this.getVerificationUrl(otpResponse);
            this.logger.notice(`OTP sent via ${deliveryMethod}.`);
            this.logger.notice(`Please verify your OTP at: ${verificationUrl}`);
            return otpResponse;
        }
        catch (error) {
            this.handleError(error, 'Failed to request OTP');
        }
    }
    async waitForOtpVerification(uniqueKey, expiresAt) {
        this.ensureInitialized();
        if (!this.token) {
            throw new Error('Authentication token not set');
        }
        try {
            const expirationTime = new Date(expiresAt).getTime();
            const pollingInterval = 5000;
            this.logger.info('Waiting for OTP verification...');
            this.logger.info(`Verification will time out at: ${new Date(expiresAt).toLocaleString()}`);
            while (Date.now() < expirationTime) {
                const statusResponse = await this.apiClient.verifyOtp(uniqueKey, this.token);
                if (statusResponse.verified) {
                    this.logger.info('✅ OTP verified successfully');
                    return true;
                }
                this.logger.debug('OTP not yet verified, waiting...');
                await new Promise(resolve => setTimeout(resolve, pollingInterval));
            }
            this.logger.error('OTP verification timed out');
            return false;
        }
        catch (error) {
            this.handleError(error, 'Failed to verify OTP');
        }
    }
    getVerificationUrl(otpResponse) {
        const queryParams = new URLSearchParams({
            createdAt: otpResponse.createdAt,
            expiresAt: otpResponse.expiresAt,
            uniqueKey: otpResponse.uniqueKey,
            source: 'FileDownload',
        });
        return `${this.managementBaseUrl}/git-security/?${queryParams.toString()}`;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async checkOtpStatus(uniqueKey) {
        this.ensureInitialized();
        if (!this.token) {
            throw new Error('Authentication token not set');
        }
        try {
            const statusResponse = await this.apiClient.verifyOtp(uniqueKey, this.token);
            return statusResponse.verified;
        }
        catch (error) {
            this.logger.warn(`Failed to check OTP status: ${String(error)}`);
            return false;
        }
    }
    getRemainingTime(expiresAt) {
        const expirationTime = new Date(expiresAt).getTime();
        const currentTime = Date.now();
        const remainingTime = Math.max(0, expirationTime - currentTime);
        return Math.ceil(remainingTime / 1000);
    }
    formatRemainingTime(expiresAt) {
        const remainingSeconds = this.getRemainingTime(expiresAt);
        if (remainingSeconds <= 0) {
            return 'Expired';
        }
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        }
        return `${seconds}s`;
    }
}
exports.OtpService = OtpService;
//# sourceMappingURL=otp.service.js.map