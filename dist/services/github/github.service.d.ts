import { BaseService } from '../base/base-service';
import { IGitHubService, ILogger } from '../base/interfaces';
import { GitHubActionsPermissions } from '@/types/github';
export declare class GitHubService extends BaseService implements IGitHubService {
    private octokit;
    private owner;
    private repo;
    private suspensionState;
    private actionsPermissionsFilePath;
    constructor(logger: ILogger, token: string, owner: string, repo: string, actionsPermissionsFilePath?: string);
    protected onInitialize(): Promise<void>;
    suspendActions(): Promise<void>;
    resumeActions(): Promise<void>;
    getActionsPermissions(): Promise<GitHubActionsPermissions>;
    setActionsPermissions(permissions: GitHubActionsPermissions): Promise<void>;
    areActionsEnabled(): Promise<boolean>;
    getRepositoryInfo(): Promise<any>;
}
//# sourceMappingURL=github.service.d.ts.map