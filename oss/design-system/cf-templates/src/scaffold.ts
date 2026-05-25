import { getApiTemplate } from './templates/api';
import { getWebhookTemplate } from './templates/webhook';
import { getCronTemplate } from './templates/cron';

export type TemplateType = 'api' | 'webhook' | 'cron';

export interface ScaffoldOptions {
  template: TemplateType;
  name: string;
  outputDir: string;
}

export async function scaffoldProject(
  options: ScaffoldOptions,
): Promise<{ success: boolean; message: string; files: string[] }> {
  const { template, name, outputDir } = options;

  let templateCode = '';
  const files: string[] = [];

  switch (template) {
    case 'api':
      templateCode = getApiTemplate();
      files.push(`${outputDir}/src/index.ts`);
      break;
    case 'webhook':
      templateCode = getWebhookTemplate();
      files.push(`${outputDir}/src/webhooks.ts`);
      break;
    case 'cron':
      templateCode = getCronTemplate();
      files.push(`${outputDir}/src/cron.ts`);
      break;
    default:
      return {
        success: false,
        message: `Unknown template: ${template}`,
        files: [],
      };
  }

  files.push(
    `${outputDir}/package.json`,
    `${outputDir}/wrangler.toml`,
    `${outputDir}/tsconfig.json`,
    `${outputDir}/.gitignore`,
  );

  return {
    success: true,
    message: `Scaffolded ${template} project: ${name}`,
    files,
  };
}
