import { promises as fs } from 'fs';
import { context } from '@actions/github';
import { BaseService } from '../base/base-service';
import { 
  IBackupWorkflowService, 
  ILogger, 
  IConfigService, 
  ICryptoService, 
  ICompressionService, 
  IGitService, 
  IApiClient 
} from '../base/interfaces';
import { BackupResult } from '@/types/github';
import { BackupMetadata, FileUploadData } from '@/types/api';
import { exec } from '@actions/exec';

export class BackupWorkflowService extends BaseService implements IBackupWorkflowService {
  private configService: IConfigService;
  private cryptoService: ICryptoService;
  private compressionService: ICompressionService;
  private gitService: IGitService;
  private apiClient: IApiClient;

  constructor(
    logger: ILogger,
    configService: IConfigService,
    cryptoService: ICryptoService,
    compressionService: ICompressionService,
    gitService: IGitService,
    apiClient: IApiClient
  ) {
    super(logger);
    this.configService = configService;
    this.cryptoService = cryptoService;
    this.compressionService = compressionService;
    this.gitService = gitService;
    this.apiClient = apiClient;
  }

  protected async onInitialize(): Promise<void> {
    // Initialize all dependent services
    await this.configService.initialize();
    await this.cryptoService.initialize();
    await this.compressionService.initialize();
    await this.gitService.initialize();
    await this.apiClient.initialize();
  }

  public async execute(): Promise<BackupResult> {
    this.ensureInitialized();

    try {
      this.logger.info('Starting backup workflow');
      const config = this.configService.getConfig();
      const startTime = Date.now();

      // Step 1: Create mirror clone
      this.logger.info('Step 1: Creating repository mirror clone');
      await this.gitService.createMirrorClone('.', config.files.sourceArchiveDir);

      // Step 2: Get commit information
      this.logger.info('Step 2: Gathering commit information');
      const commitInfo = await this.gitService.getCurrentCommitInfo();

      // Step 3: Create tar archive
      this.logger.info('Step 3: Creating tar archive');
      const uncompressedSize = await this.compressionService.createTarArchive(
        config.files.sourceArchiveDir,
        config.files.tarArchiveFile
      );

      // Step 4: Compress with zstd
      this.logger.info('Step 4: Compressing archive with zstd');
      const compressedSize = await this.compressionService.compressWithZstd(
        config.files.tarArchiveFile,
        config.files.compressedArchiveFile
      );

      // Step 5: Encrypt the compressed archive
      this.logger.info('Step 5: Encrypting compressed archive');
      const encryptedBuffer = await this.encryptArchive(
      config.files.compressedArchiveFile,
      config.inputs.icredible_encryption_password
      );

      const encryptedFilePath = this.getEncryptedFileName(config.inputs.icredible_encryption_password);
      await fs.writeFile(encryptedFilePath, encryptedBuffer);
      const encryptedSize = encryptedBuffer.length;
      
      // this.logger.info(`${encryptedSize}`);
      // const aa = await exec('ls', ['-la']);
      // this.logger.info(`${aa}`);
      

      // Step 6: Authenticate with API
      this.logger.info('Step 6: Authenticating with iCredible API');
      const authResponse = await this.apiClient.authenticate(config.inputs.icredible_activation_code);

      // Step 7: Upload backup
      this.logger.info('Step 7: Uploading backup to iCredible');
      const uploadData = this.createUploadData(
        encryptedBuffer,
        encryptedFilePath,
        uncompressedSize,
        encryptedSize,
        commitInfo,
        config
      );
      this.logger.info(`${console.log(uploadData)}`);
      this.logger.info(`${console.log(authResponse.token)}`);


      const uploadResponse = await this.apiClient.uploadBackup(uploadData, authResponse.token);

      // Step 8: Display summary
      this.displayBackupSummary({
        recordId: uploadResponse.recordId,
        directoryRecordId: uploadResponse.directoryRecordId,
        fileSize: uncompressedSize,
        compressedSize,
        encryptedSize,
        commitInfo,
        executionTime: Date.now() - startTime,
      });

      // Clean up temporary files
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Backup workflow failed', error instanceof Error ? error : new Error(errorMessage));
      
      // Attempt cleanup on error
      try {
        const config = this.configService.getConfig();
        await this.cleanupTemporaryFiles(config);
      } catch (cleanupError) {
        this.logger.warn(`Cleanup failed: ${String(cleanupError)}`);
      }

      return {
        success: false,
        message: `Backup failed: ${errorMessage}`,
        error: error instanceof Error ? error : new Error(errorMessage),
      };
    }
  }

