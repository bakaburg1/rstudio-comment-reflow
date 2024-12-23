import * as vscode from 'vscode';

// Create output channel for logging
let outputChannel: vscode.OutputChannel;

/**
 * Represents a comment block with its prefix and content
 */
interface CommentBlock {
    prefix: string;
    content: string[];
    originalIndentation: string;
}

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

    // Log registered keybinding
    outputChannel.appendLine('Registered keybinding: ctrl+shift+BracketLeft');
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
            const roxyMatch = text.match(/^(\s*#'\s*)(.*)/);
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

/**
 * Reflows the comment block to fit within the specified width
 */
function reflowCommentBlock(block: CommentBlock, maxWidth: number): string {
    const actualMaxWidth = maxWidth - block.originalIndentation.length - block.prefix.length;
    let result = '';
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let inList = false;
    let isRoxygenTag = false;
    let lastRoxygenTag = '';

    // Process each line
    for (const line of block.content) {
        // Handle empty lines - they separate paragraphs
        if (line.trim().length === 0) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
            inList = false;
            isRoxygenTag = false;
            lastRoxygenTag = '';
            continue;
        }

        // Handle code blocks (marked with ```)
        if (line.trim().startsWith('```')) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            inCodeBlock = !inCodeBlock;
            result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
            continue;
        }

        // Don't reflow code blocks
        if (inCodeBlock) {
            result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
            continue;
        }

        // Handle Roxygen tags
        if (line.startsWith('@') && !line.startsWith('@@')) {
            const currentTag = line.split(/\s+/)[0]; // Get the tag part (e.g., @param, @return)
            
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                currentParagraph = [];
            }

            // Add a newline between different tags, but only if we're already in a Roxygen block
            if (isRoxygenTag && lastRoxygenTag && currentTag !== lastRoxygenTag) {
                result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
            }

            isRoxygenTag = true;
            lastRoxygenTag = currentTag;
            currentParagraph.push(line);
            continue;
        }

        // Handle bullet points
        if (line.match(/^\s*[-*]\s/)) {
            if (!inList && currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, false, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            inList = true;
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, true, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
            continue;
        }

        currentParagraph.push(line);
    }

    // Format any remaining paragraph
    if (currentParagraph.length > 0) {
        result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag);
    }

    return result.trimEnd();
}

/**
 * Formats a paragraph to fit within the specified width
 */
function formatParagraph(paragraph: string[], block: CommentBlock, maxWidth: number, isList: boolean, isRoxygenTag: boolean): string {
    // For Roxygen tags, preserve the tag at the start
    let prefix = '';
    let words: string[] = [];
    
    if (isRoxygenTag) {
        // Extract the tag part (e.g., "@param name") and the description
        const firstLine = paragraph[0];
        const tagMatch = firstLine.match(/^(@\w+(?:\s+\S+)?)/);
        
        if (tagMatch) {
            prefix = tagMatch[1] + ' ';
            // Remove the tag part from the first line and combine with rest
            const remainingText = firstLine.substring(prefix.length).trim() + ' ' + 
                                paragraph.slice(1).join(' ');
            words = remainingText.split(/\s+/).filter(w => w.length > 0);
        } else {
            words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);
        }
    } else {
        words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);
    }

    const lines: string[] = [];
    let currentLine = prefix; // Start with the Roxygen tag if present

    for (const word of words) {
        if (currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) <= maxWidth) {
            currentLine += (currentLine.length === 0 ? '' : ' ') + word;
        } else {
            if (currentLine.length > 0) {
                lines.push(currentLine.trimEnd());
            }
            // For continuation lines in Roxygen tags, add appropriate indentation
            currentLine = isRoxygenTag && lines.length > 0 ? '  ' + word : word;
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine.trimEnd());
    }

    // Format each line with the proper prefix and indentation and ensure no trailing spaces
    return lines
        .map(line => `${block.originalIndentation}${block.prefix}${line}`.trimEnd())
        .join('\n');
}

export function deactivate() {} 