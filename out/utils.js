"use strict";
/**
 * Utility functions for Local LLM Chat extension
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveWorkspaceFolder = getActiveWorkspaceFolder;
exports.validateRelativePath = validateRelativePath;
exports.getLLMConfig = getLLMConfig;
exports.validateUrl = validateUrl;
exports.validateFileContent = validateFileContent;
exports.formatBytes = formatBytes;
exports.escapeHtml = escapeHtml;
exports.trimMessageHistory = trimMessageHistory;
exports.readWorkspaceFile = readWorkspaceFile;
exports.listWorkspaceFiles = listWorkspaceFiles;
exports.getWorkspaceMetadata = getWorkspaceMetadata;
exports.findFilesInWorkspace = findFilesInWorkspace;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
/**
 * Gets the active workspace folder.
 * Priority: 1) Workspace of active editor, 2) Single workspace, 3) First workspace
 */
function getActiveWorkspaceFolder() {
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
function validateRelativePath(relPath) {
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
function getLLMConfig() {
    const config = vscode.workspace.getConfiguration('localLLM');
    return {
        apiUrl: config.get('apiUrl') ?? 'http://localhost:11434',
        model: config.get('model') ?? 'llama3.1',
        apiCompat: config.get('apiCompat') ?? 'openai',
        customEndpoint: config.get('customEndpoint') ?? '',
        temperature: config.get('temperature') ?? 0.7,
        maxTokens: config.get('maxTokens') ?? 2048,
        systemPrompt: config.get('systemPrompt') ??
            'You are a helpful coding assistant inside VS Code. Keep answers concise. When proposing file content, respond with a fenced code block beginning with ```file path="relative/path.ext" followed by the complete file content.',
        maxHistoryMessages: config.get('maxHistoryMessages') ?? 50,
        requestTimeout: config.get('requestTimeout') ?? 120000,
        maxFileSize: config.get('maxFileSize') ?? 1048576,
        allowWriteWithoutPrompt: config.get('allowWriteWithoutPrompt') ?? false,
    };
}
/**
 * Validates URL format (basic validation)
 */
function validateUrl(url) {
    if (!url || url.trim().length === 0) {
        return false;
    }
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }
    catch {
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
function validateFileContent(content, maxSize) {
    const byteSize = Buffer.byteLength(content, 'utf8');
    if (byteSize > maxSize) {
        throw new Error(`Content size (${formatBytes(byteSize)}) exceeds maximum allowed size (${formatBytes(maxSize)})`);
    }
}
/**
 * Formats bytes into human-readable string
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text) {
    const map = {
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
function trimMessageHistory(messages, maxMessages) {
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
async function readWorkspaceFile(relPath) {
    validateRelativePath(relPath);
    const workspace = getActiveWorkspaceFolder();
    if (!workspace) {
        throw new Error('No workspace folder open');
    }
    const fileUri = vscode.Uri.joinPath(workspace.uri, relPath);
    try {
        const content = await vscode.workspace.fs.readFile(fileUri);
        return Buffer.from(content).toString('utf8');
    }
    catch (error) {
        throw new Error(`Failed to read file "${relPath}": ${error?.message ?? error}`);
    }
}
/**
 * Lists files and directories in a workspace path
 * @param relPath - Relative path from workspace root (empty for root)
 * @param options - Options for filtering results
 * @returns Array of file/directory entries
 */
async function listWorkspaceFiles(relPath = '', options) {
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
        const results = [];
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
    }
    catch (error) {
        throw new Error(`Failed to list directory "${relPath}": ${error?.message ?? error}`);
    }
}
/**
 * Gets workspace metadata
 */
async function getWorkspaceMetadata() {
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
    }
    catch {
        // .git doesn't exist
    }
    try {
        // Check for package.json
        const packageUri = vscode.Uri.joinPath(workspace.uri, 'package.json');
        await vscode.workspace.fs.stat(packageUri);
        metadata.hasPackageJson = true;
    }
    catch {
        // package.json doesn't exist
    }
    return metadata;
}
/**
 * Searches for files matching a pattern in the workspace
 * @param pattern - Glob pattern to match (e.g., star-star/star.ts)
 * @returns Array of matching file paths
 */
async function findFilesInWorkspace(pattern, maxResults = 100) {
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
    }
    catch (error) {
        throw new Error(`Failed to search files: ${error?.message ?? error}`);
    }
}
//# sourceMappingURL=utils.js.map