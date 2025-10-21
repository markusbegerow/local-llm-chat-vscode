"use strict";
/**
 * Extension entry point
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const chatPanel_1 = require("./chatPanel");
const utils_1 = require("./utils");
/**
 * Extension activation
 */
function activate(context) {
    console.log('Local LLM Chat extension activated');
    // Register: Open Chat command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.openChat', () => {
        chatPanel_1.ChatPanel.open(context);
    }));
    // Register: Create File From Selection command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.newFileFromSelection', async () => {
        await createFileFromSelection();
    }));
    // Register: Clear Conversation command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.clearConversation', () => {
        if (chatPanel_1.ChatPanel.current) {
            chatPanel_1.ChatPanel.current.clearConversation();
        }
        else {
            vscode.window.showInformationMessage('No active chat to clear.');
        }
    }));
    // Register: Send File to Chat command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.sendFileToChat', async () => {
        await sendFileToChat(context);
    }));
    // Register: List Workspace Files command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.listWorkspaceFiles', async () => {
        await listWorkspaceFilesCommand(context);
    }));
    // Register: Get Workspace Info command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.getWorkspaceInfo', async () => {
        await getWorkspaceInfoCommand(context);
    }));
    // Register: Search Files command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.searchFiles', async () => {
        await searchFilesCommand(context);
    }));
    // Register: Send Active File to Chat command
    context.subscriptions.push(vscode.commands.registerCommand('localLLM.sendActiveFileToChat', async () => {
        await sendActiveFileToChat(context);
    }));
}
/**
 * Extension deactivation
 */
function deactivate() {
    console.log('Local LLM Chat extension deactivated');
}
/**
 * Creates a new file from the current editor selection
 */
async function createFileFromSelection() {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            return;
        }
        // Get selected text or entire document
        const content = editor.document.getText(editor.selection) || editor.document.getText();
        if (!content || content.trim().length === 0) {
            vscode.window.showWarningMessage('No content to create file from.');
            return;
        }
        // Prompt for file path
        const relPath = await vscode.window.showInputBox({
            prompt: 'Enter relative path for the new file',
            value: 'new-file.txt',
            placeHolder: 'path/to/file.ext',
            validateInput: (value) => {
                try {
                    (0, utils_1.validateRelativePath)(value);
                    return null;
                }
                catch (error) {
                    return error.message;
                }
            }
        });
        if (!relPath)
            return;
        // Get workspace
        const workspace = (0, utils_1.getActiveWorkspaceFolder)();
        if (!workspace) {
            vscode.window.showWarningMessage('No workspace folder open. Please open a folder to create files.');
            return;
        }
        // Validate content size
        const config = (0, utils_1.getLLMConfig)();
        (0, utils_1.validateFileContent)(content, config.maxFileSize);
        // Build file URI
        const fileUri = vscode.Uri.joinPath(workspace.uri, relPath);
        // Check if file exists
        let exists = false;
        try {
            await vscode.workspace.fs.stat(fileUri);
            exists = true;
        }
        catch {
            exists = false;
        }
        // Confirm with user
        const action = exists ? 'Overwrite' : 'Create';
        const choice = await vscode.window.showWarningMessage(`${action} file "${relPath}" in workspace "${workspace.name}"?`, { modal: true }, action, 'Cancel');
        if (choice !== action) {
            return;
        }
        // Write file
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
        // Open file in editor
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showInformationMessage(`${action}d file: ${relPath}`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to create file: ${error?.message ?? error}`);
    }
}
/**
 * Sends a file's content to the chat
 */
async function sendFileToChat(context) {
    try {
        const workspace = (0, utils_1.getActiveWorkspaceFolder)();
        if (!workspace) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        // Prompt for file path
        const filePath = await vscode.window.showInputBox({
            prompt: 'Enter relative path to file',
            placeHolder: 'src/example.ts',
            validateInput: (value) => {
                try {
                    (0, utils_1.validateRelativePath)(value);
                    return null;
                }
                catch (error) {
                    return error.message;
                }
            }
        });
        if (!filePath)
            return;
        // Read file
        const content = await (0, utils_1.readWorkspaceFile)(filePath);
        // Open chat if not already open
        const panel = chatPanel_1.ChatPanel.open(context);
        // Send to chat with context
        const message = `Here is the content of file "${filePath}":\n\n\`\`\`\n${content}\n\`\`\``;
        panel.sendMessageToChat(message);
        vscode.window.showInformationMessage(`Sent "${filePath}" to chat`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to send file: ${error?.message ?? error}`);
    }
}
/**
 * Sends the active editor's file to chat
 */
async function sendActiveFileToChat(context) {
    try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            return;
        }
        const workspace = (0, utils_1.getActiveWorkspaceFolder)();
        if (!workspace) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        // Get relative path
        const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        const content = editor.document.getText();
        // Open chat if not already open
        const panel = chatPanel_1.ChatPanel.open(context);
        // Send to chat with context
        const message = `Here is the content of file "${relativePath}":\n\n\`\`\`\n${content}\n\`\`\``;
        panel.sendMessageToChat(message);
        vscode.window.showInformationMessage(`Sent "${relativePath}" to chat`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to send file: ${error?.message ?? error}`);
    }
}
/**
 * Lists workspace files and sends to chat
 */
async function listWorkspaceFilesCommand(context) {
    try {
        const workspace = (0, utils_1.getActiveWorkspaceFolder)();
        if (!workspace) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        // Ask for path
        const dirPath = await vscode.window.showInputBox({
            prompt: 'Enter directory path (leave empty for root)',
            placeHolder: 'src',
            value: ''
        });
        if (dirPath === undefined)
            return;
        // Ask if recursive
        const recursive = await vscode.window.showQuickPick(['No', 'Yes (max depth 3)'], {
            placeHolder: 'List files recursively?',
            title: 'Recursive Listing'
        });
        if (!recursive)
            return;
        const options = {
            recursive: recursive.startsWith('Yes'),
            maxDepth: 3
        };
        // List files
        const files = await (0, utils_1.listWorkspaceFiles)(dirPath, options);
        if (files.length === 0) {
            vscode.window.showInformationMessage('No files found.');
            return;
        }
        // Format output
        let output = `Files in "${dirPath || 'workspace root'}" (${files.length} items):\n\n`;
        for (const file of files) {
            const icon = file.type === 'directory' ? '📁' : '📄';
            output += `${icon} ${file.path}\n`;
        }
        // Open chat and send
        const panel = chatPanel_1.ChatPanel.open(context);
        panel.sendMessageToChat(output);
        vscode.window.showInformationMessage(`Listed ${files.length} files`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to list files: ${error?.message ?? error}`);
    }
}
/**
 * Gets workspace info and sends to chat
 */
