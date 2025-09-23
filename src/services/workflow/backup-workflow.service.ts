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
import { AuthTokenResponse, BackupMetadata, FileUploadData } from '@/types/api';
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
      const authResponse : AuthTokenResponse = await this.apiClient.authenticate(config.inputs.icredible_activation_code);

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
        commitInfo,
        mgmtBaseUrl: config.api.managementBaseUrl,
        endpointId: authResponse.endpointId,
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
    commitInfo: any;
    mgmtBaseUrl: string;
    endpointId: number;
  }): void {

    let uploadMetadata = '';
    if (summary.commitInfo && summary.commitInfo.hash) {
      // Base64 encode'a gerek yok çünkü doğrudan string olarak kullanıyoruz
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
    ## 🛡️ iCredible Git Security - Backup Summary

    ✅ **Backup completed successfully!**
    --------------------------------------------------
    **Git Metadata**
    Repository: ${process.env.GITHUB_REPOSITORY}
    - Owner: ${context.repo.owner} [${process.env.OWNER_TYPE || 'User'}]
    - Event: ${context.eventName}
    - Ref:   ${context.ref}
    - Actor: ${context.actor}
    ${uploadMetadata}
    --------------------------------------------------
    **API Response**
    - File version id: ${summary.recordId}
    - You can access the backed-up file from this link: ${summary.mgmtBaseUrl}/dashboard/file-management/${summary.endpointId}/${summary.directoryRecordId}
    `.trim();

    // GitHub notice formatı için özel karakterleri encode et
    let message = summaryMessage.replace(/%/g, '%25');
    message = message.replace(/\n/g, '%0A');
    message = message.replace(/\r/g, '%0D');

    this.logger.notice(message);
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