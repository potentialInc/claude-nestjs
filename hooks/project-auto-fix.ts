#!/usr/bin/env node
/**
 * Project Auto-Fix Hook
 *
 * Stop hook that automatically runs lint, format, and type-check on projects
 * when Claude makes changes to files.
 *
 * Features:
 * - Detects which projects had files modified
 * - Runs lint with auto-fix (removes unused imports, fixes formatting)
 * - Runs type-check and triggers auto-error-resolver if errors found
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

// --- Interfaces ---

interface HookInput {
  session_id: string;
  transcript?: Array<{
    type: string;
    message?: {
      content?: Array<{
        type: string;
        tool_use?: {
          name: string;
          input: {
            file_path?: string;
            edits?: Array<{ file_path: string }>;
            subagent_type?: string;
          };
        };
      }>;
    };
  }>;
}

interface ProjectConfig {
  name: string;
  path: string;
  lintCommand: string;
  formatCommand?: string;
  typeCheckCommand: string;
  patterns: string[];
}

interface AutoFixConfig {
  projects: ProjectConfig[];
  triggerAutoResolver: boolean;
}

// --- Configuration ---

const DEFAULT_CONFIG: AutoFixConfig = {
  projects: [
    {
      name: 'backend',
      path: 'backend',
      lintCommand: 'npm run lint',
      formatCommand: 'npm run format',
      typeCheckCommand: 'npm run type-check',
      patterns: ['**/*.ts'],
    },
    {
      name: 'frontend',
      path: 'frontend',
      lintCommand: 'npm run lint',
      typeCheckCommand: 'npm run type-check',
      patterns: ['**/*.ts', '**/*.tsx'],
    },
    {
      name: 'dashboard',
      path: 'dashboard',
      lintCommand: 'npm run lint',
      typeCheckCommand: 'npm run type-check',
      patterns: ['**/*.ts', '**/*.tsx'],
    },
  ],
  triggerAutoResolver: true,
};

// --- Helper Functions ---

function loadConfig(): AutoFixConfig {
  const configPath = resolve(
    process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    '.claude/nestjs/hooks/auto-fix-config.json'
  );

  if (existsSync(configPath)) {
    try {
      const configContent = readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent) as AutoFixConfig;
    } catch (error) {
      console.error(
        `[auto-fix] Warning: Could not parse config file, using defaults`
      );
    }
  }

  return DEFAULT_CONFIG;
}

function getChangedFilePaths(input: HookInput): string[] {
  const filePaths: string[] = [];

  if (!input.transcript) {
    return filePaths;
  }

  for (const item of input.transcript) {
    if (item.type !== 'assistant' || !item.message?.content) {
      continue;
    }

    for (const content of item.message.content) {
      if (content.type !== 'tool_use' || !content.tool_use) {
        continue;
      }

      const { name, input: toolInput } = content.tool_use;

      // Only process file modification tools
      if (!['Write', 'Edit', 'MultiEdit'].includes(name)) {
        continue;
      }

      if (name === 'MultiEdit' && toolInput.edits) {
        for (const edit of toolInput.edits) {
          if (edit.file_path) {
            filePaths.push(edit.file_path);
          }
        }
      } else if (toolInput.file_path) {
        filePaths.push(toolInput.file_path);
      }
    }
  }

  return [...new Set(filePaths)]; // Remove duplicates
}

function getAffectedProjects(
  filePaths: string[],
  config: AutoFixConfig
): ProjectConfig[] {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const affectedProjects = new Set<string>();

  for (const filePath of filePaths) {
    // Skip non-TypeScript files
    if (!filePath.match(/\.(ts|tsx)$/)) {
      continue;
    }

    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');
    const relativePath = normalizedPath.replace(
      projectDir.replace(/\\/g, '/') + '/',
      ''
    );

    for (const project of config.projects) {
      if (relativePath.startsWith(project.path + '/')) {
        affectedProjects.add(project.name);
        break;
      }
    }
  }

  return config.projects.filter((p) => affectedProjects.has(p.name));
}

function runCommand(
  command: string,
  cwd: string
): { success: boolean; output: string } {
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000, // 2 minute timeout
    });
    return { success: true, output: output || '' };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return {
      success: false,
      output: (execError.stdout || '') + (execError.stderr || ''),
    };
  }
}

function extractTypeErrors(output: string): string[] {
  const errorLines: string[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (line.includes('error TS') || line.includes('error:')) {
      errorLines.push(line.trim());
    }
  }

  return errorLines;
}

function detectBackendDeveloperUsage(input: HookInput): boolean {
  if (!input.transcript) {
    return false;
  }

  for (const item of input.transcript) {
    if (item.type !== 'assistant' || !item.message?.content) {
      continue;
    }

    for (const content of item.message.content) {
      if (content.type !== 'tool_use' || !content.tool_use) {
        continue;
      }

      const { name, input: toolInput } = content.tool_use;

      // Check if Task tool was used with backend-developer subagent
      if (name === 'Task' && toolInput.subagent_type === 'backend-developer') {
        return true;
      }
    }
  }

  return false;
}

