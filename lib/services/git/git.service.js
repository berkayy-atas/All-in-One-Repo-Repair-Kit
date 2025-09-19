"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const exec_1 = require("@actions/exec");
const base_service_1 = require("../base/base-service");
class GitService extends base_service_1.BaseService {
    constructor(logger) {
        super(logger);
    }
    async onInitialize() {
        try {
            await (0, exec_1.exec)('git', ['--version'], { silent: true });
        }
        catch (error) {
            throw new Error('Git is not available in the environment');
        }
    }
    async createMirrorClone(sourceDir, targetDir) {
        this.ensureInitialized();
        try {
            this.logger.info(`Creating mirror clone from ${sourceDir} to ${targetDir}`);
            await (0, exec_1.exec)('git', ['clone', '--mirror', sourceDir, targetDir]);
            this.logger.info('Mirror clone created successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to create mirror clone');
        }
    }
    async getCurrentCommitInfo() {
        this.ensureInitialized();
        try {
            let output = '';
            let errorOutput = '';
            const exitCode = await (0, exec_1.exec)('git', ['rev-parse', '--verify', 'HEAD'], {
                silent: true,
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                    stderr: (data) => {
                        errorOutput += data.toString();
                    },
                },
            });
            if (exitCode !== 0) {
                this.logger.warn('No commits found in repository');
                return {
                    hash: '',
                    shortHash: '',
                    author: '',
                    date: '',
                    message: '',
                    parents: '',
                };
            }
            output = '';
            await (0, exec_1.exec)('git', ['log', '-1', '--pretty=%H|%h|%P|%an <%ae>|%ad|%cn|%s%n%b'], {
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                },
            });
            const lines = output.trim().split('\n');
            const commitLine = lines[0];
            const messageLine = lines.slice(1).join('\n').trim();
            const [hash, shortHash, parents, author, date, committer, subject] = commitLine.split('|');
            const commitInfo = {
                hash: hash || '',
                shortHash: shortHash || '',
                author: author || '',
                date: date || '',
                message: subject ? `${subject}${messageLine ? `\n${messageLine}` : ''}` : '',
                parents: parents || '',
            };
            this.logger.debug(`Retrieved commit info: ${commitInfo.shortHash}`);
            return commitInfo;
        }
        catch (error) {
            this.handleError(error, 'Failed to get current commit info');
        }
    }
    async configureGit(userName, userEmail) {
        this.ensureInitialized();
        try {
            this.logger.info(`Configuring git user: ${userName} <${userEmail}>`);
            await (0, exec_1.exec)('git', ['config', 'user.name', userName]);
            await (0, exec_1.exec)('git', ['config', 'user.email', userEmail]);
            this.logger.info('Git user configuration completed');
        }
        catch (error) {
            this.handleError(error, 'Failed to configure git user');
        }
    }
    async setRemoteUrl(repoPath, remoteUrl) {
        this.ensureInitialized();
        try {
            this.logger.info(`Setting remote URL to: ${remoteUrl.replace(/:[^:@]*@/, ':***@')}`);
            await (0, exec_1.exec)('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: repoPath });
            this.logger.info('Remote URL updated successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to set remote URL');
        }
    }
    async pushMirror(repoPath) {
        this.ensureInitialized();
        try {
            this.logger.info('Pushing mirror to remote repository');
            await (0, exec_1.exec)('git', ['push', '--mirror', 'origin'], { cwd: repoPath });
            this.logger.info('Mirror push completed successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to push mirror');
        }
    }
    async pushAllBranches(repoPath) {
        this.ensureInitialized();
        try {
            this.logger.info('Pushing all branches to remote repository');
            await (0, exec_1.exec)('git', ['push', '--all', 'origin', '--force'], { cwd: repoPath });
            await (0, exec_1.exec)('git', ['push', '--tags', 'origin', '--force'], { cwd: repoPath });
            this.logger.info('All branches and tags pushed successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to push all branches');
        }
    }
    async syncRemoteBranches(repoPath) {
        this.ensureInitialized();
        try {
            this.logger.info('Syncing remote branches as local branches');
            let output = '';
            await (0, exec_1.exec)('git', ['branch', '-r'], {
                cwd: repoPath,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                },
            });
            const remoteBranches = output
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.includes('->'))
                .map(line => line.replace(/^origin\//, ''));
            for (const branch of remoteBranches) {
                if (branch === 'HEAD')
                    continue;
                try {
                    this.logger.debug(`Creating local branch: ${branch}`);
                    await (0, exec_1.exec)('git', ['branch', branch, `origin/${branch}`], {
                        cwd: repoPath,
                        ignoreReturnCode: true,
                    });
                }
                catch (error) {
                    this.logger.warn(`Could not create local branch ${branch}: ${String(error)}`);
                }
            }
            this.logger.info('Remote branch sync completed');
        }
        catch (error) {
            this.handleError(error, 'Failed to sync remote branches');
        }
    }
    async filterWorkflowDirectory(repoPath) {
        this.ensureInitialized();
        try {
            this.logger.info('Filtering out .github/workflows directory from repository history');
            await (0, exec_1.exec)('git', [
                'filter-branch',
                '--force',
                '--path .github/workflows',
                '--invert-paths'
            ], { cwd: repoPath });
            this.logger.info('Workflow directory filtering completed');
        }
        catch (error) {
            this.logger.warn('filter-branch failed, trying alternative approach');
            try {
                await (0, exec_1.exec)('git', ['rm', '-rf', '.github/workflows'], {
                    cwd: repoPath,
                    ignoreReturnCode: true,
                });
                this.logger.info('The repository will be restored without the ./.github/workflow directory. If you want to restore this directory, you can find the relevant steps at the following link: https://github.com/marketplace/actions/icredible-git-security#-personal-access-token-pat-setup-guide-for-repository-restore');
            }
            catch (altError) {
                this.logger.warn('Could not remove workflows directory, continuing without filtering');
            }
        }
    }
    async hasCommits(repoPath) {
        this.ensureInitialized();
        try {
            const exitCode = await (0, exec_1.exec)('git', ['rev-parse', '--verify', 'HEAD'], {
                cwd: repoPath,
                silent: true,
                ignoreReturnCode: true,
            });
            return exitCode === 0;
        }
        catch (error) {
            return false;
        }
    }
    async getCurrentBranch(repoPath) {
        this.ensureInitialized();
        try {
            let output = '';
            await (0, exec_1.exec)('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
                cwd: repoPath,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    },
                },
            });
            return output.trim();
        }
        catch (error) {
            this.handleError(error, 'Failed to get current branch');
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=git.service.js.map