  private async encryptArchive(filePath: string, password: string): Promise<Buffer> {
    const fileBuffer = await fs.readFile(filePath);
    const hashedPassword = this.cryptoService.hashPassword(password);
    return await this.cryptoService.encrypt(fileBuffer, hashedPassword);
  }

  private getEncryptedFileName(password: string): string {
    const repoName = process.env.GITHUB_REPOSITORY?.split('/').pop() || 'repository';
    return `${repoName}.tar.zst.enc`;
  }

  private createUploadData(
    encryptedBuffer: Buffer,
    fileName: string,
    originalSize: number,
    encryptedSize: number,
    commitInfo: any,
    config: any
  ): FileUploadData {
    const metadata: BackupMetadata = {
      event: context.eventName,
      ref: context.ref,
      actor: context.actor,
      owner: context.repo.owner,
      ownerType: process.env.OWNER_TYPE || 'User',
      commit: commitInfo.hash,
      commitShort: commitInfo.shortHash,
      parents: commitInfo.parents,
      author: commitInfo.author,
      date: commitInfo.date,
      committer: commitInfo.author, // Using author as committer for simplicity
      message: commitInfo.message,
    };

    return {
      file: encryptedBuffer,
      size: originalSize,
      compressedFileSize: encryptedSize,
      attributes: config.upload.attributes,
      fileName: `${fileName}`,
      fullPath: `/${context.repo.owner}/${context.repo.repo}/${fileName}`,
      compressionEngine: config.upload.compressionEngine,
      compressionLevel: config.upload.compressionLevel,
      encryptionType: config.upload.encryptionType,
      revisionType: config.upload.revisionType,
      metadata,
    };
  }

  private displayBackupSummary(summary: {
    recordId: string;
    directoryRecordId: string;
    fileSize: number;
    compressedSize: number;
    encryptedSize: number;
    commitInfo: any;
    executionTime: number;
  }): void {
    const compressionRatio = ((summary.fileSize - summary.compressedSize) / summary.fileSize * 100).toFixed(1);
    const executionTimeSeconds = (summary.executionTime / 1000).toFixed(1);

    const summaryMessage = `
## 🛡️ iCredible Git Security - Backup Summary

### ✅ Backup Completed Successfully

**Repository Information:**
- **Repository:** ${context.repo.owner}/${context.repo.repo}
- **Branch:** ${context.ref}
- **Commit:** ${summary.commitInfo.shortHash}
- **Author:** ${summary.commitInfo.author}
- **Message:** ${summary.commitInfo.message}

**Backup Details:**
- **Record ID:** \`${summary.recordId}\`
- **Directory Record ID:** \`${summary.directoryRecordId}\`
- **Original Size:** ${this.formatBytes(summary.fileSize)}
- **Compressed Size:** ${this.formatBytes(summary.compressedSize)} (${compressionRatio}% compression)
- **Encrypted Size:** ${this.formatBytes(summary.encryptedSize)}
- **Execution Time:** ${executionTimeSeconds}s

**Security:**
- ✅ AES-256-CBC encryption applied
- ✅ PBKDF2 key derivation used
- ✅ Zstandard level 10 compression applied
- ✅ Secure backup uploaded to iCredible

Your repository has been securely backed up and is ready for restoration when needed.
`.trim();

    this.logger.notice(summaryMessage);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async cleanupTemporaryFiles(config: any): Promise<void> {
    const filesToClean = [
      config.files.sourceArchiveDir,
      config.files.tarArchiveFile,
      config.files.compressedArchiveFile,
      this.getEncryptedFileName(config.inputs.icredible_encryption_password),
    ];

    for (const file of filesToClean) {
      try {
        await fs.rm(file, { recursive: true, force: true });
        this.logger.debug(`Cleaned up: ${file}`);
      } catch (error) {
        this.logger.debug(`Could not clean up ${file}: ${String(error)}`);
      }
    }
  }
}