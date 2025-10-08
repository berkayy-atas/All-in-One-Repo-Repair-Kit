import { createReadStream, createWriteStream, promises as fs } from "fs";
import { join } from "path";
import * as tar from "tar";
import { pipeline } from "stream/promises";
import { BaseService } from "../base/base-service";
import { ICompressionService, ILogger } from "../base/interfaces";
import { spawn } from "child_process";
import { createGzip, createGunzip } from "zlib";

export class CompressionService
  extends BaseService
  implements ICompressionService
{
  constructor(logger: ILogger) {
    super(logger);
  }

  protected async onInitialize(): Promise<void> {
    // Check if zstd command is available
    try {
      await this.checkZstdAvailability();
    } catch (error) {
      this.logger.warn("Zstd command not available, falling back to gzip");
    }
  }

  public async createTarArchive(
    sourceDir: string,
    outputPath: string
  ): Promise<number> {
    this.ensureInitialized();

    try {
      this.logger.info(
        `Creating tar archive from ${sourceDir} to ${outputPath}`
      );

      const sourceStat = await fs.stat(sourceDir);
      if (!sourceStat.isDirectory()) {
        throw new Error(`Source path ${sourceDir} is not a directory`);
      }

      await tar.create(
        {
          file: outputPath,
          cwd: process.cwd(),
          gzip: false,
          portable: true,
        },
        [sourceDir]
      );

      const stat = await fs.stat(outputPath);
      const fileSize = stat.size;

      this.logger.info(
        `Tar archive created successfully. Size: ${fileSize} bytes`
      );
      return fileSize;
    } catch (error) {
      this.handleError(error, "Failed to create tar archive");
    }
  }

  public async compressWithZstd(
    inputPath: string,
    outputPath: string
  ): Promise<number> {
    this.ensureInitialized();

    try {
      // Try native zstd first, fallback to Node.js implementation
      try {
        return await this.compressWithNativeZstd(inputPath, outputPath);
      } catch (nativeError) {
        this.logger.warn(
          "Native zstd failed, falling back to Node.js implementation"
        );
        return await this.compressWithNodeZstd(inputPath, outputPath);
      }
    } catch (error) {
      this.handleError(error, "Failed to compress with zstd");
    }
  }

  private async compressWithNativeZstd(
    inputPath: string,
    outputPath: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const zstd = spawn("zstd", ["-T0", "-10", "-o", outputPath, inputPath]);

      let stderr = "";

      zstd.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      zstd.on("close", async (code) => {
        if (code === 0) {
          try {
            const stat = await fs.stat(outputPath);
            this.logger.info(
              `Native zstd compression completed. Size: ${stat.size} bytes`
            );
            resolve(stat.size);
          } catch (statError) {
            reject(statError);
          }
        } else {
          reject(new Error(`zstd command failed with code ${code}: ${stderr}`));
        }
      });

      zstd.on("error", (error) => {
        reject(new Error(`zstd command not available: ${error.message}`));
      });
    });
  }

  private async compressWithNodeZstd(
    inputPath: string,
    outputPath: string
  ): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const { createZstdCompress } = await this.loadZstdStreamModule();

        const readStream = createReadStream(inputPath);
        const writeStream = createWriteStream(outputPath);
        const compressStream = createZstdCompress({ level: 10 });

        let compressedSize = 0;

        writeStream.on("finish", async () => {
          try {
            const stat = await fs.stat(outputPath);
            this.logger.info(
              `Node.js zstd compression completed. Size: ${stat.size} bytes`
            );
            resolve(stat.size);
          } catch (statError) {
            reject(statError);
          }
        });

        writeStream.on("error", reject);
        compressStream.on("error", reject);

        // Pipe with error handling
        await pipeline(readStream, compressStream, writeStream);
      } catch (error) {
        reject(error);
      }
    });
  }

  public async decompressZstd(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      // Try native zstd first
      try {
        await this.decompressWithNativeZstd(inputPath, outputPath);
        return;
      } catch (nativeError) {
        this.logger.warn(
          "Native zstd decompression failed, falling back to Node.js implementation"
        );
        await this.decompressWithNodeZstd(inputPath, outputPath);
      }
    } catch (error) {
      this.handleError(error, "Failed to decompress with zstd");
    }
  }

  private async decompressWithNativeZstd(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const zstd = spawn("zstd", ["-d", inputPath, "-o", outputPath]);

      let stderr = "";

      zstd.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      zstd.on("close", (code) => {
        if (code === 0) {
          this.logger.info("Native zstd decompression completed");
          resolve();
        } else {
          reject(
            new Error(`zstd decompression failed with code ${code}: ${stderr}`)
          );
        }
      });

      zstd.on("error", (error) => {
        reject(new Error(`zstd command not available: ${error.message}`));
      });
    });
  }

  private async decompressWithNodeZstd(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const { createZstdDecompress } = await this.loadZstdStreamModule();

        const readStream = createReadStream(inputPath);
        const writeStream = createWriteStream(outputPath);
        const decompressStream = createZstdDecompress();

        writeStream.on("finish", () => {
          this.logger.info("Node.js zstd decompression completed");
          resolve();
        });

        writeStream.on("error", reject);
        decompressStream.on("error", reject);

        await pipeline(readStream, decompressStream, writeStream);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Fallback to gzip if zstd fails completely
  public async compressWithGzip(
    inputPath: string,
    outputPath: string
  ): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const readStream = createReadStream(inputPath);
        const writeStream = createWriteStream(outputPath);
        const gzipStream = createGzip({ level: 9 });

        writeStream.on("finish", async () => {
          try {
            const stat = await fs.stat(outputPath);
            this.logger.info(
              `Gzip compression completed. Size: ${stat.size} bytes`
            );
            resolve(stat.size);
          } catch (statError) {
            reject(statError);
          }
        });

        writeStream.on("error", reject);
        gzipStream.on("error", reject);

        await pipeline(readStream, gzipStream, writeStream);
      } catch (error) {
        reject(error);
      }
    });
  }

  public async extractTarArchive(
    tarPath: string,
    extractDir: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Extracting tar archive ${tarPath} to ${extractDir}`);

      await fs.mkdir(extractDir, { recursive: true });

      await tar.extract({
        file: tarPath,
        cwd: extractDir,
        strip: 0,
      });

      this.logger.info(`Tar archive extracted successfully`);
    } catch (error) {
      this.handleError(error, "Failed to extract tar archive");
    }
  }

  // Utility method to get directory size
  public async getDirectorySize(dirPath: string): Promise<number> {
    this.ensureInitialized();

    try {
      const stat = await fs.stat(dirPath);
      if (stat.isFile()) {
        return stat.size;
      }

      if (stat.isDirectory()) {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;

        for (const file of files) {
          const filePath = join(dirPath, file);
          totalSize += await this.getDirectorySize(filePath);
        }

        return totalSize;
      }

      return 0;
    } catch (error) {
      this.logger.warn(`Could not get size for ${dirPath}: ${String(error)}`);
      return 0;
    }
  }

  private async checkZstdAvailability(): Promise<void> {
    return new Promise((resolve, reject) => {
      const zstd = spawn("zstd", ["--version"]);

      zstd.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error("zstd command not available"));
        }
      });

      zstd.on("error", () => {
        reject(new Error("zstd command not available"));
      });
    });
  }

  private async loadZstdStreamModule(): Promise<any> {
    try {
      // Try to load zstd-wasm for better streaming support
      const zstd = await import("zstd-wasm");
      return zstd;
    } catch (error) {
      // Fallback to simple zstd-codec with streaming wrapper
      const { ZstdCodec } = require("zstd-codec");

      return new Promise((resolve, reject) => {
        ZstdCodec.run((zstd: any) => {
          const simple = new zstd.Simple();

          // Create stream-compatible wrapper
          const streamWrapper = {
            createZstdCompress: (options: any) => {
              const level = options?.level || 3;
              const transform = new (require("stream").Transform)({
                transform(chunk: any) {
                  try {
                    const compressed = simple.compress(chunk, level);
                    this.push(compressed);
                  } catch (error) {
                    this.logger.error(error);
                  }
                },
              });
              return transform;
            },
            createZstdDecompress: () => {
              const transform = new (require("stream").Transform)({
                transform(chunk: any) {
                  try {
                    const decompressed = simple.decompress(chunk);
                    this.push(decompressed);
                  } catch (error) {
                    this.logger.error(error);
                  }
                },
              });
              return transform;
            },
          };

          resolve(streamWrapper);
        });
      });
    }
  }
}
