#!/usr/bin/env node
/**
 * Backend Cleanup Hook
 *
 * Automatically removes unused files after backend-developer agent completes:
 * - Files not imported anywhere
 * - Empty directories
 * - Orphaned test files (tests without implementation)
 * - Unused DTOs/interfaces
 *
 * Safety exclusions:
 * - Database migrations
 * - Core/shared/infrastructure directories
 * - Configuration files
 * - Recently created files (< 24 hours)
 */

const fs = require('fs');
const path = require('path');
const { resolve, dirname, relative, basename, extname, join } = path;
const { readFileSync, existsSync, unlinkSync, readdirSync, statSync, rmdirSync } = fs;

// Lazy load TypeScript from backend node_modules
let ts;
try {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const tsPath = resolve(projectDir, 'backend/node_modules/typescript');
  ts = require(tsPath);
} catch (error) {
  console.error('[cleanup] Warning: TypeScript not found, import analysis disabled');
  ts = null;
}

// --- Interfaces ---

interface CleanupConfig {
  enabled: boolean;
  excludePaths: string[];
  excludePatterns: string[];
  excludeRecentFiles: boolean;
  recentFileThresholdHours: number;
  dryRun: boolean;
  logLevel: 'info' | 'debug' | 'warn';
  scanPaths: string[];
}

interface ImportGraph {
  imports: Map<string, Set<string>>; // file -> files it imports
  importedBy: Map<string, Set<string>>; // file -> files that import it
}

interface CleanupResult {
  deleted: string[];
  errors: string[];
}

interface HookInput {
  session_id: string;
}

// --- Configuration ---

function loadConfig(projectDir: string): CleanupConfig {
  const configPath = resolve(
    projectDir,
    '.claude/nestjs/hooks/backend-cleanup-config.json'
  );

  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent) as CleanupConfig;
    } catch (error) {
      console.error(
        `[cleanup] Warning: Could not parse config file, using defaults`
      );
    }
  }

  // Default configuration
  return {
    enabled: true,
    excludePaths: [
      'backend/src/database/migrations',
      'backend/src/core',
      'backend/src/shared',
      'backend/src/infrastructure',
      'backend/src/config',
    ],
    excludePatterns: [
      '*.config.ts',
      '*.constants.ts',
      '*.enum.ts',
      '**/index.ts',
      'main.ts',
      '*.module.ts',
    ],
    excludeRecentFiles: true,
    recentFileThresholdHours: 24,
    dryRun: false,
    logLevel: 'info',
    scanPaths: ['backend/src/modules'],
  };
}

// --- File System Helpers ---

function getAllTypeScriptFiles(dirPath: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
            continue;
          }
          walk(fullPath);
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
        ) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  walk(dirPath);
  return files;
}

function isFileRecent(
  filePath: string,
  thresholdHours: number
): boolean {
  try {
    const stats = statSync(filePath);
    const fileAge = Date.now() - stats.birthtimeMs;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    return fileAge < thresholdMs;
  } catch {
    return false;
  }
}

function matchesPattern(filePath: string, pattern: string): boolean {
  const fileName = basename(filePath);

  // Convert glob pattern to regex
  if (pattern.startsWith('**/')) {
    const suffix = pattern.slice(3);
    return fileName === suffix || filePath.includes('/' + suffix);
  } else if (pattern.startsWith('*.')) {
    const extension = pattern.slice(1);
    return fileName.endsWith(extension);
  } else {
    return fileName === pattern;
  }
}

function isFileExcluded(
  filePath: string,
  config: CleanupConfig,
  projectDir: string
): boolean {
  const relativePath = relative(projectDir, filePath).replace(/\\/g, '/');

  // Check excluded paths
  for (const excludePath of config.excludePaths) {
    if (relativePath.startsWith(excludePath)) {
      return true;
    }
  }

  // Check excluded patterns
  for (const pattern of config.excludePatterns) {
    if (matchesPattern(filePath, pattern)) {
      return true;
    }
  }

  // Check if file is recent
  if (config.excludeRecentFiles) {
    if (isFileRecent(filePath, config.recentFileThresholdHours)) {
      return true;
    }
  }

  return false;
}

// --- TypeScript AST Analysis ---

