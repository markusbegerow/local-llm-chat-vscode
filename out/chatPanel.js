"use strict";
/**
 * Chat Panel Webview Provider
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
exports.ChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const llm_1 = require("./llm");
const utils_1 = require("./utils");
class ChatPanel {
    /**
     * Opens or reveals the chat panel
     */
    static open(context) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;
        // If panel already exists, reveal it
        if (ChatPanel.current) {
            ChatPanel.current.panel.reveal(column);
            return ChatPanel.current;
        }
        // Create new panel
        const panel = vscode.window.createWebviewPanel('localLLMChat', 'Local LLM Chat', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        });
        ChatPanel.current = new ChatPanel(context, panel);
        return ChatPanel.current;
    }
    constructor(context, panel) {
        this.messages = [];
        this.disposables = [];
        this.context = context;
        this.panel = panel;
        // Initialize with system message
        this.resetConversation();
        // Set webview content
        this.panel.webview.html = this.getHtml();
        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (msg) => {
            try {
                switch (msg.type) {
                    case 'chat:send':
                        if (msg.text) {
                            await this.onUserMessage(msg.text);
                        }
                        break;
                    case 'chat:clear':
                        this.clearConversation();
                        break;
                    case 'file:create':
                        if (msg.file) {
                            await this.createFileWithConfirm(msg.file.path, msg.file.content);
                        }
                        break;
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Error: ${error?.message ?? error}`);
                this.post({ type: 'chat:error', message: String(error?.message ?? error) });
            }
        }, null, this.disposables);
        // Handle panel disposal
        this.panel.onDidDispose(() => {
            ChatPanel.current = undefined;
            this.disposables.forEach(d => d.dispose());
        }, null, this.disposables);
    }
    /**
     * Resets the conversation to initial state
     */
    resetConversation() {
        const config = (0, utils_1.getLLMConfig)();
        this.messages = [
            { role: 'system', content: config.systemPrompt }
        ];
    }
    /**
     * Clears the conversation and notifies the webview
     */
    clearConversation() {
        this.resetConversation();
        this.post({ type: 'chat:clear' });
        vscode.window.showInformationMessage('Conversation cleared.');
    }
    /**
     * Sends a message to chat programmatically (e.g., from commands)
     */
    sendMessageToChat(text) {
        if (!text || text.trim().length === 0) {
            return;
        }
        // Display the message in the webview
        this.post({ type: 'chat:append', role: 'user', content: text });
        // Process the message
        this.onUserMessage(text).catch(error => {
            vscode.window.showErrorMessage(`Failed to process message: ${error?.message ?? error}`);
        });
    }
    /**
     * Handles user message from webview
     */
    async onUserMessage(text) {
        const trimmedText = text.trim();
        if (!trimmedText) {
            return;
        }
        // Check for special commands
        if (trimmedText.startsWith('/')) {
            await this.handleCommand(trimmedText);
            return;
        }
        // Add user message to chat
        this.messages.push({ role: 'user', content: trimmedText });
        try {
            const config = (0, utils_1.getLLMConfig)();
            const token = await (0, llm_1.getSecretToken)(this.context);
            // Trim message history if needed
            this.messages = (0, utils_1.trimMessageHistory)(this.messages, config.maxHistoryMessages);
            // Call LLM
            const reply = await (0, llm_1.callLLM)({
                apiUrl: config.apiUrl,
                apiCompat: config.apiCompat,
                model: config.model,
                token,
                messages: this.messages,
                customEndpoint: config.customEndpoint,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                timeout: config.requestTimeout
            });
            // Add assistant response
            this.messages.push({ role: 'assistant', content: reply });
            this.post({ type: 'chat:append', role: 'assistant', content: reply });
            // Extract and suggest files
            const fileSuggestions = this.extractAllFileFences(reply);
            for (const file of fileSuggestions) {
                this.post({ type: 'file:suggest', file });
            }
        }
        catch (error) {
            const errorMsg = String(error?.message ?? error);
            vscode.window.showErrorMessage(`LLM Error: ${errorMsg}`);
            this.post({ type: 'chat:error', message: errorMsg });
        }
    }
    /**
     * Handles special slash commands in chat
     */
    async handleCommand(command) {
        try {
            const parts = command.slice(1).split(/\s+/);
            const cmd = parts[0].toLowerCase();
            const args = parts.slice(1);
            switch (cmd) {
                case 'read':
                    await this.commandReadFile(args);
                    break;
                case 'list':
                    await this.commandListFiles(args);
                    break;
                case 'search':
                    await this.commandSearchFiles(args);
                    break;
                case 'workspace':
                case 'info':
                    await this.commandWorkspaceInfo();
                    break;
                case 'help':
                    this.commandHelp();
                    break;
                default:
                    this.post({
                        type: 'chat:append',
                        role: 'system',
                        content: `Unknown command: /${cmd}\nType /help for available commands.`
                    });
            }
        }
        catch (error) {
            const errorMsg = String(error?.message ?? error);
            this.post({ type: 'chat:error', message: errorMsg });
        }
    }
    /**
     * /read command - reads a file and adds to context
     */
    async commandReadFile(args) {
        if (args.length === 0) {
            this.post({
                type: 'chat:append',
                role: 'system',
                content: 'Usage: /read <file-path>\nExample: /read src/example.ts'
            });
            return;
        }
        const filePath = args.join(' ');
        const content = await (0, utils_1.readWorkspaceFile)(filePath);
        const message = `File "${filePath}":\n\n\`\`\`\n${content}\n\`\`\``;
        this.post({ type: 'chat:append', role: 'system', content: message });
        // Add to context for LLM
        this.messages.push({
            role: 'user',
            content: `I'm showing you the content of file "${filePath}":\n\n\`\`\`\n${content}\n\`\`\``
        });
    }
    /**
     * /list command - lists workspace files
     */
    async commandListFiles(args) {
        const dirPath = args.join(' ') || '';
        const files = await (0, utils_1.listWorkspaceFiles)(dirPath, { recursive: false });
        if (files.length === 0) {
            this.post({
                type: 'chat:append',
                role: 'system',
                content: `No files found in "${dirPath || 'workspace root'}"`
            });
            return;
        }
        let output = `Files in "${dirPath || 'workspace root'}" (${files.length} items):\n\n`;
        for (const file of files) {
            const icon = file.type === 'directory' ? '📁' : '📄';
            output += `${icon} ${file.name}\n`;
        }
        this.post({ type: 'chat:append', role: 'system', content: output });
    }
    /**
     * /search command - searches for files
     */
    async commandSearchFiles(args) {
        if (args.length === 0) {
            this.post({
                type: 'chat:append',
                role: 'system',
                content: 'Usage: /search <pattern>\nExample: /search **/*.ts'
            });
            return;
        }
        const pattern = args.join(' ');
        const files = await (0, utils_1.findFilesInWorkspace)(pattern, 50);
        if (files.length === 0) {
            this.post({
                type: 'chat:append',
                role: 'system',
                content: `No files found matching "${pattern}"`
            });
            return;
        }
        let output = `Files matching "${pattern}" (${files.length} results):\n\n`;
        for (const file of files) {
            output += `📄 ${file}\n`;
        }
        if (files.length === 50) {
            output += `\n(Limited to first 50 results)`;
        }
        this.post({ type: 'chat:append', role: 'system', content: output });
    }
    /**
     * /workspace command - shows workspace info
     */
    async commandWorkspaceInfo() {
        const metadata = await (0, utils_1.getWorkspaceMetadata)();
        let output = `Workspace Information:\n\n`;
        output += `📁 Name: ${metadata.name}\n`;
        output += `📂 Path: ${metadata.path}\n`;
        output += `${metadata.hasGit ? '✅' : '❌'} Git Repository\n`;
        output += `${metadata.hasPackageJson ? '✅' : '❌'} Node.js Project\n`;
        this.post({ type: 'chat:append', role: 'system', content: output });
    }
    /**
     * /help command - shows available commands
     */
    commandHelp() {
        const helpText = `Available Commands:

📄 /read <file-path>
   Read a file and add to conversation context
   Example: /read src/app.ts

📁 /list [directory]
   List files in a directory (default: root)
   Example: /list src

🔍 /search <pattern>
   Search for files matching a pattern
   Example: /search **/*.json

ℹ️  /workspace
   Show workspace information

❓ /help
   Show this help message`;
        this.post({ type: 'chat:append', role: 'system', content: helpText });
    }
    /**
     * Extracts all file fence blocks from LLM response
     * Format: ```file path="relative/path.ext"
     * content here
     * ```
     */
    extractAllFileFences(text) {
        const suggestions = [];
        const fenceRegex = /```file\s+path="([^"]+)"[\r\n]+([\s\S]*?)```/gm;
        let match;
        while ((match = fenceRegex.exec(text)) !== null) {
            const [, path, content] = match;
            if (path && content !== undefined) {
                suggestions.push({ path: path.trim(), content });
            }
        }
        return suggestions;
    }
    /**
     * Creates a file with user confirmation, including security validations
     */
    async createFileWithConfirm(relPath, content) {
        try {
            // Security: Validate path
            (0, utils_1.validateRelativePath)(relPath);
            // Get workspace
            const workspace = (0, utils_1.getActiveWorkspaceFolder)();
            if (!workspace) {
                vscode.window.showWarningMessage('No workspace folder open. Please open a folder to create files.');
                return;
            }
            // Security: Validate content size
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
            const errorMsg = String(error?.message ?? error);
            vscode.window.showErrorMessage(`Failed to create file: ${errorMsg}`);
            throw error;
        }
    }
    /**
     * Posts a message to the webview
     */
    post(message) {
        this.panel.webview.postMessage(message);
    }
    /**
     * Generates the HTML content for the webview
     */
    getHtml() {
        const jsUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'webview.js'));
        const cspSource = this.panel.webview.cspSource;
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 img-src ${cspSource} https:;
                 script-src ${cspSource};
                 style-src ${cspSource} 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Local LLM Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    .header {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-editorWidget-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--vscode-editor-background);
    }

    .header h2 {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .message {
      margin-bottom: 16px;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--vscode-editorWidget-border);
    }

    .message.user {
      background: var(--vscode-editor-lineHighlightBackground);
      border-left: 3px solid var(--vscode-textLink-foreground);
    }

    .message.assistant {
      background: var(--vscode-editorWidget-background);
      border-left: 3px solid var(--vscode-textLink-activeForeground);
    }

    .message.system {
      background: var(--vscode-editorGutter-background);
      border-left: 3px solid var(--vscode-editorInfo-foreground);
      font-size: 12px;
    }

    .message.error {
      background: var(--vscode-inputValidation-errorBackground);
      border-left: 3px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .message-role {
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      margin-bottom: 6px;
      opacity: 0.8;
    }

    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }

    .file-suggestion {
      margin-top: 16px;
      padding: 12px;
      background: var(--vscode-input-background);
      border: 1px dashed var(--vscode-input-border);
      border-radius: 6px;
    }

    .file-suggestion-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .file-path {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }

    .file-preview {
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      background: var(--vscode-editor-background);
      padding: 8px;
      border-radius: 4px;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre;
      margin: 8px 0;
    }

    .input-area {
      border-top: 1px solid var(--vscode-editorWidget-border);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: var(--vscode-editor-background);
    }

    .input-controls {
      display: flex;
      gap: 8px;
    }

    textarea {
      flex: 1;
      min-height: 60px;
      max-height: 200px;
      padding: 8px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      resize: vertical;
    }

    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    button {
      padding: 8px 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:active {
      opacity: 0.8;
    }

    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .input-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 4px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Local LLM Chat</h2>
      <button id="clearBtn" class="secondary" title="Clear conversation history">Clear</button>
    </div>

    <div id="messages" class="messages"></div>

    <div class="input-area">
      <div class="input-controls">
        <textarea
          id="input"
          placeholder="Ask your local LLM anything...&#10;&#10;Commands: /help /read /list /search /workspace /write"
          autofocus
        ></textarea>
        <button id="sendBtn">Send</button>
      </div>
      <div class="input-hint">
        Press <code>Ctrl+Enter</code> (or <code>Cmd+Enter</code>) to send | Type <code>/help</code> for commands
      </div>
    </div>
  </div>

  <script src="${jsUri}"></script>
</body>
</html>`;
    }
}
exports.ChatPanel = ChatPanel;
//# sourceMappingURL=chatPanel.js.map