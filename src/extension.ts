/**
 * Extension entry point
 */

import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { setSecretToken } from './llm';
import {
  getActiveWorkspaceFolder,
  getLLMConfig,
  validateRelativePath,
  validateFileContent,
  readWorkspaceFile,
  listWorkspaceFiles,
  getWorkspaceMetadata,
  findFilesInWorkspace
} from './utils';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Local LLM Chat extension activated');

  // Register: Open Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.openChat', () => {
      ChatPanel.open(context);
    })
  );

  // Register: Configure API Settings command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.setCredentials', async () => {
      await configureSettings(context);
    })
  );

  // Register: Create File From Selection command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.newFileFromSelection', async () => {
      await createFileFromSelection();
    })
  );

  // Register: Clear Conversation command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.clearConversation', () => {
      if (ChatPanel.current) {
        ChatPanel.current.clearConversation();
      } else {
        vscode.window.showInformationMessage('No active chat to clear.');
      }
    })
  );

  // Register: Send File to Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.sendFileToChat', async () => {
      await sendFileToChat(context);
    })
  );

  // Register: List Workspace Files command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.listWorkspaceFiles', async () => {
      await listWorkspaceFilesCommand(context);
    })
  );

  // Register: Get Workspace Info command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.getWorkspaceInfo', async () => {
      await getWorkspaceInfoCommand(context);
    })
  );

  // Register: Search Files command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.searchFiles', async () => {
      await searchFilesCommand(context);
    })
  );

  // Register: Send Active File to Chat command
  context.subscriptions.push(
    vscode.commands.registerCommand('localLLM.sendActiveFileToChat', async () => {
      await sendActiveFileToChat(context);
    })
  );
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('Local LLM Chat extension deactivated');
}

/**
 * Configures API settings through a series of input prompts
 */
async function configureSettings(context: vscode.ExtensionContext): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('localLLM');

    // API URL
    const apiUrl = await vscode.window.showInputBox({
      prompt: 'Enter LLM API Base URL',
      value: config.get<string>('apiUrl') ?? 'http://localhost:11434',
      placeHolder: 'http://localhost:11434',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'URL cannot be empty';
        }
        return null;
      }
    });

    if (apiUrl === undefined) return; // User cancelled

    await config.update('apiUrl', apiUrl, vscode.ConfigurationTarget.Global);

    // Model name
    const model = await vscode.window.showInputBox({
      prompt: 'Enter model name',
      value: config.get<string>('model') ?? 'llama3.1',
      placeHolder: 'llama3.1',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Model name cannot be empty';
        }
        return null;
      }
    });

    if (model === undefined) return;

    await config.update('model', model, vscode.ConfigurationTarget.Global);

    // API compatibility mode
    const apiCompat = await vscode.window.showQuickPick(
      [
        {
          label: 'OpenAI Compatible',
          description: 'For LM Studio, vLLM, text-generation-webui, etc.',
          value: 'openai'
        },
        {
          label: 'Ollama Native',
          description: 'For native Ollama API',
          value: 'ollama'
        }
      ],
      {
        placeHolder: 'Select API compatibility mode',
        title: 'API Compatibility'
      }
    );

    if (apiCompat === undefined) return;

    await config.update('apiCompat', apiCompat.value, vscode.ConfigurationTarget.Global);

    // Custom endpoint (optional)
    const customEndpoint = await vscode.window.showInputBox({
      prompt: 'Enter custom endpoint URL (optional, OpenAI-style)',
      value: config.get<string>('customEndpoint') ?? '',
      placeHolder: 'https://your-api.com/v1/chat/completions',
      validateInput: (value) => {
        if (value && value.trim().length > 0) {
          try {
            new URL(value);
            return null;
          } catch {
            return 'Invalid URL format';
          }
        }
        return null;
      }
    });

    if (customEndpoint === undefined) return;

    await config.update('customEndpoint', customEndpoint, vscode.ConfigurationTarget.Global);

    // API Token (secure)
    const token = await vscode.window.showInputBox({
      prompt: 'Enter API Token (optional, leave blank if none)',
      password: true,
      placeHolder: 'sk-...'
    });

    if (token !== undefined) {
      await setSecretToken(context, token);
    }

    // Temperature
    const temperature = await vscode.window.showInputBox({
      prompt: 'Enter temperature (0.0 - 2.0, default: 0.7)',
      value: String(config.get<number>('temperature') ?? 0.7),
      validateInput: (value) => {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 2) {
          return 'Temperature must be between 0.0 and 2.0';
        }
        return null;
      }
    });

    if (temperature !== undefined) {
      await config.update('temperature', parseFloat(temperature), vscode.ConfigurationTarget.Global);
    }

    vscode.window.showInformationMessage('Local LLM settings saved successfully!');

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to save settings: ${error?.message ?? error}`);
  }
}

/**
 * Creates a new file from the current editor selection
 */
async function createFileFromSelection(): Promise<void> {
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
          validateRelativePath(value);
          return null;
        } catch (error: any) {
          return error.message;
        }
      }
    });

    if (!relPath) return;

    // Get workspace
    const workspace = getActiveWorkspaceFolder();
    if (!workspace) {
      vscode.window.showWarningMessage(
        'No workspace folder open. Please open a folder to create files.'
      );
      return;
    }

    // Validate content size
    const config = getLLMConfig();
    validateFileContent(content, config.maxFileSize);

    // Build file URI
    const fileUri = vscode.Uri.joinPath(workspace.uri, relPath);

    // Check if file exists
    let exists = false;
    try {
      await vscode.workspace.fs.stat(fileUri);
      exists = true;
    } catch {
      exists = false;
    }

    // Confirm with user
    const action = exists ? 'Overwrite' : 'Create';
    const choice = await vscode.window.showWarningMessage(
      `${action} file "${relPath}" in workspace "${workspace.name}"?`,
      { modal: true },
      action,
      'Cancel'
    );

    if (choice !== action) {
      return;
    }

    // Write file
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));

    // Open file in editor
    const doc = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(doc, { preview: false });

    vscode.window.showInformationMessage(`${action}d file: ${relPath}`);

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to create file: ${error?.message ?? error}`);
  }
}