function extractImports(sourceFile: ts.SourceFile): string[] {
  const imports: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        imports.push(moduleSpecifier.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function resolveImportPath(
  importPath: string,
  fromFile: string,
  projectDir: string
): string | null {
  // Skip external modules (node_modules)
  if (!importPath.startsWith('.') && !importPath.startsWith('@/')) {
    return null;
  }

  // Handle path aliases (@/ -> src/)
  let resolvedPath = importPath;
  if (importPath.startsWith('@/')) {
    resolvedPath = importPath.replace('@/', 'src/');
    resolvedPath = resolve(projectDir, 'backend', resolvedPath);
  } else {
    // Relative import
    const fromDir = dirname(fromFile);
    resolvedPath = resolve(fromDir, importPath);
  }

  // Try adding .ts, .tsx extensions
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try without extension (might already have it)
  if (existsSync(resolvedPath)) {
    return resolvedPath;
  }

  return null;
}

function buildImportGraph(
  files: string[],
  projectDir: string
): ImportGraph {
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();

  // Initialize maps
  for (const file of files) {
    imports.set(file, new Set());
    importedBy.set(file, new Set());
  }

  // Parse each file and build graph
  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const importPaths = extractImports(sourceFile);

      for (const importPath of importPaths) {
        const resolvedPath = resolveImportPath(importPath, file, projectDir);

        if (resolvedPath && files.includes(resolvedPath)) {
          imports.get(file)!.add(resolvedPath);
          importedBy.get(resolvedPath)!.add(file);
        }
      }
    } catch (error) {
      // Skip files that can't be parsed
    }
  }

  return { imports, importedBy };
}

// --- Unused File Detection ---

function findUnusedImports(
  files: string[],
  graph: ImportGraph,
  config: CleanupConfig,
  projectDir: string
): string[] {
  const unused: string[] = [];

  for (const file of files) {
    // Skip if excluded
    if (isFileExcluded(file, config, projectDir)) {
      continue;
    }

    // File is unused if nothing imports it
    const importers = graph.importedBy.get(file);
    if (!importers || importers.size === 0) {
      // Additional check: is it an entry point?
      const fileName = basename(file);
      const isEntryPoint =
        fileName === 'main.ts' ||
        fileName.endsWith('.module.ts') ||
        fileName === 'index.ts';

      if (!isEntryPoint) {
        unused.push(file);
      }
    }
  }

  return unused;
}

function findOrphanedTests(
  files: string[],
  config: CleanupConfig,
  projectDir: string
): string[] {
  const orphaned: string[] = [];

  for (const file of files) {
    if (!file.endsWith('.spec.ts') && !file.endsWith('.spec.tsx')) {
      continue;
    }

    // Skip if excluded
    if (isFileExcluded(file, config, projectDir)) {
      continue;
    }

    // Check if corresponding implementation exists
    const implFile = file.replace(/\.spec\.(ts|tsx)$/, '.$1');

    if (!existsSync(implFile)) {
      orphaned.push(file);
    }
  }

  return orphaned;
}

function findUnusedDTOs(
  files: string[],
  graph: ImportGraph,
  config: CleanupConfig,
  projectDir: string
): string[] {
  const unused: string[] = [];

  for (const file of files) {
    // Only check DTO files
    if (
      !file.includes('/dto/') &&
      !file.includes('/dtos/') &&
      !file.endsWith('.dto.ts')
    ) {
      continue;
    }

    // Skip if excluded
    if (isFileExcluded(file, config, projectDir)) {
      continue;
    }

    // DTO is unused if nothing imports it
    const importers = graph.importedBy.get(file);
    if (!importers || importers.size === 0) {
      unused.push(file);
    }
  }

  return unused;
}

// --- File Deletion ---

