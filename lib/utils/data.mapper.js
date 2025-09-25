"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataMapper = void 0;
const github_1 = require("@actions/github");
class DataMapper {
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
}
exports.DataMapper = DataMapper;
//# sourceMappingURL=data.mapper.js.map