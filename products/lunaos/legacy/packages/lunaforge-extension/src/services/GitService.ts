import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitCommit {
    id: string;
    commitId: string;
    hash: string;
    message: string;
    author: string;
    timestamp: string;
    diffSummary?: string;
}

export class GitService {
    constructor(private workspaceRoot: string) { }

    /**
     * Get recent commits for the workspace
     */
    async getRecentCommits(limit = 20): Promise<GitCommit[]> {
        try {
            // Try using CLI as a reliable fallback
            const { stdout } = await execAsync(
                `git log -n ${limit} --pretty=format:"%H|%s|%an|%at"`,
                { cwd: this.workspaceRoot }
            );

            return stdout.split('\n').filter(Boolean).map(line => {
                const [hash, message, author, timestamp] = line.split('|');
                return {
                    id: hash,
                    commitId: hash,
                    hash,
                    message,
                    author,
                    timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                    diffSummary: ''
                };
            });
        } catch (error) {
            console.error('GitService: Failed to get commits', error);
            return [];
        }
    }

    /**
     * Get history for a specific file
     */
    async getFileHistory(filePath: string, limit = 10): Promise<GitCommit[]> {
        try {
            const { stdout } = await execAsync(
                `git log -n ${limit} --pretty=format:"%H|%s|%an|%at" -- "${filePath}"`,
                { cwd: this.workspaceRoot }
            );

            return stdout.split('\n').filter(Boolean).map(line => {
                const [hash, message, author, timestamp] = line.split('|');
                return {
                    id: hash,
                    commitId: hash,
                    hash,
                    message,
                    author,
                    timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                    diffSummary: ''
                };
            });
        } catch (error) {
            console.error(`GitService: Failed to get history for ${filePath}`, error);
            return [];
        }
    }
}