/**
 * Sends a file's content to the chat
 */
async function sendFileToChat(context: vscode.ExtensionContext): Promise<void> {
  try {
    const workspace = getActiveWorkspaceFolder();
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
          validateRelativePath(value);
          return null;
        } catch (error: any) {
          return error.message;
        }
      }
    });

    if (!filePath) return;

    // Read file
    const content = await readWorkspaceFile(filePath);

    // Open chat if not already open
    const panel = ChatPanel.open(context);

    // Send to chat with context
    const message = `Here is the content of file "${filePath}":\n\n\`\`\`\n${content}\n\`\`\``;
    panel.sendMessageToChat(message);

    vscode.window.showInformationMessage(`Sent "${filePath}" to chat`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to send file: ${error?.message ?? error}`);
  }
}

/**
 * Sends the active editor's file to chat
 */
async function sendActiveFileToChat(context: vscode.ExtensionContext): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found.');
      return;
    }

    const workspace = getActiveWorkspaceFolder();
    if (!workspace) {
      vscode.window.showWarningMessage('No workspace folder open.');
      return;
    }

    // Get relative path
    const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const content = editor.document.getText();

    // Open chat if not already open
    const panel = ChatPanel.open(context);

    // Send to chat with context
    const message = `Here is the content of file "${relativePath}":\n\n\`\`\`\n${content}\n\`\`\``;
    panel.sendMessageToChat(message);

    vscode.window.showInformationMessage(`Sent "${relativePath}" to chat`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to send file: ${error?.message ?? error}`);
  }
}

/**
 * Lists workspace files and sends to chat
 */
async function listWorkspaceFilesCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const workspace = getActiveWorkspaceFolder();
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

    if (dirPath === undefined) return;

    // Ask if recursive
    const recursive = await vscode.window.showQuickPick(
      ['No', 'Yes (max depth 3)'],
      {
        placeHolder: 'List files recursively?',
        title: 'Recursive Listing'
      }
    );

    if (!recursive) return;

    const options = {
      recursive: recursive.startsWith('Yes'),
      maxDepth: 3
    };

    // List files
    const files = await listWorkspaceFiles(dirPath, options);

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
    const panel = ChatPanel.open(context);
    panel.sendMessageToChat(output);

    vscode.window.showInformationMessage(`Listed ${files.length} files`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to list files: ${error?.message ?? error}`);
  }
}

/**
 * Gets workspace info and sends to chat
 */
async function getWorkspaceInfoCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const metadata = await getWorkspaceMetadata();

    // Format output
    let output = `Workspace Information:\n\n`;
    output += `Name: ${metadata.name}\n`;
    output += `Path: ${metadata.path}\n`;
    output += `Has Git: ${metadata.hasGit ? 'Yes' : 'No'}\n`;
    output += `Has package.json: ${metadata.hasPackageJson ? 'Yes' : 'No'}\n`;

    // Open chat and send
    const panel = ChatPanel.open(context);
    panel.sendMessageToChat(output);

    vscode.window.showInformationMessage('Workspace info sent to chat');
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to get workspace info: ${error?.message ?? error}`);
  }
}

/**
 * Searches for files and sends results to chat
 */
async function searchFilesCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const workspace = getActiveWorkspaceFolder();
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

    if (!pattern) return;

    // Search files
    const files = await findFilesInWorkspace(pattern, 100);

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
    const panel = ChatPanel.open(context);
    panel.sendMessageToChat(output);

    vscode.window.showInformationMessage(`Found ${files.length} files`);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to search files: ${error?.message ?? error}`);
  }
}
