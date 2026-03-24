/**
 * Core comment reflow logic - pure functions with no VS Code dependencies
 */

/**
 * Represents a comment block with its prefix and content
 */
export interface CommentBlock {
    prefix: string;
    content: string[];
    originalIndentation: string;
}

/**
 * Reflows the comment block to fit within the specified width
 */
export function reflowCommentBlock(block: CommentBlock, maxWidth: number): string {
    const actualMaxWidth = maxWidth - block.originalIndentation.length - block.prefix.length;
    let result = '';
    let currentParagraph: string[] = [];
    let inCodeBlock = false;
    let inList = false;
    let isRoxygenTag = false;
    let lastRoxygenTag = '';
    let inExamples = false;
    let hadNonTagContent = false;

    // Process each line
    for (const line of block.content) {
        // Handle empty lines - they separate paragraphs
        if (line.trim().length === 0) {
            // If we're in @examples, output empty line and continue preserving
            if (inExamples) {
                result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
                continue;
            }
            if (currentParagraph.length > 0) {
                result += formatParagraph(currentParagraph, block, actualMaxWidth, inList, isRoxygenTag) + '\n';
                currentParagraph = [];
            }
            result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
            inList = false;
            isRoxygenTag = false;
            lastRoxygenTag = '';
            hadNonTagContent = false;
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

            // Add empty line when transitioning from description to tags
            if (hadNonTagContent && !isRoxygenTag) {
                result += (block.originalIndentation + block.prefix).trimEnd() + '\n';
            }
            // Add a newline between different tags, but skip if last line was already empty
            else if (isRoxygenTag && lastRoxygenTag && currentTag !== lastRoxygenTag) {
                const emptyLine = (block.originalIndentation + block.prefix).trimEnd();
                if (!result.endsWith(emptyLine + '\n')) {
                    result += emptyLine + '\n';
                }
            }

            // Any new tag ends @examples mode
            inExamples = false;
            isRoxygenTag = true;
            lastRoxygenTag = currentTag;

            // @examples tag: output directly and set inExamples mode
            if (currentTag === '@examples') {
                inExamples = true;
                result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
            } else {
                currentParagraph.push(line);
            }
            continue;
        }

        // If we're inside an @examples block, preserve the code as-is
        if (inExamples) {
            result += (block.originalIndentation + block.prefix + line).trimEnd() + '\n';
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
        // Track that we have non-tag content (description)
        if (!line.startsWith('@')) {
            hadNonTagContent = true;
        }
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

    words = paragraph.join(' ').split(/\s+/).filter(w => w.length > 0);

    if (isRoxygenTag) {
        // Extract the tag part (e.g., "@param name") and the description
        const firstLine = paragraph[0];
        const tagMatch = firstLine.match(/^(@\w+(?:\s+\S+)?)/);

        if (tagMatch) {
            prefix = tagMatch[1];

            // Remove the tag part from the first line and combine with rest
            const remainingText = firstLine.substring(prefix.length) + ' ' +
                                paragraph.slice(1).join(' ');
            words = remainingText.split(/\s+/).filter(w => w.length > 0);
        }
    }

    const lines: string[] = [];
    let currentLine = prefix; // Start with the Roxygen tag if present

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
            // For continuation lines in Roxygen tags, add appropriate
            // indentation
            currentLine = isRoxygenTag && lines.length > 0 ? '  ' + word : word;
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
