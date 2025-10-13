/**
 * Webview script for Local LLM Chat
 * Security: Uses textContent instead of innerHTML to prevent XSS
 */

(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const messagesContainer = document.getElementById('messages');
  const inputElement = document.getElementById('input');
  const sendButton = document.getElementById('sendBtn');
  const clearButton = document.getElementById('clearBtn');

  /**
   * Escapes HTML to prevent XSS attacks
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Appends a message to the chat
   */
  function appendMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = role.toUpperCase();

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content; // Safe: uses textContent, not innerHTML

    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
  }

  /**
   * Displays an error message
   */
  function showError(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message error';

    const roleDiv = document.createElement('div');
    roleDiv.className = 'message-role';
    roleDiv.textContent = 'ERROR';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;

    messageDiv.appendChild(roleDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    scrollToBottom();
  }

  /**
   * Displays a file suggestion with create button
   */
  function suggestFile(filePath, content) {
    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = 'file-suggestion';

    // Header with file path and button
    const headerDiv = document.createElement('div');
    headerDiv.className = 'file-suggestion-header';

    const pathSpan = document.createElement('span');
    pathSpan.className = 'file-path';
    pathSpan.textContent = filePath; // Safe: textContent

    const createButton = document.createElement('button');
    createButton.textContent = 'Create / Overwrite';
    createButton.onclick = () => {
      vscode.postMessage({
        type: 'file:create',
        file: { path: filePath, content: content }
      });
    };

    headerDiv.appendChild(pathSpan);
    headerDiv.appendChild(createButton);

    // File preview
    const previewDiv = document.createElement('div');
    previewDiv.className = 'file-preview';
    previewDiv.textContent = content; // Safe: textContent

    suggestionDiv.appendChild(headerDiv);
    suggestionDiv.appendChild(previewDiv);
    messagesContainer.appendChild(suggestionDiv);

    scrollToBottom();
  }

  /**
   * Clears all messages from the chat
   */
  function clearMessages() {
    messagesContainer.innerHTML = '';
  }

  /**
   * Scrolls to the bottom of the messages container
   */
  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  /**
   * Sends a message to the extension
   */
  function sendMessage() {
    const text = inputElement.value.trim();
    if (!text) return;

    // Check for /write command
    if (text.startsWith('/write ')) {
      const firstNewline = text.indexOf('\n');
      if (firstNewline > 0) {
        const path = text.slice(7, firstNewline).trim();
        const content = text.slice(firstNewline + 1);

        if (path) {
          vscode.postMessage({
            type: 'file:create',
            file: { path: path, content: content }
          });

          appendMessage('user', text);
          appendMessage('assistant', `Proposed creating "${path}". A confirmation dialog will appear.`);
          inputElement.value = '';
          return;
        }
      }
    }

    // Regular chat message
    vscode.postMessage({
      type: 'chat:send',
      text: text
    });

    inputElement.value = '';
    inputElement.focus();
  }

  /**
   * Handles clear button click
   */
  function clearConversation() {
    vscode.postMessage({ type: 'chat:clear' });
  }

  /**
   * Handles messages from the extension
   */
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'chat:append':
        if (message.role && message.content) {
          appendMessage(message.role, message.content);
        }
        break;

      case 'chat:error':
        if (message.message) {
          showError(message.message);
        }
        break;

      case 'chat:clear':
        clearMessages();
        break;

      case 'file:suggest':
        if (message.file && message.file.path && message.file.content !== undefined) {
          suggestFile(message.file.path, message.file.content);
        }
        break;
    }
  });

  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  clearButton.addEventListener('click', clearConversation);

  inputElement.addEventListener('keydown', (event) => {
    // Ctrl+Enter or Cmd+Enter to send
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Focus input on load
  inputElement.focus();

})();
