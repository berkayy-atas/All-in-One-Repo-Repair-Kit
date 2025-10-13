import { BaseService } from '../base/base-service';
import { ICompressionService, ILogger } from '../base/interfaces';
export declare class CompressionService extends BaseService implements ICompressionService {
    private zstdInstalled;
    constructor(logger: ILogger);
    protected onInitialize(): Promise<void>;
    private ensureZstdInstalled;
    createTarArchive(sourceDir: string, outputPath: string): Promise<number>;
    compressWithZstd(inputPath: string, outputPath: string): Promise<number>;
    decompressZstd(inputPath: string, outputPath: string): Promise<void>;
    extractTarArchive(tarPath: string, extractDir: string): Promise<void>;
    getDirectorySize(dirPath: string): Promise<number>;
}
//# sourceMappingURL=compression.service.d.ts.map