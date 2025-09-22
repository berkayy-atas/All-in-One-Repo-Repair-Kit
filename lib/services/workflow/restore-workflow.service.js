"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestoreWorkflowService = void 0;
const core = __importStar(require("@actions/core"));
const fs_1 = require("fs");
const github_1 = require("@actions/github");
const base_service_1 = require("../base/base-service");
const github_service_1 = require("../github/github.service");
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
        let activeGitHubService = this.githubService;
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
            const compressedBuffer = await this.decryptBackup(encryptedBuffer, config.inputs.icredible_encryption_password);
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
                const patToken = config.inputs.icredible_repository_restore_token;
                if (!patToken) {
                    throw new Error('PAT token was expected but not found.');
                }
                this.logger.info('Creating a dedicated GitHubService instance with PAT token.');
                activeGitHubService = new github_service_1.GitHubService(this.logger, patToken, github_1.context.repo.owner, github_1.context.repo.repo, this.configService);
                await activeGitHubService.initialize();
            }
            else {
                this.logger.info('Step 8b: Filtering workflow directory (default token)');
                await this.gitService.filterWorkflowDirectory(config.files.sourceArchiveDir);
            }
            if (config.inputs.suspend_actions && activeGitHubService && hasPatToken) {
                this.logger.info('Step 9: Suspending GitHub Actions');
                await activeGitHubService.suspendActions();
                actionsWereSuspended = true;
            }
            this.logger.info('Step 10: Configuring git and pushing to repository');
            await this.configureAndPush(config, hasPatToken);
            if (actionsWereSuspended && activeGitHubService) {
                this.logger.info('Step 11: Resuming GitHub Actions');
                await activeGitHubService.resumeActions();
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
    async decryptBackup(encryptedBuffer, password) {
        const hashedPassword = this.cryptoService.hashPassword(password);
        return await this.cryptoService.decrypt(encryptedBuffer, hashedPassword);
    }
    async configureAndPush(config, hasPatToken) {
        const repoPath = config.files.sourceArchiveDir;
        await this.gitService.configureGit(config.git.userName, config.git.userEmail);
        const token = hasPatToken
            ? config.inputs.icredible_repository_restore_token
            : core.getInput('github-token', { required: true });
        if (!token) {
            throw new Error('No GitHub token available for pushing');
        }
        const remoteUrl = `https://x-access-token:${token}@github.com/${github_1.context.repo.owner}/${github_1.context.repo.repo}.git`;
        if (hasPatToken) {
            await this.gitService.pushAllBranches(repoPath);
        }
        else {
            await this.gitService.pushMirror(repoPath, remoteUrl);
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