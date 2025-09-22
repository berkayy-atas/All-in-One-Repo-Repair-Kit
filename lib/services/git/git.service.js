"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const exec_1 = require("@actions/exec");
const base_service_1 = require("../base/base-service");
class GitService extends base_service_1.BaseService {
    isFilterRepoAvailable = false;
    constructor(logger) {
        super(logger);
    }
    async onInitialize() {
        try {
            await (0, exec_1.exec)('git', ['--version'], { silent: true });
            await this.setupGitFilterRepo();
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
    async pushMirror(repoPath, remoteUrl) {
        this.ensureInitialized();
        try {
            this.logger.info('Pushing mirror to remote repository (used for default token)');
            await (0, exec_1.exec)('git', ['push', '--mirror', '--force', remoteUrl], { cwd: repoPath });
            this.logger.info('Mirror push completed successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to push mirror');
        }
    }
    async pushAllBranches(repoPath, remoteUrl) {
        this.ensureInitialized();
        try {
            this.logger.info('Pushing all branches and tags individually to remote repository (used for PAT token)');
            let branchOutput = '';
            await (0, exec_1.exec)('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'], {
                cwd: repoPath,
                listeners: { stdout: (data) => { branchOutput += data.toString(); } },
            });
            const branches = branchOutput.split('\n').filter(b => b);
            for (const branch of branches) {
                this.logger.info(`Pushing branch: ${branch}`);
                await (0, exec_1.exec)('git', ['push', remoteUrl, branch, '--force'], { cwd: repoPath });
            }
            this.logger.info('Pushing all tags...');
            await (0, exec_1.exec)('git', ['push', remoteUrl, '--tags', '--force'], { cwd: repoPath });
            this.logger.info('All branches and tags pushed successfully');
        }
        catch (error) {
            this.handleError(error, 'Failed to push all branches and tags');
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
    async setupGitFilterRepo() {
        try {
            this.logger.info('Checking for Python and attempting to install git-filter-repo via pip...');
            await (0, exec_1.exec)('python3', ['--version'], { silent: true });
            await (0, exec_1.exec)('pip3', ['--version'], { silent: true });
            await (0, exec_1.exec)('pip3', ['install', 'git-filter-repo']);
            this.isFilterRepoAvailable = true;
            this.logger.info('git-filter-repo installed successfully and is ready to use.');
        }
        catch (error) {
            this.logger.warn(`Could not install git-filter-repo via pip: ${String(error)}. Falling back to git-filter-branch.`);
            this.isFilterRepoAvailable = false;
        }
    }
    async filterWorkflowDirectory(repoPath) {
        this.ensureInitialized();
        if (this.isFilterRepoAvailable) {
            try {
                this.logger.info('Filtering out .github/workflows directory using git-filter-repo...');
                await (0, exec_1.exec)('git', [
                    'filter-repo',
                    '--force',
                    '--path',
                    '.github/workflows',
                    '--invert-paths',
                ], {
                    cwd: repoPath
                });
                this.logger.info('Workflow directory filtering completed with git-filter-repo.');
                return;
            }
            catch (error) {
                this.logger.warn(`git-filter-repo failed: ${String(error)}. Falling back to git-filter-branch.`);
            }
        }
        this.logger.info('Filtering out .github/workflows directory using git-filter-branch (fallback)...');
        try {
            const command = 'git rm -rf --cached --ignore-unmatch .github/workflows';
            const env = { ...process.env, FILTER_BRANCH_SQUELCH_WARNING: '1' };
            await (0, exec_1.exec)('git', [
                'filter-branch', '--force', '--index-filter', command,
                '--prune-empty', '--tag-name-filter', 'cat', '--', '--all'
            ], {
                cwd: repoPath,
                env: env
            });
            this.logger.info('Workflow directory filtering completed with git-filter-branch.');
        }
        catch (error) {
            this.handleError(error, 'Failed to filter workflow directory from repository history. This is a critical step.');
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