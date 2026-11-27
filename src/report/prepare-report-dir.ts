import { lstat, mkdir, realpath, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";

export type ReportDirectoryContext = {
  cwd: string;
  home: string;
};

function isFilesystemRoot(path: string): boolean {
  return parse(path).root === path;
}

function isAncestorOf(parent: string, child: string): boolean {
  const childRelative = relative(parent, child);

  const isParentOrOutside =
    childRelative === ".." || childRelative.startsWith(`..${sep}`) || isAbsolute(childRelative);

  return childRelative !== "" && !isParentOrOutside;
}

function isNotFoundError(error: Error): boolean {
  return "code" in error && error.code === "ENOENT";
}

function assertSafePath(path: string, cwd: string, home: string): void {
  if (isFilesystemRoot(path)) {
    throw new Error("report directory must not be a filesystem root");
  }

  if (path === cwd) {
    throw new Error("report directory must not be the working directory");
  }

  if (path === home) {
    throw new Error("report directory must not be the home directory");
  }

  if (isAncestorOf(path, cwd)) {
    throw new Error("report directory must not be an ancestor of the working directory");
  }

  if (isAncestorOf(path, home)) {
    throw new Error("report directory must not be an ancestor of the home directory");
  }
}

async function rejectSymlink(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);

    if (stats.isSymbolicLink()) {
      throw new Error(`report directory path must not be a symbolic link: ${path}`);
    }

    return true;
  } catch (error) {
    if (error instanceof Error && isNotFoundError(error)) {
      return false;
    }

    throw error;
  }
}

async function rejectWorkspaceSymlinks(cwd: string, reportDir: string): Promise<void> {
  let currentPath = cwd;

  if (!(await rejectSymlink(currentPath))) {
    return;
  }

  for (const component of relative(cwd, reportDir).split(sep)) {
    if (component === "" || component === ".") {
      continue;
    }

    currentPath = join(currentPath, component);

    if (!(await rejectSymlink(currentPath))) {
      return;
    }
  }
}

async function canonicalizeReference(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    if (error instanceof Error && isNotFoundError(error)) {
      return path;
    }

    throw error;
  }
}

async function canonicalizePath(path: string): Promise<string> {
  let existingPath = path;
  const suffix: string[] = [];

  while (true) {
    try {
      await lstat(existingPath);
      break;
    } catch (error) {
      if (!(error instanceof Error && isNotFoundError(error))) {
        throw error;
      }

      const parent = dirname(existingPath);

      suffix.unshift(basename(existingPath));

      if (parent === existingPath) {
        break;
      }

      existingPath = parent;
    }
  }

  try {
    const canonicalAncestor = await realpath(existingPath);

    return join(canonicalAncestor, ...suffix);
  } catch (cause) {
    throw new Error(`failed to canonicalize report directory ${path}`, { cause });
  }
}

export async function assertSafeReportDirectory(
  reportDir: string,
  context: ReportDirectoryContext,
): Promise<string> {
  const lexicalCwd = resolve(context.cwd);
  const lexicalHome = resolve(lexicalCwd, context.home);
  const canonicalCwd = await canonicalizeReference(lexicalCwd);
  const canonicalHome = await canonicalizeReference(lexicalHome);
  const lexicalReportDir = resolve(lexicalCwd, reportDir);
  const isInsideWorkspace = isAncestorOf(lexicalCwd, lexicalReportDir);

  assertSafePath(lexicalReportDir, lexicalCwd, lexicalHome);

  if (isInsideWorkspace) {
    await rejectWorkspaceSymlinks(lexicalCwd, lexicalReportDir);
  } else {
    await rejectSymlink(lexicalReportDir);
  }

  const canonicalReportDir = await canonicalizePath(lexicalReportDir);

  assertSafePath(canonicalReportDir, canonicalCwd, canonicalHome);

  if (!isInsideWorkspace) {
    if (isAncestorOf(canonicalCwd, canonicalReportDir)) {
      throw new Error("report directory must not resolve inside the working directory");
    }

    if (isAncestorOf(canonicalHome, canonicalReportDir)) {
      throw new Error("report directory must not resolve inside the home directory");
    }
  }

  return canonicalReportDir;
}

export async function prepareReportDirectory(
  reportDir: string,
  context: ReportDirectoryContext,
): Promise<void> {
  const safeReportDir = await assertSafeReportDirectory(reportDir, context);

  await rm(safeReportDir, { recursive: true, force: true });
  await mkdir(safeReportDir, { recursive: true });
  await mkdir(join(safeReportDir, "servers"), { recursive: true });
}
