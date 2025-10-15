# Local LLM for VS Code

<div align="center">

![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Ollama](https://img.shields.io/badge/Ollama-Compatible-000000?style=for-the-badge&logo=ollama&logoColor=white)
![LM Studio](https://img.shields.io/badge/LM%20Studio-Supported-FF6B6B?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A powerful VS Code extension for chatting with local Large Language Models directly in your editor—completely private and secure**

[Features](#features) • [Installation](#installation) • [Getting Started](#getting-started) • [Commands](#commands) • [Configuration](#configuration)

</div>

---
<img alt="image" width="70%" src="https://github.com/user-attachments/assets/6d5a2780-6800-4543-bafc-687b65c4d16d?raw=true" />

## Features

### 🤖 Local AI Chat
- **Privacy-First**: All data stays on your machine—no cloud APIs required
- **Multiple LLM Support**: Works with Ollama, LM Studio, vLLM, and OpenAI-compatible endpoints
- **Persistent Conversations**: Chat history is maintained throughout your session
- **Streaming Responses**: See AI responses in real-time as they're generated

### 📁 Workspace Integration
- **Read Files**: Load any workspace file into the conversation context
- **List Directories**: Browse your project structure directly from chat
- **Search Files**: Find files using glob patterns (e.g., `**/*.ts`)
- **Workspace Info**: Get metadata about your project (Git status, dependencies, etc.)
- **Smart Context**: Send active file or selected code to the AI instantly

### ✨ File Creation & Management
- **AI-Powered File Generation**: Let the AI create complete files based on your requirements
- **Syntax Detection**: Automatically detects file types and applies proper formatting
- **Safe Operations**: Confirmation prompts before creating/overwriting files
- **Selection to File**: Convert any code selection into a new file

### ⚡ Chat Commands
Built-in slash commands for quick actions:
- `/read <file-path>` - Read a file and add to conversation
- `/list [directory]` - List files in a directory
- `/search <pattern>` - Search for files with glob patterns
- `/workspace` - Show workspace information
- `/help` - Display all available commands

## Installation

### From VSIX File
1. Download the `.vsix` file from the [releases page](https://github.com/markusbegerow/local-llm-vscode/releases)
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
4. Click the `...` menu → `Install from VSIX...`
5. Select the downloaded `.vsix` file

### From Source
```bash
git clone https://github.com/markusbegerow/local-llm-vscode.git
cd local-llm-vscode
npm install
npm run compile
```

Then press `F5` in VS Code to launch the extension in debug mode.

## Getting Started

### 1. Set Up Your Local LLM

**Option A: Ollama** (Recommended)
```bash
# Install Ollama from https://ollama.ai
ollama pull llama3.1
ollama serve
```

**Option B: LM Studio**
1. Download from [lmstudio.ai](https://lmstudio.ai)
2. Load a model
3. Start the local server (default: `http://localhost:1234`)

### 2. Configure the Extension

Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and run:
```
Local LLM: Configure API Settings
```

Or manually configure in VS Code settings:
```json
{
  "localLLM.apiUrl": "http://localhost:11434",
  "localLLM.model": "llama3.1",
  "localLLM.apiCompat": "openai",
  "localLLM.temperature": 0.7
}
```

### 3. Start Chatting

1. Open Command Palette
2. Run: `Local LLM: Open Chat`
3. Start asking questions!

## Usage Examples

### Analyze Code
```
/read src/extension.ts
Can you explain how this extension works and suggest improvements?
```

### Explore Project Structure
```
/workspace
/list src
What is the architecture of this project?
```

### Generate Files
```
Create a TypeScript utility function that validates email addresses with proper error handling and unit tests.
```

The AI will suggest a file with path and content. Click "Create" to save it!

### Search and Refactor
```
/search **/*.ts
Find all TypeScript files, then help me refactor the error handling patterns across the project.
```

### Quick File Analysis
1. Open any file in the editor
2. Press `Ctrl+Shift+P`
3. Run: `Local LLM: Send Active File to Chat`
4. Ask questions about the code

## Commands

### Command Palette Commands
| Command | Description |
|---------|-------------|
| `Local LLM: Open Chat` | Open the chat panel |
| `Local LLM: Configure API Settings` | Set up your LLM connection |
| `Local LLM: Send Active File to Chat` | Send current file to chat |
| `Local LLM: Send File to Chat` | Browse and send any file to chat |
| `Local LLM: List Workspace Files` | List files in workspace |
| `Local LLM: Get Workspace Info` | Show workspace metadata |
| `Local LLM: Search Files` | Search files with glob patterns |
| `Local LLM: Clear Conversation History` | Reset the chat |
| `Local LLM: Create File From Selection` | Create new file from selection |

### In-Chat Slash Commands
| Command | Description | Example |
|---------|-------------|---------|
| `/read <path>` | Read file contents | `/read package.json` |
| `/list [dir]` | List directory files | `/list src` |
| `/search <pattern>` | Find files by pattern | `/search **/*.json` |
| `/workspace` | Show workspace info | `/workspace` |
| `/help` | Show all commands | `/help` |
| `/write <path>` | Create file inline | `/write test.js` |

## Configuration

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `localLLM.apiUrl` | `http://localhost:11434` | Base URL of your LLM API |
| `localLLM.model` | `llama3.1` | Model name to use |
| `localLLM.apiCompat` | `openai` | API compatibility (`openai` or `ollama`) |
| `localLLM.customEndpoint` | `""` | Full endpoint URL (optional) |
| `localLLM.temperature` | `0.7` | Sampling temperature (0.0-2.0) |
| `localLLM.maxTokens` | `2048` | Maximum response tokens |
| `localLLM.systemPrompt` | (default) | System prompt for the AI |
| `localLLM.maxHistoryMessages` | `50` | Max messages in history |
| `localLLM.requestTimeout` | `120000` | Request timeout (ms) |
| `localLLM.maxFileSize` | `1048576` | Max file size (bytes) |

### API Compatibility Modes

**OpenAI Compatible** (Recommended)
- LM Studio
- vLLM
- text-generation-webui
- Most modern LLM servers

```json
{
  "localLLM.apiCompat": "openai",
  "localLLM.apiUrl": "http://localhost:1234"
}
```

**Ollama Native**
```json
{
  "localLLM.apiCompat": "ollama",
  "localLLM.apiUrl": "http://localhost:11434"
}
```

## Security Features

- ✅ **Path Traversal Protection**: Prevents access outside workspace
- ✅ **File Size Limits**: Configurable maximum file sizes
- ✅ **Content Security Policy**: XSS protection in webviews
- ✅ **Secure Token Storage**: API keys stored in VS Code secrets
- ✅ **Confirmation Prompts**: Review before creating/overwriting files
- ✅ **Local-Only**: No external API calls unless you configure them

## Requirements

- **VS Code**: Version 1.85.0 or higher
- **Node.js**: Version 20.x or higher (for development)
- **Local LLM**: Ollama, LM Studio, or compatible server

## Development

### Building from Source

```bash
# Clone repository
git clone https://github.com/markusbegerow/local-llm-vscode.git
cd local-llm-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Package as VSIX
npm install -g @vscode/vsce
vsce package
```

### Project Structure

```
local-llm-vscode/
├── src/
│   ├── extension.ts      # Extension entry point
│   ├── chatPanel.ts      # Chat UI and logic
│   ├── llm.ts           # LLM API integration
│   ├── utils.ts         # Workspace utilities
│   └── types.ts         # TypeScript types
├── media/
│   └── webview.js       # Chat UI JavaScript
├── out/                 # Compiled JavaScript
├── package.json         # Extension manifest
└── tsconfig.json        # TypeScript config
```

## Troubleshooting

### Connection Issues
- Verify your LLM server is running: `curl http://localhost:11434/api/tags` (Ollama) or `curl http://localhost:1234/v1/models` (LM Studio)
- Check the API URL in settings matches your server
- Try switching API compatibility mode

### Chat Not Responding
- Check the Output panel (View → Output → Local LLM Chat) for errors
- Increase the request timeout in settings
- Verify your model is loaded in the LLM server

### File Operations Failing
- Ensure you have a workspace/folder open in VS Code
- Check file paths are relative (no absolute paths allowed)
- Verify file size limits in settings

## Recommended Models

### Coding Tasks
- **Llama 3.1 8B**: Fast, good for general coding
- **CodeLlama 13B**: Specialized for code generation
- **Qwen 2.5 Coder**: Excellent code understanding
- **DeepSeek Coder**: Strong at complex algorithms

### General Tasks
- **Llama 3.1**: Best all-around performance
- **Mistral 7B**: Fast and efficient
- **Phi-3**: Compact but capable

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to the Ollama team for making local LLMs accessible
- LM Studio for providing an excellent local inference platform
- The VS Code extension API team for comprehensive documentation

## 🙋‍♂️ Get Involved

If you encounter any issues or have questions:
- 🐛 [Report bugs](https://github.com/markusbegerow/local-llm-vscode/issues)
- 💡 [Request features](https://github.com/markusbegerow/local-llm-vscode/issues)
- ⭐ Star the repo if you find it useful!

## ☕ Support the Project

If you like this project, support further development with a repost or coffee:

<a href="https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/MarkusBegerow/local-llm-vscode" target="_blank"> <img src="https://img.shields.io/badge/💼-Share%20on%20LinkedIn-blue" /> </a>

[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-yellow)](https://paypal.me/MarkusBegerow?country.x=DE&locale.x=de_DE)

## 📬 Contact

- 🧑‍💻 [Markus Begerow](https://linkedin.com/in/markusbegerow)
- 💾 [GitHub](https://github.com/markusbegerow)
- ✉️ [Twitter](https://x.com/markusbegerow)

---

**Privacy Notice**: This extension operates entirely locally. No data is sent to external servers unless you explicitly configure it to use a remote API endpoint.
