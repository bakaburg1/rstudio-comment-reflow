import * as vscode from 'vscode';

/**
 * Output channel for logging extension events
 */
let outputChannel: vscode.OutputChannel;

/**
 * Represents a comment block with its prefix and content
 */
interface CommentBlock {
    /** The comment character or prefix used */
    prefix: string;
    /** The text content of the comment block */
    content: string[];
    /** The whitespace occurring before the comment prefix */
    originalIndentation: string;
    isCStyleBlock?: boolean;
    cStyleOpener?: string;
}

/**
 * Activates the extension
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('RStudio Comment Reflow');
    
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

    let reflowedText = reflowCommentBlock(commentBlock, wordWrapColumn);
    
    if (commentBlock.isCStyleBlock) {
        const opener = `${commentBlock.originalIndentation}${commentBlock.cStyleOpener}\n`;
        const closer = `\n${commentBlock.originalIndentation} */`;
        reflowedText = opener + reflowedText + closer;
    }

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
    let isCStyleBlock = false;
    let cStyleOpener = '/*';

    for (let i = startLine; i <= endLine; i++) {
        const line = document.lineAt(i);
        const text = line.text;

        if (i === startLine) {
            // Detect if this is a Roxygen comment block
            isRoxygen = text.trim().startsWith("#'");
            
            // Detect the comment prefix and indentation from the first line
            const match = text.match(/^(\s*)(\/\*+\s*|#'\s*|#+\s*|\/\/\s*|\*+\s+)/);
            if (!match) {
                return null;
            }
            
            originalIndentation = match[1];
            prefix = match[2];
            isCStyleBlock = prefix.includes('/*');
            
            if (isCStyleBlock) {
                cStyleOpener = prefix.trim(); // Capture whether it's /* or /**
                prefix = ' * '; // Standardize the prefix for the middle lines
            }
        }

        let content = text;
        
        if (isCStyleBlock) {
            // Avoid rewriting inline block comments that have code/text after the closer.
            if (/\*\/\s*\S/.test(text)) {
                return null;
            }

            // Skip standalone closing lines (we'll re-add the closer later)
            if (/^\s*\*\/\s*$/.test(text)) {
                continue; 
            }
            
            // Strip the closer if it's on the same line as text
            content = content.replace(/\*\/\s*$/, '');
            
            // Strip the opener on the first line, or the leading * on subsequent lines
            if (i === startLine) {
                const openerMatch = content.match(/^(\s*)(\/\*+\s*)/);
                if (openerMatch) {
                    content = content.substring(openerMatch[0].length);
                }
            } else {
                const starMatch = content.match(/^(\s*)\*+\s?(.*)$/);
                if (starMatch) {
                    // Remove leading '*' and at most one separator space,
                    // while preserving additional indentation as content.
                    content = starMatch[2];
                } else {
                    content = content.trimStart();
                }
            }
            content = content.trimEnd();
        } else if (isRoxygen) {
            // Match the prefix (#' plus up to one space) and capture the rest
            const roxyMatch = text.match(/^\s*#'\s?(.*)/);
            if (roxyMatch) {
                content = roxyMatch[1].trimEnd();
            }
        } else {
            content = text.substring(text.indexOf(prefix) + prefix.length).trim();
        }
        
        // Skip adding the first line if it was just the opening `/**` with no text
        if (isCStyleBlock && i === startLine && content === '') {
            continue;
        }
        
        lines.push(content);
    }

    return {
        prefix: isRoxygen ? "#' " : (isCStyleBlock ? " * " : prefix),
        content: lines,
        originalIndentation,
        isCStyleBlock,
        cStyleOpener
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
    let inExamples = false;
    let inList = false;
    let isRoxygenTag = false;
    let lastRoxygenTag = '';
    let macroDepth = 0;

    // Process each line
    for (const line of block.content) {
        const trimmedLine = line.trim();

        // Handle empty lines - they separate paragraphs
        if (trimmedLine.length === 0) {
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
        if (trimmedLine.startsWith('```')) {
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

        // Pre-calculate Roxygen tag information for the current line
        const isRoxygenBlock = block.prefix.startsWith("#'");
        const isNewTag = isRoxygenBlock && trimmedLine.startsWith('@') && !trimmedLine.startsWith('@@');
        const isUnindentedTag = line.startsWith('@');
        const isStructuralTag = isNewTag && isUnindentedTag;
        let currentTag = '';
        
        if (isStructuralTag) {
            currentTag = trimmedLine.split(/\s+/)[0];
            // Toggle examples state if a new tag is encountered
            if (!inExamples || isUnindentedTag) {
                inExamples = (currentTag === '@examples' || currentTag === '@examplesIf');
            }
        }

        // Track macro depth only when not inside `@examples`
        if (!inExamples) {
            const previousMacroDepth = macroDepth;
            const braces = line.match(/\{|\}/g);
            if (braces) {
                for (const brace of braces) {
                    if (brace === '{') macroDepth++;
                    else if (brace === '}') macroDepth--;
                }
            }
            if (macroDepth < 0) macroDepth = 0;

            // If currently inside a macro block, append directly without reflowing
            if (previousMacroDepth > 0 || macroDepth > 0) {
                if (currentParagraph.length > 0) {
                    result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                    currentParagraph = [];
                }
                result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
                continue;
            }
        }

        // Don't reflow examples block
        if (inExamples) {
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            
            // Retain the formatting logic for spacing out new tags
            if (isStructuralTag) {
                if (isRoxygenTag && lastRoxygenTag && currentTag !== lastRoxygenTag) {
                    result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
                }
                isRoxygenTag = true;
                lastRoxygenTag = currentTag;
            }

            result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
            continue;
        }

        // Handle Roxygen tags consistently
        if (isStructuralTag) {
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
            currentParagraph.push(trimmedLine);
            continue;
        }

        // Handle bullet points and numbered lists
        const isListItem = line.match(/^\s*([-*]|\d+\.)\s/);
        
        if (isListItem) {
            if (!inList && currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, false, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            inList = true;
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, true, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            currentParagraph.push(line);
            continue;
        } else if (inList) {
            // Reset list state if we encounter a completely unindented line
            if (line.length > 0 && !line.match(/^\s+/)) {
                if (currentParagraph.length > 0) {
                    result += formatParagraph(currentParagraph, block, actualMaxWidth, true, isRoxygenTag) + '\n';
                    currentParagraph = [];
                }
                inList = false;
            }
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
    let prefix = '';
    let listIndent = '';
    let words: string[] = [];

    if (isRoxygenTag) {
        // Extract the tag part (e.g., "@param name") and the description
        const firstLine = paragraph[0];
        const tagMatch = firstLine.match(/^(@\w+(?:\s+\S+)?)/);
        
        if (tagMatch) {
            prefix = tagMatch[1];
            // Remove the tag part from the first line and combine with rest
            const remainingText = firstLine.substring(prefix.length) + ' ' + paragraph.slice(1).join(' ');
            words = remainingText.split(/\s+/).filter(w => w.length > 0);
        } else {
            words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);
        }
    } else if (isList && paragraph.length > 0) {
        const firstLine = paragraph[0];
        // Match leading space, the marker, and trailing spaces
        const listMatch = firstLine.match(/^(\s*)([-*]|\d+\.)\s+/);
        
        if (listMatch) {
            const leadingSpace = listMatch[1];
            const marker = listMatch[2];
            prefix = leadingSpace + marker;
            
            // Calculate hanging indent: leading spaces + marker length + 1 space
            listIndent = ' '.repeat(leadingSpace.length + marker.length + 1);
            
            // Extract words from the text after the list marker
            const remainingText = firstLine.substring(listMatch[0].length) + ' ' + paragraph.slice(1).join(' ');
            words = remainingText.split(/\s+/).filter(w => w.length > 0);
        } else {
            words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);
        }
    } else {
        words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);
    }

    const lines: string[] = [];
    let currentLine = prefix; // Start with the prefix (Roxygen tag or list marker)

    for (const word of words) {
        // If the current line + word + space (if line is not empty) is less
        // than or equal to maxWidth, add the word to the current line
        if (currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) <= maxWidth) {
            // If the current line is empty, add the word without a space
            currentLine += (currentLine.length === 0 ? '' : ' ') + word;
        } else {
            // The current line is full, so add it to the lines array
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
            // For continuation lines, add appropriate indentation
            if (isRoxygenTag && lines.length > 0) {
                currentLine = '  ' + word;
            } else if (isList && lines.length > 0) {
                currentLine = listIndent + word;
            } else {
                currentLine = word;
            }
        }
    }

    // Add the last line if it's not empty
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    // Format each line with the proper prefix and indentation and ensure no trailing spaces
    return lines
        .map(line => `${block.originalIndentation}${block.prefix}${line}`.trimEnd())
        .join('\n');
}

/**
 * Deactivates the extension
 */
export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
