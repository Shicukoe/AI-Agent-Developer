import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'Read',
    description: 'Read the contents of a file at the specified path',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path of the file to read (relative to workspace root)' }
      },
      required: ['path']
    }
  },
  {
    name: 'Write',
    description: 'Write complete content to a file (creates directories if they do not exist)',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path of the file to write (relative to workspace root)' },
        content: { type: 'string', description: 'The full content to write to the file' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'Edit',
    description: 'Edit a specific block of text in a file by replacing oldText with newText. The oldText must match exactly (including whitespace/newlines) and be unique in the file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'The path of the file to edit (relative to workspace root)' },
        oldText: { type: 'string', description: 'The exact block of text to be replaced' },
        newText: { type: 'string', description: 'The new block of text to replace oldText' }
      },
      required: ['path', 'oldText', 'newText']
    }
  },
  {
    name: 'Glob',
    description: 'List all files matching a glob pattern (recursive search like **/*.ts or src/*)',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.ts", "src/**/*.tsx")' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'Grep',
    description: 'Search for a string query recursively inside files in the workspace',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or query string' }
      },
      required: ['query']
    }
  }
];

// Simple glob matching function using regex
function matchPattern(path: string, pattern: string): boolean {
  // Replace double stars ** with .* and single stars * with [^/]*
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\\\*\\\*/g, '.*').replace(/\\\*/g, '[^/]*').replace(/\\\?/g, '.') + '$';
  const regex = new RegExp(regexStr, 'i');
  return regex.test(path);
}

// Recursive directory walk
function getFilesRecursive(dir: string, baseDir: string = dir): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return [];
  const list = readdirSync(dir);
  for (const file of list) {
    // Skip common folders to avoid performance issues
    if (['node_modules', '.git', 'dist', '.vfscache', '.vfsmeta', '.stubs', '_agent-worktrees', 'data'].includes(file)) {
      continue;
    }
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat && stat.isDirectory()) {
      results.push(...getFilesRecursive(path, baseDir));
    } else {
      results.push(relative(baseDir, path).replace(/\\/g, '/'));
    }
  }
  return results;
}

export function executeTool(cwd: string, toolName: string, args: any): string {
  // Resolve path safely to prevent leaving workspace directory
  const safeResolve = (p: string) => {
    const resolved = resolve(cwd, p);
    if (!resolved.startsWith(resolve(cwd))) {
      throw new Error(`Access denied: path ${p} is outside the workspace directory`);
    }
    return resolved;
  };

  try {
    switch (toolName) {
      case 'Read': {
        const fullPath = safeResolve(args.path);
        if (!existsSync(fullPath)) return `Error: File not found at ${args.path}`;
        return readFileSync(fullPath, 'utf8');
      }
      case 'Write': {
        const fullPath = safeResolve(args.path);
        mkdirSync(join(fullPath, '..'), { recursive: true });
        writeFileSync(fullPath, args.content, 'utf8');
        return `Successfully wrote content to ${args.path}`;
      }
      case 'Edit': {
        const fullPath = safeResolve(args.path);
        if (!existsSync(fullPath)) return `Error: File not found at ${args.path}`;
        const content = readFileSync(fullPath, 'utf8');
        const oldText = args.oldText;
        const newText = args.newText;

        const occurrences = content.split(oldText).length - 1;
        if (occurrences === 0) {
          return `Error: Could not find oldText in ${args.path}. Make sure it matches exactly.`;
        }
        if (occurrences > 1) {
          return `Error: oldText occurs ${occurrences} times in ${args.path}. Make it more specific.`;
        }

        const newContent = content.replace(oldText, newText);
        writeFileSync(fullPath, newContent, 'utf8');
        return `Successfully edited ${args.path}`;
      }
      case 'Glob': {
        const allFiles = getFilesRecursive(cwd);
        const pattern = args.pattern;
        const matched = allFiles.filter(f => matchPattern(f, pattern));
        return matched.length > 0 ? matched.join('\n') : '(no matching files found)';
      }
      case 'Grep': {
        const allFiles = getFilesRecursive(cwd);
        const query = args.query.toLowerCase();
        const results: string[] = [];
        for (const file of allFiles) {
          const fullPath = safeResolve(file);
          const stat = statSync(fullPath);
          if (stat.size > 500000) continue; // skip files > 500KB
          try {
            const content = readFileSync(fullPath, 'utf8');
            if (content.toLowerCase().includes(query)) {
              content.split('\n').forEach((line, idx) => {
                if (line.toLowerCase().includes(query)) {
                  results.push(`${file}:${idx + 1}: ${line.trim().slice(0, 150)}`);
                }
              });
            }
          } catch {
            // ignore files we can't read as text
          }
        }
        return results.length > 0 ? results.slice(0, 100).join('\n') : '(no matches found)';
      }
      default:
        return `Error: Unknown tool ${toolName}`;
    }
  } catch (e) {
    return `Error executing tool: ${(e as Error).message}`;
  }
}
