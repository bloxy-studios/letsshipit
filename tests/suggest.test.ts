import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDiffContext } from '../src/core/diff.js';

let dirs: string[] = [];

describe('suggest command', () => {
  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs = [];
  });

  it('can build staged diff without including unstaged changes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shipit-suggest-'));
    dirs.push(dir);

    await execa('git', ['init', '-b', 'main'], { cwd: dir });
    await writeFile(join(dir, 'example.txt'), 'staged-change\n');
    await execa('git', ['add', 'example.txt'], { cwd: dir });
    await writeFile(join(dir, 'example.txt'), 'staged-change\nunstaged-change\n');

    const diff = await buildDiffContext(dir, 'staged');

    expect(diff.diff).toContain('staged-change');
    expect(diff.diff).not.toContain('unstaged-change');
  });
});
