import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { buildContext } from '../core/context-builder.js';

const API_BASE = process.env.LUNA_API_URL || 'https://api.lunaos.ai';

/**
 * Resolve cloud token from ~/.luna/credentials.yaml
 */
function getCloudToken(): string | null {
    try {
        const credPath = path.join(os.homedir(), '.luna', 'credentials.yaml');
        if (fs.existsSync(credPath)) {
            const creds = yaml.parse(fs.readFileSync(credPath, 'utf-8'));
            return creds?.cloud_token || null;
        }
    } catch { /* ignore */ }
    return null;
}

export const indexCommand = new Command('index')
    .alias('ix')
    .description('Index your project for RAG — agents will use your codebase as context')
    .addHelpText('after', `
Examples:
  luna index                              Index locally to .luna/index/
  luna index --cloud                      Upload index to LunaOS cloud
  luna index --dry-run --verbose           Preview all files without indexing
  luna index --dir ../other-project        Index a different directory
  luna index --max-files 100               Increase file cap
`)
    .option('--cloud', 'Upload index to LunaOS cloud (requires login)')
    .option('--dir <path>', 'Directory to index (defaults to current directory)')
    .option('-e, --extensions <exts...>', 'Additional file extensions to include')
    .option('--max-files <n>', 'Maximum files to index', '50')
    .option('--dry-run', 'Show what would be indexed without uploading')
    .option('--verbose', 'Show detailed output')
    .action(async (options) => {
        const startTime = Date.now();
        const cwd = options.dir ? path.resolve(options.dir) : process.cwd();
        const projectName = path.basename(cwd);
        const maxFiles = parseInt(options.maxFiles) || 50;

        console.log('');
        console.log(chalk.hex('#E8A317')('🌙 LunaOS Index'));
        console.log(chalk.dim(`  Scanning ${chalk.white(projectName)}...`));
        console.log('');

        // 1. Scan project files
        const spinner = ora({ text: 'Scanning project files...', color: 'yellow' }).start();

        let ctx;
        try {
            ctx = await buildContext(cwd);
        } catch (error: any) {
            spinner.fail(chalk.red(`Failed to scan project: ${error.message}`));
            process.exit(1);
        }

        if (ctx.files.length === 0) {
            spinner.fail(chalk.red('No source files found'));
            console.log(chalk.dim('  Make sure you\'re in a project directory with source code'));
            process.exit(1);
        }

        spinner.succeed(`Found ${chalk.white(ctx.files.length.toString())} source files`);

        // 2. Show project info
        console.log('');
        console.log(`  ${chalk.dim('Project:')}    ${chalk.white(ctx.projectName)}`);
        console.log(`  ${chalk.dim('Type:')}       ${chalk.white(ctx.projectType)}`);
        console.log(`  ${chalk.dim('Language:')}   ${chalk.white(ctx.language)}`);
        if (ctx.framework) {
            console.log(`  ${chalk.dim('Framework:')}  ${chalk.white(ctx.framework)}`);
        }
        console.log(`  ${chalk.dim('Files:')}      ${chalk.white(ctx.files.length.toString())}`);

        const totalSize = ctx.files.reduce((a, f) => a + f.size, 0);
        console.log(`  ${chalk.dim('Total size:')} ${chalk.white((totalSize / 1024).toFixed(1) + ' KB')}`);
        console.log('');

        // 3. Show file list (verbose or dry-run)
        if (options.verbose || options.dryRun) {
            console.log(chalk.dim('  Files to index:'));
            const filesToShow = ctx.files.slice(0, maxFiles);
            for (const file of filesToShow) {
                const ext = path.extname(file.path).slice(1);
                const sizeStr = (file.size / 1024).toFixed(1) + 'KB';
                console.log(`    ${chalk.green('•')} ${chalk.white(file.path)} ${chalk.dim(`(${sizeStr}, .${ext})`)}`);
            }
            if (ctx.files.length > maxFiles) {
                console.log(chalk.dim(`    ... and ${ctx.files.length - maxFiles} more (capped at ${maxFiles})`));
            }
            console.log('');
        }

        // 4. Dry run — stop here
        if (options.dryRun) {
            console.log(chalk.yellow('  ⚠️  Dry run — no files uploaded'));
            console.log(chalk.dim('  Remove --dry-run to upload to LunaOS cloud'));
            console.log('');
            return;
        }

        // 5. Upload to cloud
        if (options.cloud) {
            const token = getCloudToken();
            if (!token) {
                console.error(chalk.red('  ✗ No cloud token found'));
                console.error(chalk.dim('    Run: ') + chalk.cyan('luna init --cloud') + chalk.dim(' to configure'));
                console.error(chalk.dim('    Or login at: ') + chalk.cyan('https://agents.lunaos.ai'));
                process.exit(1);
            }

            const uploadSpinner = ora({ text: 'Uploading to LunaOS cloud...', color: 'cyan' }).start();

            // Prepare documents for RAG indexing
            const filesToUpload = ctx.files.slice(0, maxFiles);
            const documents = filesToUpload.map(f => ({
                id: `${projectName}/${f.path}`,
                title: path.basename(f.path),
                content: f.content,
                source: f.path,
                type: 'code' as const,
                metadata: {
                    project: projectName,
                    language: ctx.language,
                    framework: ctx.framework,
                    path: f.path,
                },
            }));

            try {
                const response = await fetch(`${API_BASE}/rag/index`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ documents }),
                });

                if (!response.ok) {
                    const err = await response.json() as any;
                    throw new Error(err.error || `HTTP ${response.status}`);
                }

                const result = await response.json() as any;

                uploadSpinner.succeed(chalk.green('Indexed to LunaOS cloud'));
                console.log('');
                console.log(`  ${chalk.dim('Processed:')}  ${chalk.white(result.processedDocuments?.toString() || filesToUpload.length.toString())} files`);
                if (result.failedDocuments > 0) {
                    console.log(`  ${chalk.dim('Failed:')}     ${chalk.yellow(result.failedDocuments.toString())} files`);
                }
                if (result.processingTime) {
                    console.log(`  ${chalk.dim('Time:')}       ${chalk.white((result.processingTime / 1000).toFixed(1) + 's')}`);
                }
            } catch (error: any) {
                uploadSpinner.fail(chalk.red(`Upload failed: ${error.message}`));
                process.exit(1);
            }
        } else {
            // Local indexing — store in .luna/index/
            const indexSpinner = ora({ text: 'Building local index...', color: 'cyan' }).start();

            const indexDir = path.join(cwd, '.luna', 'index');
            fs.mkdirSync(indexDir, { recursive: true });

            // Write file manifest
            const manifest = {
                project: projectName,
                type: ctx.projectType,
                language: ctx.language,
                framework: ctx.framework,
                indexedAt: new Date().toISOString(),
                fileCount: ctx.files.length,
                totalSize,
                files: ctx.files.map(f => ({
                    path: f.path,
                    size: f.size,
                    ext: path.extname(f.path),
                })),
            };

            fs.writeFileSync(
                path.join(indexDir, 'manifest.json'),
                JSON.stringify(manifest, null, 2),
                'utf-8'
            );

            // Write chunked content for agent context
            const chunks = ctx.files.slice(0, maxFiles).map(f => ({
                id: f.path,
                content: f.content,
                size: f.size,
            }));

            fs.writeFileSync(
                path.join(indexDir, 'chunks.json'),
                JSON.stringify(chunks),
                'utf-8'
            );

            indexSpinner.succeed(chalk.green('Local index built'));
            console.log('');
            console.log(`  ${chalk.dim('Indexed:')} ${chalk.white(ctx.files.length.toString())} files`);
            console.log(`  ${chalk.dim('Saved:')}   ${chalk.white('.luna/index/')}`);
            console.log('');
            console.log(chalk.dim('  Agents will use this index as context when running locally.'));
            console.log(chalk.dim('  To upload to cloud: ') + chalk.cyan('luna index --cloud'));
        }

        // 6. Summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('');
        console.log(chalk.dim(`  ⏱ Completed in ${duration}s`));
        console.log('');
    });
