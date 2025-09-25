"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestoreWorkflowService = void 0;
const fs_1 = require("fs");
const github_1 = require("@actions/github");
const base_service_1 = require("../base/base-service");
class RestoreWorkflowService extends base_service_1.BaseService {
    configService;
    cryptoService;
    compressionService;
    gitService;
    apiClient;
    otpService;
    githubService = null;
    constructor(logger, configService, cryptoService, compressionService, gitService, apiClient, otpService, githubService) {
        super(logger);
        this.configService = configService;
        this.cryptoService = cryptoService;
        this.compressionService = compressionService;
        this.gitService = gitService;
        this.apiClient = apiClient;
        this.otpService = otpService;
        this.githubService = githubService || null;
    }
    async onInitialize() {
        await this.configService.initialize();
        await this.cryptoService.initialize();
        await this.compressionService.initialize();
        await this.gitService.initialize();
        await this.apiClient.initialize();
        await this.otpService.initialize();
        if (this.githubService) {
            await this.githubService.initialize();
        }
    }
    async execute(fileVersionId) {
        this.ensureInitialized();
        let actionsWereSuspended = false;
        try {
            this.logger.info('Starting restore workflow');
            const config = this.configService.getConfig();
            const startTime = Date.now();
            this.logger.info('Step 1: Authenticating with iCredible API');
            const authResponse = await this.apiClient.authenticate(config.inputs.icredible_activation_code);
            this.otpService.setAuthToken(authResponse.token);
            this.logger.info('Step 2: Requesting OTP verification');
            const otpResponse = await this.otpService.requestOtp(config.inputs.otp_delivery_method);
            this.logger.info('Step 3: Waiting for OTP verification');
            const otpVerified = await this.otpService.waitForOtpVerification(otpResponse.uniqueKey, otpResponse.expiresAt);
            if (!otpVerified) {
                throw new Error('OTP verification failed or timed out');
            }
            this.logger.info('Step 4: Downloading backup archive');
            const encryptedBuffer = await this.apiClient.downloadBackup(fileVersionId, authResponse.token, otpResponse.uniqueKey);
            this.logger.info('Step 5: Decrypting backup archive');
            const compressedBuffer = await this.cryptoService.decryptBackup(encryptedBuffer, config.inputs.icredible_encryption_password);
            const compressedFilePath = config.files.compressedArchiveFile;
            await fs_1.promises.writeFile(compressedFilePath, compressedBuffer);
            this.logger.info('Step 6: Decompressing backup archive');
            const tarFilePath = config.files.tarArchiveFile;
            await this.compressionService.decompressZstd(compressedFilePath, tarFilePath);
            this.logger.info('Step 7: Extracting repository archive');
            const extractDir = './';
            await this.compressionService.extractTarArchive(tarFilePath, extractDir);
            const hasPatToken = !!config.inputs.icredible_repository_restore_token;
            if (hasPatToken) {
                this.logger.info('Step 8a: Syncing remote branches (PAT token available)');
                await this.gitService.syncRemoteBranches(config.files.sourceArchiveDir);
            }
            else {
                this.logger.info('Step 8b: Filtering workflow directory (default token)');
                await this.gitService.filterWorkflowDirectory(config.files.sourceArchiveDir);
            }
            if (config.inputs.suspend_actions && this.githubService && hasPatToken) {
                this.logger.info('Step 9: Suspending GitHub Actions');
                await this.githubService.suspendActions();
                actionsWereSuspended = true;
            }
            this.logger.info('Step 10: Configuring git and pushing to repository');
            await this.gitService.configureAndPush(config, hasPatToken);
            if (actionsWereSuspended && this.githubService) {
                this.logger.info('Step 11: Resuming GitHub Actions');
                await this.githubService.resumeActions();
                actionsWereSuspended = false;
            }
            await this.cleanupTemporaryFiles(config);
            const executionTime = Date.now() - startTime;
            this.displayRestoreSummary({
                fileVersionId,
                executionTime,
                actionsWereSuspended: config.inputs.suspend_actions && hasPatToken,
            });
            this.logger.info('Restore workflow completed successfully');
            return {
                success: true,
                message: 'Restore completed successfully',
                fileVersionId,
                workflowsSuspended: config.inputs.suspend_actions && hasPatToken,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Restore workflow failed', error instanceof Error ? error : new Error(errorMessage));
            if (actionsWereSuspended && this.githubService) {
                try {
                    this.logger.info('Attempting to resume GitHub Actions after failure');
                    await this.githubService.resumeActions();
                }
                catch (resumeError) {
                    this.logger.error('Failed to resume GitHub Actions', resumeError instanceof Error ? resumeError : new Error(String(resumeError)));
                }
            }
            try {
                const config = this.configService.getConfig();
                await this.cleanupTemporaryFiles(config);
            }
            catch (cleanupError) {
                this.logger.warn(`Cleanup failed: ${String(cleanupError)}`);
            }
            return {
                success: false,
                message: `Restore failed: ${errorMessage}`,
                error: error instanceof Error ? error : new Error(errorMessage),
            };
        }
    }
    displayRestoreSummary(summary) {
        const executionTimeSeconds = (summary.executionTime / 1000).toFixed(1);
        const summaryMessage = `
## 🔄 iCredible Git Security - Restore Summary

### ✅ Restore Completed Successfully

**Repository Information:**
- **Repository:** ${github_1.context.repo.owner}/${github_1.context.repo.repo}
- **File Version ID:** \`${summary.fileVersionId}\`
- **Execution Time:** ${executionTimeSeconds}s

**Restore Details:**
- ✅ OTP verification completed
- ✅ Backup downloaded and decrypted
- ✅ Repository data extracted and restored
- ✅ Git history and branches restored
${summary.actionsWereSuspended ? '- ✅ GitHub Actions were safely suspended and resumed' : '- ℹ️ GitHub Actions remained active during restore'}

**Security:**
- ✅ Multi-factor authentication (OTP) verified
- ✅ AES-256-CBC decryption applied
- ✅ Repository integrity maintained

Your repository has been successfully restored from the encrypted backup.

⚠️ **Important:** All previous repository history has been overwritten with the restored backup.
`.trim();
        this.logger.notice(summaryMessage);
    }
    async cleanupTemporaryFiles(config) {
        const filesToClean = [
            config.files.sourceArchiveDir,
            config.files.tarArchiveFile,
            config.files.compressedArchiveFile,
        ];
        for (const file of filesToClean) {
            try {
                await fs_1.promises.rm(file, { recursive: true, force: true });
                this.logger.debug(`Cleaned up: ${file}`);
            }
            catch (error) {
                this.logger.debug(`Could not clean up ${file}: ${String(error)}`);
            }
        }
    }
}
exports.RestoreWorkflowService = RestoreWorkflowService;
//# sourceMappingURL=restore-workflow.service.js.map