function runCleanup(
  projectDir: string,
  sessionId: string
): { success: boolean; output: string } {
  const cleanupScriptPath = resolve(
    projectDir,
    '.claude/nestjs/hooks/backend-cleanup.js'
  );

  if (!existsSync(cleanupScriptPath)) {
    return { success: false, output: 'Cleanup script not found' };
  }

  try {
    // Prepare input for cleanup script
    const cleanupInput = JSON.stringify({ session_id: sessionId });

    const output = execSync(`node "${cleanupScriptPath}"`, {
      cwd: projectDir,
      encoding: 'utf-8',
      input: cleanupInput,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000, // 1 minute timeout
    });

    return { success: true, output: output || '' };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return {
      success: false,
      output: (execError.stdout || '') + (execError.stderr || ''),
    };
  }
}

// --- Main Function ---

function main() {
  try {
    const input = readFileSync(0, 'utf-8');
    let data: HookInput;

    try {
      data = JSON.parse(input) as HookInput;
    } catch {
      // If parsing fails, exit silently (no stdin data)
      process.exit(0);
      return; // For TypeScript control flow analysis
    }

    const config = loadConfig();
    const filePaths = getChangedFilePaths(data);

    if (filePaths.length === 0) {
      process.exit(0);
    }

    const affectedProjects = getAffectedProjects(filePaths, config);

    if (affectedProjects.length === 0) {
      process.exit(0);
    }

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const projectsWithTypeErrors: string[] = [];
    let allTypeErrors: string[] = [];

    // Output header
    console.error('');
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
    console.error('Auto-Fix: Processing changed files');
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );
    console.error(
      `Projects: ${affectedProjects.map((p) => p.name).join(', ')}`
    );
    console.error('');

    for (const project of affectedProjects) {
      const projectPath = resolve(projectDir, project.path);

      if (!existsSync(projectPath)) {
        console.error(`  [${project.name}] Skipped (path not found)`);
        continue;
      }

      // Check if package.json exists
      if (!existsSync(resolve(projectPath, 'package.json'))) {
        console.error(`  [${project.name}] Skipped (no package.json)`);
        continue;
      }

      console.error(`  [${project.name}] Running lint...`);

      // Run lint with auto-fix
      const lintResult = runCommand(project.lintCommand, projectPath);
      if (lintResult.success) {
        console.error(`  [${project.name}] Lint: OK (auto-fixed)`);
      } else {
        // Lint errors that couldn't be auto-fixed
        console.error(`  [${project.name}] Lint: Some issues remain`);
      }

      // Run format if available
      if (project.formatCommand) {
        const formatResult = runCommand(project.formatCommand, projectPath);
        if (formatResult.success) {
          console.error(`  [${project.name}] Format: OK`);
        }
      }

      // Run type check
      console.error(`  [${project.name}] Running type-check...`);
      const typeCheckResult = runCommand(project.typeCheckCommand, projectPath);

      if (typeCheckResult.success) {
        console.error(`  [${project.name}] Type-check: OK`);
      } else {
        const errors = extractTypeErrors(typeCheckResult.output);
        if (errors.length > 0) {
          console.error(
            `  [${project.name}] Type-check: ${errors.length} error(s)`
          );
          projectsWithTypeErrors.push(project.name);
          allTypeErrors = allTypeErrors.concat(
            errors.map((e) => `[${project.name}] ${e}`)
          );
        }
      }

      console.error('');
    }

    // Summary
    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    if (projectsWithTypeErrors.length > 0 && config.triggerAutoResolver) {
      console.error(
        `Type errors found in: ${projectsWithTypeErrors.join(', ')}`
      );
      console.error('');
      console.error('Error preview:');
      allTypeErrors.slice(0, 10).forEach((e) => console.error(`  ${e}`));
      if (allTypeErrors.length > 10) {
        console.error(`  ... and ${allTypeErrors.length - 10} more errors`);
      }
      console.error('');
      console.error('Use the auto-error-resolver agent to fix the errors');
      console.error('WE DO NOT LEAVE A MESS BEHIND');
      console.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

      // Exit with error to make it visible
      process.exit(1);
    } else {
      console.error('All checks passed!');
      console.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

      // Check if backend-developer was used and backend project was affected
      const usedBackendDev = detectBackendDeveloperUsage(data);
      const backendAffected = affectedProjects.some((p) => p.name === 'backend');

      if (usedBackendDev && backendAffected) {
        // Run cleanup for backend files
        const cleanupResult = runCleanup(projectDir, data.session_id);

        if (!cleanupResult.success) {
          // Cleanup failed, but don't block - just log
          if (process.env.DEBUG) {
            console.error(`[auto-fix] Cleanup warning: ${cleanupResult.output}`);
          }
        }
        // Cleanup output is already printed to stderr by the cleanup script
      }

      process.exit(0);
    }
  } catch (error) {
    // Log error for debugging but don't block
    if (process.env.DEBUG) {
      console.error(
        `[auto-fix] Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    process.exit(0);
  }
}

main();
