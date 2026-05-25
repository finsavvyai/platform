#!/usr/bin/env node
/**
 * MCPOverflow CLI - Generate MCP servers from OpenAPI specifications
 *
 * Usage:
 *   mcpoverflow generate <spec-file> [options]
 *   mcpoverflow init
 *   mcpoverflow validate <spec-file>
 */

import { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { parseOpenAPI } from './parser.js'
import { generateMCPServer } from './generator.js'
import { verifyHardenedServer } from './verify.js'
import { VERSION, BANNER } from './constants.js'

const program = new Command()

console.log(chalk.cyan(BANNER))

program
  .name('mcpoverflow')
  .description('Generate MCP servers from OpenAPI specifications')
  .version(VERSION)

// Generate command
program
  .command('generate <spec>')
  .alias('gen')
  .alias('g')
  .description('Generate an MCP server from an OpenAPI spec')
  .option('-o, --output <dir>', 'Output directory', './mcp-server')
  .option('-n, --name <name>', 'Server name (defaults to spec title)')
  .option('--no-install', 'Skip npm install after generation')
  .option('--stdio', 'Generate stdio transport (default)')
  .option('--http', 'Generate HTTP transport')
  .option('--filter <patterns>', 'Comma-separated patterns to exclude paths')
  .option('--hardened', 'Emit signed manifest, frozen tool list, declared egress')
  .option('--publisher <name>', 'Publisher identity baked into the signed manifest')
  .action(async (specPath: string, options) => {
    const spinner = ora('Reading OpenAPI specification...').start()

    try {
      // Read spec file
      let specContent: string
      if (!existsSync(specPath)) {
        // Try as URL
        if (specPath.startsWith('http')) {
          spinner.text = 'Fetching OpenAPI specification from URL...'
          const res = await fetch(specPath)
          if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
          specContent = await res.text()
        } else {
          throw new Error(`File not found: ${specPath}`)
        }
      } else {
        specContent = await readFile(specPath, 'utf-8')
      }

      spinner.text = 'Parsing OpenAPI specification...'
      const parsed = await parseOpenAPI(specContent)

      if (parsed.errors.length > 0) {
        spinner.fail('Failed to parse specification')
        parsed.errors.forEach(e => console.error(chalk.red(`  ✗ ${e.message}`)))
        process.exit(1)
      }

      spinner.text = `Found ${parsed.endpoints.length} endpoints, generating MCP server...`

      // Apply filters
      let endpoints = parsed.endpoints
      if (options.filter) {
        const patterns = options.filter.split(',').map((p: string) => p.trim())
        endpoints = endpoints.filter(e => !patterns.some((p: string) => e.path.includes(p)))
      }

      // Generate server
      const serverName = options.name || parsed.metadata.title || 'mcp-server'
      const outputDir = path.resolve(options.output)

      const result = await generateMCPServer({
        name: serverName,
        version: parsed.metadata.version || '1.0.0',
        description: parsed.metadata.description || '',
        endpoints,
        schemas: parsed.schemas,
        outputDir,
        transport: options.http ? 'http' : 'stdio',
        hardened: Boolean(options.hardened),
        publisher: options.publisher ? { name: options.publisher } : undefined,
        servers: parsed.metadata.servers,
      })

      spinner.succeed(
        `Generated ${options.hardened ? 'HARDENED ' : ''}MCP server in ${chalk.green(outputDir)}`
      )

      console.log('')
      console.log(chalk.bold('📦 Generated files:'))
      result.files.forEach(f => console.log(`   ${chalk.gray('•')} ${f}`))

      console.log('')
      console.log(chalk.bold('🚀 Next steps:'))
      console.log(`   ${chalk.cyan('cd')} ${options.output}`)
      if (options.install !== false) {
        console.log(`   ${chalk.cyan('npm install')}`)
      }
      console.log(`   ${chalk.cyan('npm run build')}`)
      console.log(`   ${chalk.cyan('npm start')}`)

      console.log('')
      console.log(chalk.bold('📖 Add to Claude Desktop config:'))
      console.log(
        chalk.gray(`   {
     "mcpServers": {
       "${serverName}": {
         "command": "node",
         "args": ["${outputDir}/dist/index.js"]
       }
     }
   }`)
      )
    } catch (error) {
      spinner.fail('Generation failed')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Validate command
program
  .command('validate <spec>')
  .alias('v')
  .description('Validate an OpenAPI specification')
  .action(async (specPath: string) => {
    const spinner = ora('Validating specification...').start()

    try {
      const specContent = await readFile(specPath, 'utf-8')
      const parsed = await parseOpenAPI(specContent)

      if (parsed.errors.length > 0) {
        spinner.fail('Validation failed')
        parsed.errors.forEach(e => console.error(chalk.red(`  ✗ ${e.message}`)))
        process.exit(1)
      }

      spinner.succeed('Specification is valid')
      console.log('')
      console.log(chalk.bold('📊 Summary:'))
      console.log(`   ${chalk.gray('Title:')} ${parsed.metadata.title}`)
      console.log(`   ${chalk.gray('Version:')} ${parsed.metadata.version}`)
      console.log(`   ${chalk.gray('Endpoints:')} ${parsed.endpoints.length}`)
      console.log(`   ${chalk.gray('Schemas:')} ${parsed.schemas.length}`)

      if (parsed.warnings.length > 0) {
        console.log('')
        console.log(chalk.yellow('⚠ Warnings:'))
        parsed.warnings.forEach(w => console.log(`   ${chalk.yellow('•')} ${w.message}`))
      }
    } catch (error) {
      spinner.fail('Validation failed')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Verify command (hardened mode)
program
  .command('verify <dir>')
  .description('Verify a hardened MCP server: signature + frozen tool list hashes')
  .action(async (dir: string) => {
    const spinner = ora('Verifying hardened server...').start()
    try {
      const report = await verifyHardenedServer(path.resolve(dir))
      if (report.ok) {
        spinner.succeed(chalk.green('Verification passed'))
      } else {
        spinner.fail(chalk.red('Verification FAILED'))
      }
      for (const c of report.checks) {
        const mark = c.ok ? chalk.green('OK') : chalk.red('FAIL')
        const detail = c.detail ? chalk.gray(`  ${c.detail}`) : ''
        console.log(`  ${mark}  ${c.name}${detail}`)
      }
      if (!report.ok) process.exit(1)
    } catch (error) {
      spinner.fail('Verification errored')
      console.error(chalk.red((error as Error).message))
      process.exit(1)
    }
  })

// Browse command — generate MCP from a website browse skill (browsing-skills integration)
program
  .command('browse')
  .description('Generate a browse-mode MCP server from a built-in site skill or a target URL')
  .option(
    '--site <id>',
    'Built-in skill id: generic-web-page, reddit, x, linkedin, amazon, booking, airbnb'
  )
  .option('--from-url <url>', 'Generate a draft skill from a website URL (site-generator)')
  .option('-o, --output <dir>', 'Output directory', './browse-mcp')
  .option('--hardened', 'Emit signed manifest, frozen tool list, declared egress')
  .option('--publisher <name>', 'Publisher identity baked into the signed manifest')
  .action(async options => {
    interface WebSkillsModule {
      defaultRegistry: { get(id: string): unknown }
      generateSkillFromSite(args: { url: string }): unknown
      generateFromSkill(
        skill: unknown,
        opts: { hardened: boolean }
      ): { files: Array<{ path: string; contents: string }>; toolNames: string[]; egress: string[] }
      signSkill(args: { skill: unknown; publisher: { name: string } }): {
        manifest: unknown
        privateKey: string
        publicKey: string
      }
      skillToToolDefinitions(skill: unknown): unknown[]
    }
    const spinner = ora('Loading web-skills...').start()
    try {
      const ws = (await import('@mcpoverflow/web-skills' as string)) as unknown as WebSkillsModule
      let skill = options.site ? ws.defaultRegistry.get(options.site) : undefined
      if (!skill && options.fromUrl) {
        spinner.text = `Generating draft skill from ${options.fromUrl}...`
        skill = ws.generateSkillFromSite({ url: options.fromUrl })
      }
      if (!skill) {
        spinner.fail('Provide --site <id> or --from-url <url>')
        process.exit(1)
        return
      }

      spinner.text = 'Rendering browse MCP server...'
      const result = ws.generateFromSkill(skill, { hardened: !!options.hardened })

      const fs = await import('fs/promises')
      await fs.mkdir(options.output, { recursive: true })
      for (const f of result.files) {
        const target = path.join(options.output, f.path)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, f.contents)
      }

      if (options.hardened) {
        spinner.text = 'Signing manifest...'
        const { signSkill, skillToToolDefinitions } = ws
        const signed = signSkill({
          skill,
          publisher: { name: options.publisher ?? 'mcpoverflow' },
        })
        const tools = skillToToolDefinitions(skill)
        await fs.writeFile(
          path.join(options.output, 'manifest.json'),
          JSON.stringify(signed.manifest, null, 2)
        )
        await fs.writeFile(
          path.join(options.output, 'mcp-manifest.json'),
          JSON.stringify(signed.manifest, null, 2)
        )
        await fs.writeFile(path.join(options.output, 'tools.json'), JSON.stringify(tools, null, 2))
        await fs.writeFile(path.join(options.output, '.signing-key.pem'), signed.privateKey)
      }

      spinner.succeed(
        `Browse MCP generated at ${options.output} (${result.toolNames.length} tools, egress: ${result.egress.join(', ') || 'none'})`
      )
    } catch (error) {
      spinner.fail((error as Error).message)
      process.exit(1)
    }
  })

// Init command
program
  .command('init')
  .description('Initialize a new MCP server project')
  .option('-n, --name <name>', 'Project name', 'my-mcp-server')
  .action(async () => {
    console.log(chalk.bold('🔧 Initializing new MCP server project...'))
    console.log('')
    console.log('This command creates a blank MCP server template.')
    console.log('For generating from OpenAPI, use: ' + chalk.cyan('mcpoverflow generate <spec>'))
  })

program.parse()
