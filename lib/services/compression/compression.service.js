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
exports.CompressionService = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const tar = __importStar(require("tar"));
const base_service_1 = require("../base/base-service");
class CompressionService extends base_service_1.BaseService {
    constructor(logger) {
        super(logger);
    }
    async onInitialize() {
        try {
            if (typeof tar.create !== 'function') {
                throw new Error('Tar create function not available');
            }
        }
        catch (error) {
            throw new Error('Tar functionality not available');
        }
    }
    async createTarArchive(sourceDir, outputPath) {
        this.ensureInitialized();
        try {
            this.logger.info(`Creating tar archive from ${sourceDir} to ${outputPath}`);
            const sourceStat = await fs_1.promises.stat(sourceDir);
            if (!sourceStat.isDirectory()) {
                throw new Error(`Source path ${sourceDir} is not a directory`);
            }
            await tar.create({
                file: outputPath,
                cwd: process.cwd(),
                gzip: false,
                portable: true,
            }, [sourceDir]);
            const stat = await fs_1.promises.stat(outputPath);
            const fileSize = stat.size;
            this.logger.info(`Tar archive created successfully. Size: ${fileSize} bytes`);
            return fileSize;
        }
        catch (error) {
            this.handleError(error, 'Failed to create tar archive');
        }
    }
    async compressWithZstd(inputPath, outputPath) {
        this.ensureInitialized();
        try {
            this.logger.info(`Compressing ${inputPath} with zstd to ${outputPath}`);
            const zstd = await this.loadZstdModule();
            const inputBuffer = await fs_1.promises.readFile(inputPath);
            const compressedBuffer = zstd.compress(inputBuffer, 10);
            await fs_1.promises.writeFile(outputPath, compressedBuffer);
            const compressedSize = compressedBuffer.length;
            this.logger.info(`Zstd compression completed. Compressed size: ${compressedSize} bytes`);
            return compressedSize;
        }
        catch (error) {
            this.handleError(error, 'Failed to compress with zstd');
        }
    }
    async decompressZstd(inputPath, outputPath) {
        this.ensureInitialized();
        try {
            this.logger.info(`Decompressing ${inputPath} with zstd to ${outputPath}`);
            const zstd = await this.loadZstdModule();
            const compressedBuffer = await fs_1.promises.readFile(inputPath);
            const decompressedBuffer = zstd.decompress(compressedBuffer);
            await fs_1.promises.writeFile(outputPath, decompressedBuffer);
            this.logger.info(`Zstd decompression completed`);
        }
        catch (error) {
            this.handleError(error, 'Failed to decompress with zstd');
        }
    }
    async extractTarArchive(tarPath, extractDir) {
        this.ensureInitialized();
        try {
            this.logger.info(`Extracting tar archive ${tarPath} to ${extractDir}`);
            await fs_1.promises.mkdir(extractDir, { recursive: true });
            await tar.extract({
                file: tarPath,
                cwd: extractDir,
                strip: 0,
            });
            this.logger.info(`Tar archive extracted successfully`);
        }
        catch (error) {
            this.handleError(error, 'Failed to extract tar archive');
        }
    }
    async compressStreamWithZstd(inputPath, outputPath) {
        this.ensureInitialized();
        try {
            this.logger.info(`Stream compressing ${inputPath} with zstd to ${outputPath}`);
            return await this.compressWithZstd(inputPath, outputPath);
        }
        catch (error) {
            this.handleError(error, 'Failed to stream compress with zstd');
        }
    }
    async getDirectorySize(dirPath) {
        this.ensureInitialized();
        try {
            const stat = await fs_1.promises.stat(dirPath);
            if (stat.isFile()) {
                return stat.size;
            }
            if (stat.isDirectory()) {
                const files = await fs_1.promises.readdir(dirPath);
                let totalSize = 0;
                for (const file of files) {
                    const filePath = (0, path_1.join)(dirPath, file);
                    totalSize += await this.getDirectorySize(filePath);
                }
                return totalSize;
            }
            return 0;
        }
        catch (error) {
            this.logger.warn(`Could not get size for ${dirPath}: ${String(error)}`);
            return 0;
        }
    }
    async loadZstdModule() {
        try {
            const zstd = await Promise.resolve().then(() => __importStar(require('zstd-codec')));
            return zstd;
        }
        catch (error) {
            throw new Error('zstd-codec module not available. Please install it with: npm install zstd-codec');
        }
    }
}
exports.CompressionService = CompressionService;
//# sourceMappingURL=compression.service.js.map