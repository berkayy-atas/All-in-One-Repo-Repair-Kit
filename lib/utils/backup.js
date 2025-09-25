"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupUtils = void 0;
const github_1 = require("@actions/github");
class BackupUtils {
    static createUploadData(encryptedBuffer, fileName, originalSize, encryptedSize, commitInfo, config) {
        const metadata = {
            event: github_1.context.eventName,
            ref: github_1.context.ref,
            actor: github_1.context.actor,
            owner: github_1.context.repo.owner,
            ownerType: process.env.OWNER_TYPE || 'User',
            commit: commitInfo.hash,
            commitShort: commitInfo.shortHash,
            parents: commitInfo.parents,
            author: commitInfo.author,
            date: commitInfo.date,
            committer: commitInfo.author,
            message: commitInfo.message,
        };
        return {
            file: encryptedBuffer,
            size: originalSize,
            compressedFileSize: encryptedSize,
            attributes: config.upload.attributes,
            fileName: `${fileName}`,
            fullPath: `/${github_1.context.repo.owner}/${github_1.context.repo.repo}/${fileName}`,
            compressionEngine: config.upload.compressionEngine,
            compressionLevel: config.upload.compressionLevel,
            encryptionType: config.upload.encryptionType,
            revisionType: config.upload.revisionType,
            metadata,
        };
    }
    static formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
exports.BackupUtils = BackupUtils;
//# sourceMappingURL=backup.js.map