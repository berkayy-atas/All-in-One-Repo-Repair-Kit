// utils/backup.ts
import { context } from '@actions/github';
import { FileUploadData, BackupMetadata } from '@/types/api';

export class BackupUtils {

 static createUploadData(
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

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}