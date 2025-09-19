import { exec } from '@actions/exec';
import { BaseService } from '../base/base-service';
import { IGitService, ILogger } from '../base/interfaces';
import { CommitInfo } from '@/types/github';

export class GitService extends BaseService implements IGitService {
  constructor(logger: ILogger) {
    super(logger);
  }

  protected async onInitialize(): Promise<void> {
    // Verify git is available
    try {
      await exec('git', ['--version'], { silent: true });
    } catch (error) {
      throw new Error('Git is not available in the environment');
    }
  }

  public async createMirrorClone(sourceDir: string, targetDir: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Creating mirror clone from ${sourceDir} to ${targetDir}`);
      
      await exec('git', ['clone', '--mirror', sourceDir, targetDir]);
      
      this.logger.info('Mirror clone created successfully');
    } catch (error) {
      this.handleError(error, 'Failed to create mirror clone');
    }
  }

  public async getCurrentCommitInfo(): Promise<CommitInfo> {
    this.ensureInitialized();

    try {
      let output = '';
      let errorOutput = '';

      // Check if we have any commits
      const exitCode = await exec('git', ['rev-parse', '--verify', 'HEAD'], {
        silent: true,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
          stderr: (data: Buffer) => {
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

      // Get detailed commit information
      output = '';
      await exec('git', ['log', '-1', '--pretty=%H|%h|%P|%an <%ae>|%ad|%cn|%s%n%b'], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      const lines = output.trim().split('\n');
      const commitLine = lines[0];
      const messageLine = lines.slice(1).join('\n').trim();

      const [hash, shortHash, parents, author, date, committer, subject] = commitLine.split('|');

      const commitInfo: CommitInfo = {
        hash: hash || '',
        shortHash: shortHash || '',
        author: author || '',
        date: date || '',
        message: subject ? `${subject}${messageLine ? `\n${messageLine}` : ''}` : '',
        parents: parents || '',
      };

      this.logger.debug(`Retrieved commit info: ${commitInfo.shortHash}`);
      return commitInfo;
    } catch (error) {
      this.handleError(error, 'Failed to get current commit info');
    }
  }

  public async configureGit(userName: string, userEmail: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Configuring git user: ${userName} <${userEmail}>`);
      
      await exec('git', ['config', 'user.name', userName]);
      await exec('git', ['config', 'user.email', userEmail]);
      
      this.logger.info('Git user configuration completed');
    } catch (error) {
      this.handleError(error, 'Failed to configure git user');
    }
  }

  public async setRemoteUrl(repoPath: string, remoteUrl: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info(`Setting remote URL to: ${remoteUrl.replace(/:[^:@]*@/, ':***@')}`);
      
      await exec('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: repoPath });
      
      this.logger.info('Remote URL updated successfully');
    } catch (error) {
      this.handleError(error, 'Failed to set remote URL');
    }
  }

  public async pushMirror(repoPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info('Pushing mirror to remote repository');
      
      await exec('git', ['push', '--mirror', 'origin'], { cwd: repoPath });
      
      this.logger.info('Mirror push completed successfully');
    } catch (error) {
      this.handleError(error, 'Failed to push mirror');
    }
  }

  public async pushAllBranches(repoPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info('Pushing all branches to remote repository');
      
      // Push all branches
      await exec('git', ['push', '--all', 'origin', '--force'], { cwd: repoPath });
      
      // Push all tags
      await exec('git', ['push', '--tags', 'origin', '--force'], { cwd: repoPath });
      
      this.logger.info('All branches and tags pushed successfully');
    } catch (error) {
      this.handleError(error, 'Failed to push all branches');
    }
  }

  public async syncRemoteBranches(repoPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info('Syncing remote branches as local branches');
      
      let output = '';
      await exec('git', ['branch', '-r'], {
        cwd: repoPath,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      const remoteBranches = output
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.includes('->')) // Skip HEAD symbolic refs
        .map(line => line.replace(/^origin\//, '')); // Remove origin/ prefix

      for (const branch of remoteBranches) {
        if (branch === 'HEAD') continue;
        
        try {
          this.logger.debug(`Creating local branch: ${branch}`);
          await exec('git', ['branch', branch, `origin/${branch}`], { 
            cwd: repoPath,
            ignoreReturnCode: true, // Branch might already exist
          });
        } catch (error) {
          this.logger.warn(`Could not create local branch ${branch}: ${String(error)}`);
        }
      }
      
      this.logger.info('Remote branch sync completed');
    } catch (error) {
      this.handleError(error, 'Failed to sync remote branches');
    }
  }

  public async filterWorkflowDirectory(repoPath: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.logger.info('Filtering out .github/workflows directory from repository history');
      
      // Use git filter-branch to remove .github/workflows directory
      // This is equivalent to the git-filter-repo functionality
      await exec('git', [
        'filter-branch',
        '--force',
        '--index-filter',
        'git rm -rf --cached --ignore-unmatch .github/workflows',
        '--prune-empty',
        '--tag-name-filter',
        'cat',
        '--',
        '--all'
      ], { cwd: repoPath });
      
      this.logger.info('Workflow directory filtering completed');
    } catch (error) {
      // If filter-branch fails, try alternative approach
      this.logger.warn('filter-branch failed, trying alternative approach');
      
      try {
        // Alternative: Just remove the directory and commit
        await exec('git', ['rm', '-rf', '.github/workflows'], { 
          cwd: repoPath,
          ignoreReturnCode: true, // Directory might not exist
        });
        
        this.logger.info('Workflow directory removed from working tree');
      } catch (altError) {
        this.logger.warn('Could not remove workflows directory, continuing without filtering');
      }
    }
  }

  // Utility method to check if repository has commits
  public async hasCommits(repoPath?: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const exitCode = await exec('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: repoPath,
        silent: true,
        ignoreReturnCode: true,
      });
      
      return exitCode === 0;
    } catch (error) {
      return false;
    }
  }

  // Utility method to get current branch name
  public async getCurrentBranch(repoPath?: string): Promise<string> {
    this.ensureInitialized();

    try {
      let output = '';
      await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: repoPath,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      return output.trim();
    } catch (error) {
      this.handleError(error, 'Failed to get current branch');
    }
  }
}