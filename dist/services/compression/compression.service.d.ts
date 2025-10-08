import { BaseService } from "../base/base-service";
import { ICompressionService, ILogger } from "../base/interfaces";
export declare class CompressionService extends BaseService implements ICompressionService {
    constructor(logger: ILogger);
    protected onInitialize(): Promise<void>;
    createTarArchive(sourceDir: string, outputPath: string): Promise<number>;
    compressWithZstd(inputPath: string, outputPath: string): Promise<number>;
    private compressWithNativeZstd;
    private compressWithNodeZstd;
    decompressZstd(inputPath: string, outputPath: string): Promise<void>;
    private decompressWithNativeZstd;
    private decompressWithNodeZstd;
    compressWithGzip(inputPath: string, outputPath: string): Promise<number>;
    extractTarArchive(tarPath: string, extractDir: string): Promise<void>;
    getDirectorySize(dirPath: string): Promise<number>;
    private checkZstdAvailability;
    private loadZstdStreamModule;
}
//# sourceMappingURL=compression.service.d.ts.map