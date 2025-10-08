import { promises as fs } from "fs";
import { join } from "path";
import * as tar from "tar";
import { BaseService } from "../base/base-service";
import { ICompressionService, ILogger } from "../base/interfaces";
import { exec } from "@actions/exec";

export class CompressionService
  extends BaseService
  implements ICompressionService
{
  private zstdInstalled: boolean = false;

  constructor(logger: ILogger) {
    super(logger);
  }

  protected async onInitialize(): Promise<void> {
    try {
      // Check if tar is available
      if (typeof tar.create !== "function") {
        throw new Error("Tar create function not available");
      }

      // Install zstd if not already installed
      await this.ensureZstdInstalled();
    } catch (error) {
      throw new Error(
        "Failed to initialize compression service: " + String(error)
      );
    }
  }

  private async ensureZstdInstalled(): Promise<void> {
    if (this.zstdInstalled) {
      return;
    }

    try {
      // Check if zstd is already available
      const checkResult = await exec("zstd", ["--version"], {
        ignoreReturnCode: true,
        silent: true,
      });

      if (checkResult === 0) {
        this.logger.info("zstd is already available in the system");
        this.zstdInstalled = true;
        return;
      }
    } catch {
      // zstd not found, need to install
    }

    try {
      this.logger.info("Installing zstd...");

      // Try to install zstd using apt-get (for Ubuntu runners)
      try {
        await exec("sudo", ["apt-get", "update"], { silent: true });
        await exec("sudo", ["apt-get", "install", "-y", "zstd"], {
          silent: true,
        });
        this.logger.info("zstd installed successfully via apt-get");
        this.zstdInstalled = true;
        return;
      } catch {
        // If apt-get fails, try other methods
      }

      // Fallback: Try npm install (though this typically installs bindings, not CLI)
      try {
        await exec("npm", ["install", "-g", "zstd"], { silent: true });
        this.logger.info("zstd installed successfully via npm");
        this.zstdInstalled = true;
        return;
      } catch {
        // npm install failed
      }

      // Final check if zstd is available
      const finalCheck = await exec("zstd", ["--version"], {
        ignoreReturnCode: true,
        silent: true,
      });

      if (finalCheck !== 0) {
        throw new Error("Failed to install zstd");
      }

      this.zstdInstalled = true;
    } catch (error) {
      throw new Error("Failed to ensure zstd installation: " + String(error));
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

      // Verify source directory exists
      const sourceStat = await fs.stat(sourceDir);
      if (!sourceStat.isDirectory()) {
        throw new Error(`Source path ${sourceDir} is not a directory`);
      }

      // Create tar archive
      await tar.create(
        {
          file: outputPath,
          cwd: process.cwd(),
          gzip: false,
          portable: true,
        },
        [sourceDir]
      );

      // Get file size
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
      this.logger.info(`Compressing ${inputPath} with zstd to ${outputPath}`);

      // Ensure zstd is installed
      await this.ensureZstdInstalled();

      // Get input file size for logging
      const inputStat = await fs.stat(inputPath);
      const inputSize = inputStat.size;
      this.logger.info(`Input file size: ${inputSize} bytes`);

      // Use zstd CLI with streaming compression
      // -10 is a good balance between compression ratio and speed
      // -T0 uses all available CPU cores
      // --long enables long distance matching for better compression
      const args = [
        "-10", // Compression level (1-19, default is 3)
        "-T0", // Use all CPU cores
        "--long", // Enable long distance matching
        "-f", // Force overwrite output
        inputPath, // Input file
        "-o", // Output flag
        outputPath, // Output file
      ];

      // If file is larger than 100MB, use more aggressive settings
      if (inputSize > 100 * 1024 * 1024) {
        this.logger.info("Large file detected, using optimized settings");
        args[0] = "-12"; // Higher compression for large files
      }

      const exitCode = await exec("zstd", args);

      if (exitCode !== 0) {
        throw new Error(`zstd compression failed with exit code ${exitCode}`);
      }

      // Get compressed file size
      const compressedStat = await fs.stat(outputPath);
      const compressedSize = compressedStat.size;

      const compressionRatio = ((1 - compressedSize / inputSize) * 100).toFixed(
        2
      );
      this.logger.info(
        `Zstd compression completed. Compressed size: ${compressedSize} bytes (${compressionRatio}% reduction)`
      );

      return compressedSize;
    } catch (error) {
      this.handleError(error, "Failed to compress with zstd");
    }
  }

  public async decompressZstd(
    inputPath: string,
    outputPath: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Decompressing ${inputPath} with zstd to ${outputPath}`);

      // Ensure zstd is installed
      await this.ensureZstdInstalled();

      // Use zstd CLI for decompression
      const args = [
        "-d", // Decompress flag
        "-f", // Force overwrite
        inputPath, // Input file
        "-o", // Output flag
        outputPath, // Output file
      ];

      const exitCode = await exec("zstd", args);

      if (exitCode !== 0) {
        throw new Error(`zstd decompression failed with exit code ${exitCode}`);
      }

      this.logger.info(`Zstd decompression completed`);
    } catch (error) {
      this.handleError(error, "Failed to decompress with zstd");
    }
  }

  public async extractTarArchive(
    tarPath: string,
    extractDir: string
  ): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Extracting tar archive ${tarPath} to ${extractDir}`);

      // Ensure extract directory exists
      await fs.mkdir(extractDir, { recursive: true });

      // Extract tar archive
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

  // Stream-based compression for large files
  public async compressStreamWithZstd(
    inputPath: string,
    outputPath: string
  ): Promise<number> {
    this.ensureInitialized();

    try {
      this.logger.info(
        `Stream compressing ${inputPath} with zstd to ${outputPath}`
      );

      // The main compressWithZstd method now uses streaming via CLI
      return await this.compressWithZstd(inputPath, outputPath);
    } catch (error) {
      this.handleError(error, "Failed to stream compress with zstd");
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

  // Alternative compression method using streaming with pipes (if needed)
  public async compressWithZstdAlternative(
    inputPath: string,
    outputPath: string,
    compressionLevel: number = 10
  ): Promise<number> {
    this.ensureInitialized();

    try {
      this.logger.info(
        `Alternative compression: ${inputPath} to ${outputPath}`
      );

      // Ensure zstd is installed
      await this.ensureZstdInstalled();

      // Use shell redirection for maximum memory efficiency
      const command = `zstd -${compressionLevel} -T0 --long -c "${inputPath}" > "${outputPath}"`;

      const exitCode = await exec("sh", ["-c", command]);

      if (exitCode !== 0) {
        throw new Error(
          `Alternative zstd compression failed with exit code ${exitCode}`
        );
      }

      const stat = await fs.stat(outputPath);
      return stat.size;
    } catch (error) {
      // Fallback to regular method
      this.logger.warn("Alternative compression failed, using regular method");
      return await this.compressWithZstd(inputPath, outputPath);
    }
  }
}
