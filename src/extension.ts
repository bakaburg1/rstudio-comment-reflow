import * as vscode from 'vscode';

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
    let disposable = vscode.commands.registerCommand('rstudio-comment-reflow.reflowComment', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
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
    const document = editor.document;
    const selection = editor.selection;
    const wordWrapColumn = vscode.workspace.getConfiguration('editor').get('wordWrapColumn', 80);

    // Get the current line if no selection
    let startLine = selection.start.line;
    let endLine = selection.end.line;
    
    if (selection.isEmpty) {
        const line = document.lineAt(startLine);
        if (!isCommentLine(line.text, document.languageId)) {
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

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        if (i === startLine) {
            // Detect the comment prefix and indentation from the first line
            const match = text.match(/^(\s*)([#/*]+\s*|\*\s+)/);
            if (!match) {
                return null;
            }
            originalIndentation = match[1];
            prefix = match[2];
        }

        // Remove the prefix and any leading/trailing whitespace
        let content = text.substring(text.indexOf(prefix) + prefix.length).trim();
        
        // Handle Roxygen tags
        if (content.startsWith('@') && !content.startsWith('@@')) {
            // Start a new paragraph for Roxygen tags
            if (lines.length > 0) {
                lines.push('');
            }
        }

        lines.push(content);
    }

    return {
        prefix,
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

    // Process each line
    for (const line of block.content) {
        // Handle empty lines - they separate paragraphs
        if (line.trim().length === 0) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList) + '\n';
                currentParagraph = [];
            }
            result += block.originalIndentation + block.prefix + '\n';
            inList = false;
            continue;
        }

        // Handle code blocks (marked with ```)
        if (line.trim().startsWith('```')) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList) + '\n';
                currentParagraph = [];
            }
            inCodeBlock = !inCodeBlock;
            result += block.originalIndentation + block.prefix + line + '\n';
            continue;
        }

        // Don't reflow code blocks
        if (inCodeBlock) {
            result += block.originalIndentation + block.prefix + line + '\n';
            continue;
        }

        // Handle Roxygen tags
        if (line.startsWith('@') && !line.startsWith('@@')) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList) + '\n';
                currentParagraph = [];
            }
            currentParagraph.push(line);
            continue;
        }

        // Handle bullet points
        if (line.match(/^\s*[-*]\s/)) {
            if (!inList && currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, false) + '\n';
                currentParagraph = [];
            }
            inList = true;
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, true) + '\n';
                currentParagraph = [];
            }
            result += block.originalIndentation + block.prefix + line + '\n';
            continue;
        }

        currentParagraph.push(line);
    }

    // Format any remaining paragraph
    if (currentParagraph.length > 0) {
        result += formatParagraph(currentParagraph, block, actualMaxWidth, inList);
    }

    return result.trimEnd();
}

/**
 * Formats a paragraph to fit within the specified width
 */
function formatParagraph(paragraph: string[], block: CommentBlock, maxWidth: number, isList: boolean): string {
    // Join all lines and split into words
    const words = paragraph.join(' ').split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxWidth) {
            currentLine += (currentLine.length === 0 ? '' : ' ') + word;
        } else {
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
            currentLine = word;
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // Format each line with the proper prefix and indentation
    return lines
        .map(line => `${block.originalIndentation}${block.prefix}${line}`)
        .join('\n');
}

export function deactivate() {} 