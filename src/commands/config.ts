import prompts from 'prompts';
import type { Command } from 'commander';
import { getGlobalConfigPath, maskConfig, resolveConfig } from '../config/load.js';
import {
  getByPath,
  getMaskedStoredConfig,
  resetGlobalConfig,
  setGlobalConfigValue,
} from '../config/store.js';
import { createLogger } from '../core/logger.js';
import { printJson } from '../utils/json.js';
import { maskSecret } from '../utils/redact.js';

interface ConfigOptions {
  json?: boolean;
}

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Manage shipit configuration');

  config
    .option('--json', 'output JSON')
    .action(async (options: ConfigOptions) => {
      await configInteractive(process.cwd(), options);
    });

  config
    .command('list')
    .description('List resolved configuration')
    .option('--json', 'output JSON')
    .action(async (options: ConfigOptions) => {
      await configList(process.cwd(), options);
    });

  config
    .command('get')
    .description('Get a config value')
    .argument('<key>', 'dot path')
    .option('--json', 'output JSON')
    .action(async (key: string, options: ConfigOptions) => {
      await configGet(process.cwd(), key, options);
    });

  config
    .command('set')
    .description('Set a global config value')
    .argument('<key>', 'dot path')
    .argument('<value>', 'value')
    .option('--json', 'output JSON')
    .action(async (key: string, value: string, options: ConfigOptions) => {
      await configSet(key, value, options);
    });

  config
    .command('reset')
    .description('Reset global configuration')
    .option('--json', 'output JSON')
    .action(async (options: ConfigOptions) => {
      await configReset(options);
    });
}

export async function configInteractive(cwd: string, options: ConfigOptions = {}) {
  const logger = createLogger({ json: options.json });
  const resolved = await resolveConfig(cwd);
  const response = await prompts([
    {
      type: 'password',
      name: 'apiKey',
      message: 'OpenRouter API key',
      initial: resolved.openrouter.apiKey,
    },
    {
      type: 'text',
      name: 'model',
      message: 'Default model',
      initial: resolved.openrouter.model,
    },
    {
      type: 'select',
      name: 'style',
      message: 'Default commit style',
      initial: ['conventional', 'simple', 'detailed', 'emoji'].indexOf(resolved.commit.style),
      choices: [
        { title: 'conventional', value: 'conventional' },
        { title: 'simple', value: 'simple' },
        { title: 'detailed', value: 'detailed' },
        { title: 'emoji', value: 'emoji' },
      ],
    },
    {
      type: 'text',
      name: 'base',
      message: 'Default PR base branch',
      initial: resolved.pr.base,
    },
    {
      type: 'confirm',
      name: 'useGithubCli',
      message: 'Use GitHub CLI for PRs?',
      initial: resolved.pr.useGithubCli,
    },
  ]);

  if (response.apiKey) await setGlobalConfigValue('openrouter.apiKey', response.apiKey);
  if (response.model) await setGlobalConfigValue('openrouter.model', response.model);
  if (response.style) await setGlobalConfigValue('commit.style', response.style);
  if (response.base) await setGlobalConfigValue('pr.base', response.base);
  if (typeof response.useGithubCli === 'boolean') await setGlobalConfigValue('pr.useGithubCli', response.useGithubCli);

  const output = { success: true, path: getGlobalConfigPath(), config: await getMaskedStoredConfig() };
  if (options.json) printJson(output);
  else logger.success(`Saved config to ${getGlobalConfigPath()}`);
  return output;
}

export async function configList(cwd: string, options: ConfigOptions = {}) {
  const config = maskConfig(await resolveConfig(cwd));
  if (options.json) printJson(config);
  else process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export async function configGet(cwd: string, key: string, options: ConfigOptions = {}) {
  const config = maskConfig(await resolveConfig(cwd));
  const value = getByPath(config, key);
  if (options.json) printJson({ key, value });
  else process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`);
  return value;
}

export async function configSet(key: string, value: string, options: ConfigOptions = {}) {
  const logger = createLogger({ json: options.json });
  const config = await setGlobalConfigValue(key, value);
  const stored = await getMaskedStoredConfig();
  const output = {
    success: true,
    path: getGlobalConfigPath(),
    key,
    value: key.toLowerCase().includes('apikey') ? maskSecret(value) : value,
    config: stored,
  };

  if (options.json) printJson(output);
  else logger.success(`Set ${key}.`);
  return config;
}

export async function configReset(options: ConfigOptions = {}) {
  const logger = createLogger({ json: options.json });
  await resetGlobalConfig();
  const output = { success: true, path: getGlobalConfigPath() };
  if (options.json) printJson(output);
  else logger.success('Reset global shipit config.');
  return output;
}