async function getWorkspaceInfoCommand(context) {
    try {
        const metadata = await (0, utils_1.getWorkspaceMetadata)();
        // Format output
        let output = `Workspace Information:\n\n`;
        output += `Name: ${metadata.name}\n`;
        output += `Path: ${metadata.path}\n`;
        output += `Has Git: ${metadata.hasGit ? 'Yes' : 'No'}\n`;
        output += `Has package.json: ${metadata.hasPackageJson ? 'Yes' : 'No'}\n`;
        // Open chat and send
        const panel = chatPanel_1.ChatPanel.open(context);
        panel.sendMessageToChat(output);
        vscode.window.showInformationMessage('Workspace info sent to chat');
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to get workspace info: ${error?.message ?? error}`);
    }
}
/**
 * Searches for files and sends results to chat
 */
async function searchFilesCommand(context) {
    try {
        const workspace = (0, utils_1.getActiveWorkspaceFolder)();
        if (!workspace) {
            vscode.window.showWarningMessage('No workspace folder open.');
            return;
        }
        // Ask for pattern
        const pattern = await vscode.window.showInputBox({
            prompt: 'Enter file search pattern (glob)',
            placeHolder: '**/*.ts',
            value: '**/*'
        });
        if (!pattern)
            return;
        // Search files
        const files = await (0, utils_1.findFilesInWorkspace)(pattern, 100);
        if (files.length === 0) {
            vscode.window.showInformationMessage(`No files found matching "${pattern}"`);
            return;
        }
        // Format output
        let output = `Files matching "${pattern}" (${files.length} results):\n\n`;
        for (const file of files) {
            output += `📄 ${file}\n`;
        }
        if (files.length === 100) {
            output += `\n(Limited to first 100 results)`;
        }
        // Open chat and send
        const panel = chatPanel_1.ChatPanel.open(context);
        panel.sendMessageToChat(output);
        vscode.window.showInformationMessage(`Found ${files.length} files`);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to search files: ${error?.message ?? error}`);
    }
}
//# sourceMappingURL=extension.js.map