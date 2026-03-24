import * as vscode from 'vscode';
import { reflowCommentBlock, CommentBlock } from './reflow';

// Create output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Activates the extension
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('RStudio Comment Reflow');
    outputChannel.show();
    
    outputChannel.appendLine('RStudio Comment Reflow extension is now active');
    outputChannel.appendLine(`OS: ${process.platform}`);

    let disposable = vscode.commands.registerCommand('rstudio-comment-reflow.reflowComment', () => {
        outputChannel.appendLine('Reflow Comment command triggered');
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            outputChannel.appendLine('No active editor found');
            return;
        }

        reflowComment(editor);
    });

    context.subscriptions.push(disposable);
}

/**
 * Main function to handle comment reflowing
 */
function reflowComment(editor: vscode.TextEditor) {
    outputChannel.appendLine('Starting comment reflow');
    
    const document = editor.document;
    const selection = editor.selection;
    const wordWrapColumn = vscode.workspace.getConfiguration('editor').get('wordWrapColumn', 80);

    outputChannel.appendLine(`Current file: ${document.fileName}`);
    outputChannel.appendLine(`Language ID: ${document.languageId}`);
    outputChannel.appendLine(`Selection: ${selection.start.line}-${selection.end.line}`);

    // Get the current line if no selection
    let startLine = selection.start.line;
    let endLine = selection.end.line;
    
    if (selection.isEmpty) {
        const line = document.lineAt(startLine);
        if (!isCommentLine(line.text, document.languageId)) {
            outputChannel.appendLine('Current line is not a comment line');
            return;
        }
    }

    // Find the complete comment block
    while (startLine > 0 && isCommentLine(document.lineAt(startLine - 1).text, document.languageId)) {
        startLine--;
    }
    while (endLine < document.lineCount - 1 && isCommentLine(document.lineAt(endLine + 1).text, document.languageId)) {
        endLine++;
    }

    const commentBlock = extractCommentBlock(document, startLine, endLine);
    if (!commentBlock) {
        return;
    }

    const reflowedText = reflowCommentBlock(commentBlock, wordWrapColumn);
    
    editor.edit(editBuilder => {
        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        );
        editBuilder.replace(range, reflowedText);
    });
}

/**
 * Checks if a line is a comment based on the language
 */
function isCommentLine(line: string, languageId: string): boolean {
    const trimmedLine = line.trim();
    switch (languageId) {
        case 'r':
            return trimmedLine.startsWith('#');
        case 'python':
            return trimmedLine.startsWith('#');
        case 'typescript':
        case 'javascript':
            return trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*');
        default:
            return trimmedLine.startsWith('#') || trimmedLine.startsWith('//') || trimmedLine.startsWith('*');
    }
}

/**
 * Extracts the comment block from the document
 */
function extractCommentBlock(document: vscode.TextDocument, startLine: number, endLine: number): CommentBlock | null {
    const lines = [];
    let prefix = '';
    let originalIndentation = '';
    let isRoxygen = false;

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        if (i === startLine) {
            // Detect if this is a Roxygen comment block
            isRoxygen = text.trim().startsWith("#'");
            // Detect the comment prefix and indentation from the first line
            const match = text.match(/^(\s*)([#']+\s*|\*\s+)/);
            if (!match) {
                return null;
            }
            originalIndentation = match[1];
            prefix = match[2];
        }

        // Remove the prefix and any leading/trailing whitespace
        let content = text;
        if (isRoxygen) {
            // Match roxygen prefix '#', trim exactly one space, preserve additional indentation
            const roxyMatch = text.match(/^(\s*#') ?(.*)/);
            if (roxyMatch) {
                content = roxyMatch[2];
            }
        } else {
            content = text.substring(text.indexOf(prefix) + prefix.length).trim();
        }
        
        lines.push(content);
    }

    return {
        prefix: isRoxygen ? "#' " : prefix,
        content: lines,
        originalIndentation
    };
}

export function deactivate() {} 