function deleteFiles(
  filePaths: string[],
  config: CleanupConfig
): CleanupResult {
  const result: CleanupResult = {
    deleted: [],
    errors: [],
  };

  for (const file of filePaths) {
    try {
      if (config.dryRun) {
        result.deleted.push(file);
      } else {
        unlinkSync(file);
        result.deleted.push(file);
      }
    } catch (error) {
      const errorMsg = `${file}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
    }
  }

  return result;
}

// --- Directory Cleanup ---

function removeEmptyDirectories(
  rootPath: string,
  config: CleanupConfig
): string[] {
  const removed: string[] = [];

  function isDirectoryEmpty(dirPath: string): boolean {
    try {
      const entries = readdirSync(dirPath);
      return entries.length === 0;
    } catch {
      return false;
    }
  }

  function removeEmpty(dirPath: string): boolean {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      // Recursively check subdirectories
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = join(dirPath, entry.name);
          const wasRemoved = removeEmpty(subDir);
          if (wasRemoved) {
            removed.push(subDir);
          }
        }
      }

      // Check if current directory is now empty
      if (isDirectoryEmpty(dirPath)) {
        if (!config.dryRun) {
          rmdirSync(dirPath);
        }
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  // Start from scan paths
  for (const scanPath of config.scanPaths) {
    const fullPath = resolve(rootPath, scanPath);
    if (existsSync(fullPath)) {
      removeEmpty(fullPath);
    }
  }

  return removed;
}

// --- Main Function ---

function main() {
  try {
    // Read input from stdin
    const input = readFileSync(0, 'utf-8');
    let data: HookInput;

    try {
      data = JSON.parse(input);
    } catch {
      // No input, exit silently
      process.exit(0);
    }

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const config = loadConfig(projectDir);

    // Check if cleanup is enabled
    if (!config.enabled) {
      if (config.logLevel === 'debug') {
        console.error('[cleanup] Cleanup disabled in config');
      }
      process.exit(0);
    }

    const backendPath = resolve(projectDir, 'backend/src');

    // Check if backend exists
    if (!existsSync(backendPath)) {
      process.exit(0);
    }

    // Output header
    console.error('');
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
    console.error('Backend Cleanup: Scanning for unused files');
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    if (config.dryRun) {
      console.error('[DRY RUN MODE - No files will be deleted]');
      console.error('');
    }

    // Get all TypeScript files
    const allFiles = getAllTypeScriptFiles(backendPath);

    if (allFiles.length === 0) {
      console.error('No TypeScript files found');
      console.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );
      process.exit(0);
    }

    console.error(`Analyzing ${allFiles.length} files...`);
    console.error('');

    // Build import graph
    const graph = buildImportGraph(allFiles, projectDir);

    // Find candidates for deletion
    const unusedFiles = findUnusedImports(allFiles, graph, config, projectDir);
    const orphanedTests = findOrphanedTests(allFiles, config, projectDir);
    const unusedDTOs = findUnusedDTOs(allFiles, graph, config, projectDir);

    // Combine and deduplicate
    const allCandidates = [
      ...new Set([...unusedFiles, ...orphanedTests, ...unusedDTOs]),
    ];

    if (allCandidates.length === 0) {
      console.error('✓ No unused files found');
      console.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );
      process.exit(0);
    }

    console.error(`Found ${allCandidates.length} unused file(s):`);
    console.error('');

    // Group by type for better output
    if (unusedFiles.length > 0) {
      console.error(`  Unused imports (${unusedFiles.length}):`);
      unusedFiles.forEach((f) => {
        const rel = relative(projectDir, f);
        console.error(`    - ${rel}`);
      });
      console.error('');
    }

    if (orphanedTests.length > 0) {
      console.error(`  Orphaned tests (${orphanedTests.length}):`);
      orphanedTests.forEach((f) => {
        const rel = relative(projectDir, f);
        console.error(`    - ${rel}`);
      });
      console.error('');
    }

    if (unusedDTOs.length > 0) {
      console.error(`  Unused DTOs (${unusedDTOs.length}):`);
      unusedDTOs.forEach((f) => {
        const rel = relative(projectDir, f);
        console.error(`    - ${rel}`);
      });
      console.error('');
    }

    // Delete files
    const deleteResult = deleteFiles(allCandidates, config);

    console.error(
      `${config.dryRun ? 'Would delete' : 'Deleted'}: ${deleteResult.deleted.length} file(s)`
    );

    if (deleteResult.errors.length > 0) {
      console.error(`Errors: ${deleteResult.errors.length}`);
      deleteResult.errors.forEach((e) => console.error(`  - ${e}`));
      console.error('');
    }

    // Clean empty directories
    if (!config.dryRun) {
      const emptyDirs = removeEmptyDirectories(projectDir, config);
      if (emptyDirs.length > 0) {
        console.error(
          `${config.dryRun ? 'Would remove' : 'Removed'} ${emptyDirs.length} empty director(ies)`
        );
      }
    }

    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    process.exit(0);
  } catch (error) {
    // Log error for debugging but don't block
    if (process.env.DEBUG) {
      console.error(
        `[cleanup] Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
    process.exit(0);
  }
}

main();
