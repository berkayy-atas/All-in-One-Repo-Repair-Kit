"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const github_1 = require("@actions/github");
const fs_1 = require("fs");
const base_service_1 = require("../base/base-service");
class GitHubService extends base_service_1.BaseService {
    octokit = null;
    owner;
    repo;
    suspensionState = null;
    actionsPermissionsFilePath;
    configService;
    constructor(logger, token, owner, repo, configService, actionsPermissionsFilePath = '/tmp/actions_permissions.json') {
        super(logger);
        this.configService = configService;
        this.owner = owner;
        this.repo = repo;
        this.actionsPermissionsFilePath = actionsPermissionsFilePath;
        if (token) {
            this.octokit = (0, github_1.getOctokit)(token);
        }
    }
    async onInitialize() {
        if (!this.octokit) {
            this.logger.warn('No GitHub token provided - GitHub Actions suspension/resumption will not be available');
        }
    }
    async suspendActions() {
        this.ensureInitialized();
        if (!this.octokit) {
            throw new Error('GitHub token not available for Actions management');
        }
        try {
            this.logger.info('Suspending GitHub Actions for repository');
            const currentPermissions = await this.getActionsPermissions();
            this.suspensionState = {
                originalPermissions: currentPermissions,
                suspendedAt: new Date().toISOString(),
                actionsPermissionsFilePath: this.actionsPermissionsFilePath,
            };
            await fs_1.promises.writeFile(this.actionsPermissionsFilePath, JSON.stringify(this.suspensionState, null, 2));
            await this.setActionsPermissions({ enabled: false });
            this.logger.info('GitHub Actions suspended successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to suspend GitHub Actions');
        }
    }
    async resumeActions() {
        this.ensureInitialized();
        if (!this.octokit) {
            this.logger.warn('GitHub token not available - cannot resume Actions');
            return;
        }
        try {
            this.logger.info('Resuming GitHub Actions for repository');
            let suspensionState = this.suspensionState;
            if (!suspensionState) {
                try {
                    const stateData = await fs_1.promises.readFile(this.actionsPermissionsFilePath, 'utf-8');
                    suspensionState = JSON.parse(stateData);
                }
                catch (error) {
                    this.logger.warn('Could not load suspension state from file, using default permissions');
                }
            }
            if (suspensionState?.originalPermissions) {
                await this.setActionsPermissions(suspensionState.originalPermissions);
            }
            else {
                await this.setActionsPermissions({ enabled: true });
            }
            try {
                await fs_1.promises.unlink(this.actionsPermissionsFilePath);
            }
            catch (error) {
                this.logger.debug('Could not remove actions permissions file (it may not exist)');
            }
            this.suspensionState = null;
            this.logger.info('GitHub Actions resumed successfully');
        }
        catch (error) {
            this.logger.error('Failed to resume GitHub Actions', error instanceof Error ? error : new Error(String(error)));
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    this.logger.info(`Retry attempt ${attempt} to resume GitHub Actions`);
                    await this.setActionsPermissions({ enabled: true });
                    this.logger.info('GitHub Actions resumed on retry');
                    return;
                }
                catch (retryError) {
                    this.logger.warn(`Retry ${attempt} failed: ${String(retryError)}`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            this.logger.error('All retry attempts failed - GitHub Actions may remain disabled');
        }
    }
    async getActionsPermissions() {
        this.ensureInitialized();
        if (!this.octokit) {
            throw new Error('GitHub token not available');
        }
        try {
            const response = await this.octokit.rest.actions.getGithubActionsPermissionsRepository({
                owner: this.owner,
                repo: this.repo,
            });
            return {
                enabled: response.data.enabled,
                allowed_actions: response.data.allowed_actions,
                selected_actions_url: response.data.selected_actions_url,
            };
        }
        catch (error) {
            this.handleError(error, 'Failed to get GitHub Actions permissions');
        }
    }
    async setActionsPermissions(permissions) {
        this.ensureInitialized();
        if (!this.octokit) {
            throw new Error('GitHub token not available');
        }
        try {
            await this.octokit.rest.actions.setGithubActionsPermissionsRepository({
                owner: this.owner,
                repo: this.repo,
                enabled: permissions.enabled,
                allowed_actions: permissions.allowed_actions,
            });
            this.logger.debug(`GitHub Actions permissions updated: enabled=${permissions.enabled}`);
        }
        catch (error) {
            this.handleError(error, 'Failed to set GitHub Actions permissions');
        }
    }
    async areActionsEnabled() {
        try {
            const permissions = await this.getActionsPermissions();
            return permissions.enabled;
        }
        catch (error) {
            this.logger.warn(`Could not check Actions status: ${String(error)}`);
            return true;
        }
    }
    async getRepositoryInfo() {
        this.ensureInitialized();
        if (!this.octokit) {
            throw new Error('GitHub token not available');
        }
        try {
            const response = await this.octokit.rest.repos.get({
                owner: this.owner,
                repo: this.repo,
            });
            return response.data;
        }
        catch (error) {
            this.handleError(error, 'Failed to get repository information');
        }
    }
    async getRepositoryActivationDetails() {
        this.ensureInitialized();
        const config = this.configService.getConfig();
        if (!this.octokit) {
            throw new Error('GitHub token not available to get repository details');
        }
        try {
            this.logger.info('Fetching repository details for activation...');
            const repoInfo = await this.getRepositoryInfo();
            const uniqueId = repoInfo.id.toString();
            const getOperatingSystem = () => {
                const runnerOS = process.env.RUNNER_OS || 'Linux';
                switch (runnerOS) {
                    case 'Linux': return 'Linux';
                    case 'Windows': return 'Windows';
                    case 'macOS': return 'MacOS';
                    default:
                        this.logger.warn(`Unexpected operating system: ‘${runnerOS}’. ‘Linux’ is assumed.`);
                        return 'Linux';
                }
            };
            const details = {
                uniqueId: uniqueId,
                ip: process.env.RUNNER_IP || '127.0.0.1',
                operatingSystem: getOperatingSystem(),
                endpointType: config.endpoint.endpointType,
                endpointName: this.repo,
            };
            this.logger.info('Successfully fetched repository activation details.');
            return details;
        }
        catch (error) {
            this.handleError(error, 'Failed to get repository activation details');
        }
    }
}
exports.GitHubService = GitHubService;
//# sourceMappingURL=github.service.js.map