import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const packageRoot = process.cwd();

describe("package artifact", () => {
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  it("can be imported after installing the packed tarball", async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "graphql-contract-package-")
    );
    const packDirectory = join(temporaryDirectory, "pack");
    const consumerDirectory = join(temporaryDirectory, "consumer");
    await mkdir(packDirectory);
    await mkdir(consumerDirectory);

    await execFileAsync("npm", ["run", "build"], { cwd: packageRoot });
    const { stdout } = await execFileAsync(
      "npm",
      ["pack", "--json", "--pack-destination", packDirectory],
      { cwd: packageRoot }
    );
    const [{ filename }] = JSON.parse(stdout) as [{ filename: string }];
    const tarballPath = join(packDirectory, filename);

    await execFileAsync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        "--no-save",
        tarballPath,
      ],
      { cwd: consumerDirectory }
    );

    const { stdout: importOutput } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        'const packageModule = await import("graphql-contract"); console.log(typeof packageModule.defineContract);',
      ],
      { cwd: consumerDirectory }
    );
    assert.equal(importOutput.trim(), "function");
  });
});
