/**
 * Utility functions for Local LLM Chat extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LLMConfig } from './types';

/**
 * Gets the active workspace folder.
 * Priority: 1) Workspace of active editor, 2) Single workspace, 3) First workspace
 */
export function getActiveWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  // Try to get workspace from active editor
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (activeUri) {
    const workspace = vscode.workspace.getWorkspaceFolder(activeUri);
    if (workspace) {
      return workspace;
    }
  }

  // If only one workspace, use it
  if (folders.length === 1) {
    return folders[0];
  }

  // Default to first workspace
  return folders[0];
}

/**
 * Validates that a relative path doesn't escape the workspace.
 * Prevents path traversal attacks.
 *
 * @param relPath - The relative path to validate
 * @throws Error if path is invalid or attempts traversal
 */
export function validateRelativePath(relPath: string): void {
  if (!relPath || relPath.trim().length === 0) {
    throw new Error('Path cannot be empty');
  }

  // Normalize the path to handle different separators
  const normalized = path.normalize(relPath);

  // Check for absolute paths
  if (path.isAbsolute(normalized)) {
    throw new Error('Absolute paths are not allowed');
  }

  // Check for parent directory traversal
  if (normalized.includes('..')) {
    throw new Error('Path traversal (..) is not allowed');
  }

  // Check for leading path separators
  if (normalized.startsWith(path.sep) || normalized.startsWith('/')) {
    throw new Error('Path cannot start with a separator');
  }

  // Check for suspicious characters (Windows)
  if (process.platform === 'win32') {
    if (/[<>:"|?*]/.test(relPath)) {
      throw new Error('Path contains invalid characters');
    }
  }

  // Additional security: reject paths with null bytes
  if (relPath.includes('\0')) {
    throw new Error('Path contains null bytes');
  }
}

/**
 * Gets the current LLM configuration from workspace settings
 */
export function getLLMConfig(): LLMConfig {
  const config = vscode.workspace.getConfiguration('localLLM');

  return {
    apiUrl: config.get<string>('apiUrl') ?? 'http://localhost:11434/v1/chat/completions',
    token: config.get<string>('token') ?? 'ollama',
    model: config.get<string>('model') ?? 'llama3.2',
    temperature: config.get<number>('temperature') ?? 0.7,
    maxTokens: config.get<number>('maxTokens') ?? 2048,
    systemPrompt: config.get<string>('systemPrompt') ??
      'You are a helpful coding assistant inside VS Code. Keep answers concise. When proposing file content, respond with a fenced code block beginning with ```file path="relative/path.ext" followed by the complete file content.',
    maxHistoryMessages: config.get<number>('maxHistoryMessages') ?? 50,
    requestTimeout: config.get<number>('requestTimeout') ?? 120000,
    maxFileSize: config.get<number>('maxFileSize') ?? 1048576,
    allowWriteWithoutPrompt: config.get<boolean>('allowWriteWithoutPrompt') ?? false,
  };
}

/**
 * Validates URL format (basic validation)
 */
export function validateUrl(url: string): boolean {
  if (!url || url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes file content by checking size limits
 *
 * @param content - The content to validate
 * @param maxSize - Maximum size in bytes
 * @throws Error if content exceeds size limit
 */
export function validateFileContent(content: string, maxSize: number): void {
  const byteSize = Buffer.byteLength(content, 'utf8');

  if (byteSize > maxSize) {
    throw new Error(
      `Content size (${formatBytes(byteSize)}) exceeds maximum allowed size (${formatBytes(maxSize)})`
    );
  }
}

/**
 * Formats bytes into human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Escapes HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Trims message history to maximum length
 */
export function trimMessageHistory<T extends { role: string }>(
  messages: T[],
  maxMessages: number
): T[] {
  if (messages.length <= maxMessages) {
    return messages;
  }

  // Always keep the system message if present
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  // Keep the most recent messages
  const recentMessages = otherMessages.slice(-maxMessages + systemMessages.length);

  return [...systemMessages, ...recentMessages];
}

/**
 * Reads a file from the workspace
 * @param relPath - Relative path from workspace root
 * @returns File content as string
 */
export async function readWorkspaceFile(relPath: string): Promise<string> {
  validateRelativePath(relPath);

  const workspace = getActiveWorkspaceFolder();
  if (!workspace) {
    throw new Error('No workspace folder open');
  }

  const fileUri = vscode.Uri.joinPath(workspace.uri, relPath);

  try {
    const content = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.from(content).toString('utf8');
  } catch (error: any) {
    throw new Error(`Failed to read file "${relPath}": ${error?.message ?? error}`);
  }
}

/**
 * Lists files and directories in a workspace path
 * @param relPath - Relative path from workspace root (empty for root)
 * @param options - Options for filtering results
 * @returns Array of file/directory entries
 */
export async function listWorkspaceFiles(
  relPath: string = '',
  options?: { filesOnly?: boolean; recursive?: boolean; maxDepth?: number }
): Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>> {
  if (relPath) {
    validateRelativePath(relPath);
  }

  const workspace = getActiveWorkspaceFolder();
  if (!workspace) {
    throw new Error('No workspace folder open');
  }

  const dirUri = relPath
    ? vscode.Uri.joinPath(workspace.uri, relPath)
    : workspace.uri;

  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    const results: Array<{ name: string; path: string; type: 'file' | 'directory' }> = [];

    for (const [name, type] of entries) {
      // Skip hidden files and common ignore patterns
      if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__') {
        continue;
      }

      const itemPath = relPath ? path.join(relPath, name) : name;
      const itemType = type === vscode.FileType.Directory ? 'directory' : 'file';

      if (options?.filesOnly && itemType === 'directory') {
        continue;
      }

      results.push({ name, path: itemPath, type: itemType });

      // Recursive listing
      if (options?.recursive && itemType === 'directory') {
        const currentDepth = itemPath.split(path.sep).length;
        if (!options.maxDepth || currentDepth < options.maxDepth) {
          const subItems = await listWorkspaceFiles(itemPath, options);
          results.push(...subItems);
        }
      }
    }

    return results.sort((a, b) => {
      // Directories first, then alphabetical
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
  } catch (error: any) {
    throw new Error(`Failed to list directory "${relPath}": ${error?.message ?? error}`);
  }
}

/**
 * Gets workspace metadata
 */
export async function getWorkspaceMetadata(): Promise<{
  name: string;
  path: string;
  fileCount?: number;
  hasGit?: boolean;
  hasPackageJson?: boolean;
}> {
  const workspace = getActiveWorkspaceFolder();
  if (!workspace) {
    throw new Error('No workspace folder open');
  }

  const metadata = {
    name: workspace.name,
    path: workspace.uri.fsPath,
    hasGit: false,
    hasPackageJson: false
  };

  try {
    // Check for .git directory
    const gitUri = vscode.Uri.joinPath(workspace.uri, '.git');
    await vscode.workspace.fs.stat(gitUri);
    metadata.hasGit = true;
  } catch {
    // .git doesn't exist
  }

  try {
    // Check for package.json
    const packageUri = vscode.Uri.joinPath(workspace.uri, 'package.json');
    await vscode.workspace.fs.stat(packageUri);
    metadata.hasPackageJson = true;
  } catch {
    // package.json doesn't exist
  }

  return metadata;
}

/**
 * Searches for files matching a pattern in the workspace
 * @param pattern - Glob pattern to match (e.g., star-star/star.ts)
 * @returns Array of matching file paths
 */
export async function findFilesInWorkspace(
  pattern: string,
  maxResults: number = 100
): Promise<string[]> {
  const workspace = getActiveWorkspaceFolder();
  if (!workspace) {
    throw new Error('No workspace folder open');
  }

  try {
    const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults);
    return files.map(uri => {
      const relativePath = vscode.workspace.asRelativePath(uri, false);
      return relativePath;
    });
  } catch (error: any) {
    throw new Error(`Failed to search files: ${error?.message ?? error}`);
  }
}
