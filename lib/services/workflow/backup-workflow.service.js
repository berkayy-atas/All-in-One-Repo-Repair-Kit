"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupWorkflowService = void 0;
const fs_1 = require("fs");
const github_1 = require("@actions/github");
const base_service_1 = require("../base/base-service");
const backup_1 = require("@/utils/backup");
class BackupWorkflowService extends base_service_1.BaseService {
    configService;
    cryptoService;
    compressionService;
    gitService;
    apiClient;
    constructor(logger, configService, cryptoService, compressionService, gitService, apiClient) {
        super(logger);
        this.configService = configService;
        this.cryptoService = cryptoService;
        this.compressionService = compressionService;
        this.gitService = gitService;
        this.apiClient = apiClient;
    }
    async onInitialize() {
        await this.configService.initialize();
        await this.cryptoService.initialize();
        await this.compressionService.initialize();
        await this.gitService.initialize();
        await this.apiClient.initialize();
    }
    async execute() {
        this.ensureInitialized();
        try {
            this.logger.info('Starting backup workflow');
            const config = this.configService.getConfig();
            const startTime = Date.now();
            this.logger.info('Step 1: Creating repository mirror clone');
            await this.gitService.createMirrorClone('.', config.files.sourceArchiveDir);
            this.logger.info('Step 2: Gathering commit information');
            const commitInfo = await this.gitService.getCurrentCommitInfo();
            this.logger.info('Step 3: Creating tar archive');
            const uncompressedSize = await this.compressionService.createTarArchive(config.files.sourceArchiveDir, config.files.tarArchiveFile);
            this.logger.info('Step 4: Compressing archive with zstd');
            const compressedSize = await this.compressionService.compressWithZstd(config.files.tarArchiveFile, config.files.compressedArchiveFile);
            this.logger.info('Step 5: Encrypting compressed archive');
            const encryptedBuffer = await this.cryptoService.encryptArchive(config.files.compressedArchiveFile, config.inputs.icredible_encryption_password);
            const encryptedFilePath = this.cryptoService.getEncryptedFileName(config.inputs.icredible_encryption_password);
            await fs_1.promises.writeFile(encryptedFilePath, encryptedBuffer);
            const encryptedSize = encryptedBuffer.length;
            this.logger.info('Step 6: Authenticating with iCredible API');
            const authResponse = await this.apiClient.authenticate(config.inputs.icredible_activation_code);
            this.logger.info('Step 7: Uploading backup to iCredible');
            const uploadData = backup_1.BackupUtils.createUploadData(encryptedBuffer, encryptedFilePath, uncompressedSize, encryptedSize, commitInfo, config);
            this.logger.info(`${console.log(uploadData)}`);
            this.logger.info(`${console.log(authResponse.token)}`);
            const uploadResponse = await this.apiClient.uploadBackup(uploadData, authResponse.token);
            this.displayBackupSummary({
                recordId: uploadResponse.recordId,
                directoryRecordId: uploadResponse.directoryRecordId,
                commitInfo,
                mgmtBaseUrl: config.api.managementBaseUrl,
                endpointId: authResponse.endpointId,
            });
            await this.cleanupTemporaryFiles(config);
            this.logger.info('Backup workflow completed successfully');
            return {
                success: true,
                message: 'Backup completed successfully',
                recordId: uploadResponse.recordId,
                directoryRecordId: uploadResponse.directoryRecordId,
                fileSize: uncompressedSize,
                compressedSize,
                encryptedSize,
                commitInfo,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Backup workflow failed', error instanceof Error ? error : new Error(errorMessage));
            try {
                const config = this.configService.getConfig();
                await this.cleanupTemporaryFiles(config);
            }
            catch (cleanupError) {
                this.logger.warn(`Cleanup failed: ${String(cleanupError)}`);
            }
            return {
                success: false,
                message: `Backup failed: ${errorMessage}`,
                error: error instanceof Error ? error : new Error(errorMessage),
            };
        }
    }
    displayBackupSummary(summary) {
        let uploadMetadata = '';
        if (summary.commitInfo && summary.commitInfo.hash) {
            const message = summary.commitInfo.message || '';
            uploadMetadata = `
--------------------------------------------------
**Upload Metadata**
- Commit:      ${summary.commitInfo.hash}
- CommitShort: ${summary.commitInfo.shortHash}
- Author:      ${summary.commitInfo.author}
- Date:        ${summary.commitInfo.date}
- Committer:   ${summary.commitInfo.committer || 'GitHub'}
- Message:     ${message}
`.trim();
        }
        const summaryMessage = `
'🛡️ iCredible Git Security - Backup Summary'

✅ **Backup completed successfully!**
--------------------------------------------------
**Git Metadata**
Repository: ${process.env.GITHUB_REPOSITORY}
- Owner: ${github_1.context.repo.owner} [${process.env.OWNER_TYPE || 'User'}]
- Event: ${github_1.context.eventName}
- Ref:   ${github_1.context.ref}
- Actor: ${github_1.context.actor}
${uploadMetadata}
--------------------------------------------------
**API Response**
- File version id: ${summary.recordId}
- You can access the backed-up file from this link: ${summary.mgmtBaseUrl}/dashboard/file-management/${summary.endpointId}/${summary.directoryRecordId}
`.trim();
        this.logger.notice(summaryMessage);
    }
    async cleanupTemporaryFiles(config) {
        const filesToClean = [
            config.files.sourceArchiveDir,
            config.files.tarArchiveFile,
            config.files.compressedArchiveFile,
            this.cryptoService.getEncryptedFileName(config.inputs.icredible_encryption_password),
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
exports.BackupWorkflowService = BackupWorkflowService;
//# sourceMappingURL=backup-workflow.service.js.map