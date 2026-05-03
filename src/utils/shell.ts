import { execa, type Options } from 'execa';

export async function runCommand(
  command: string,
  args: string[] = [],
  options: Options = {},
): Promise<string> {
  const result = await execa(command, args, {
    ...options,
    reject: true,
  });

  return String(result.stdout ?? '').trim();
}

export async function tryRunCommand(
  command: string,
  args: string[] = [],
  options: Options = {},
): Promise<string | undefined> {
  try {
    return await runCommand(command, args, options);
  } catch {
    return undefined;
  }
}

export async function commandExists(command: string): Promise<boolean> {
  const checker = process.platform === 'win32' ? 'where' : 'command';
  const args = process.platform === 'win32' ? [command] : ['-v', command];
  return (await tryRunCommand(checker, args, { shell: process.platform !== 'win32' })) !== undefined;
}
