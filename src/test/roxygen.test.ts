import * as assert from 'assert';
import { reflowCommentBlock, CommentBlock } from '../reflow';

/**
 * Helper to create a CommentBlock from a template literal
 * Handles dedenting and proper formatting
 */
function createBlock(content: string, maxWidth: number = 80): CommentBlock {
    // Remove leading/trailing empty lines and common indentation
    const lines = content.split('\n');
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

    // Find minimum indentation
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim().length > 0) {
            const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
            minIndent = Math.min(minIndent, indent);
        }
    }

    // Remove common indentation and strip the roxygen prefix
    const contentLines = lines.map(line => {
        if (line.trim().length === 0) return '';
        let processed = line.slice(minIndent);
        // Strip roxygen prefix '# or just #
        processed = processed.replace(/^#'\s?/, '');
        return processed;
    });

    return {
        prefix: "#' ",
        content: contentLines,
        originalIndentation: ''
    };
}

/**
 * Helper to normalize whitespace for comparison
 */
function normalize(text: string): string {
    return text.replace(/\r\n/g, '\n');
}

/**
 * Helper to format expected output as a template literal
 * Strips common indentation like createBlock does
 */
function expected(text: string): string {
    // Remove leading/trailing empty lines
    let lines = text.split('\n');
    while (lines.length > 0 && lines[0].trim() === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

    // Find minimum indentation
    let minIndent = Infinity;
    for (const line of lines) {
        if (line.trim().length > 0) {
            const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
            minIndent = Math.min(minIndent, indent);
        }
    }

    // Remove common indentation
    if (minIndent < Infinity && minIndent > 0) {
        lines = lines.map(line => {
            if (line.trim().length === 0) return '';
            return line.slice(minIndent);
        });
    }

    return lines.join('\n');
}

describe('Roxygen Comment Reflow', () => {

    describe('Simple Descriptions', () => {

        it('should reflow a single long line', () => {
            const block = createBlock(`
                #' This is a very long description that should be wrapped to fit within the specified column width limit
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This is a very long description that should be wrapped to fit within the
                #' specified column width limit
            `);

            assert.strictEqual(result, exp);
        });

        it('should preserve multiple short lines that fit', () => {
            const block = createBlock(`
                #' Short description.
                #' Another short line.
            `);

            const result = reflowCommentBlock(block, 80);
            // Lines are joined into a paragraph when they fit
            const exp = expected(`
                #' Short description. Another short line.
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle a long description spanning multiple lines', () => {
            const block = createBlock(`
                #' This function performs a complex calculation that involves multiple steps and various
                #' mathematical operations to produce the final result.
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This function performs a complex calculation that involves multiple steps and
                #' various mathematical operations to produce the final result.
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('@param Tags', () => {

        it('should handle @param with short description', () => {
            const block = createBlock(`
                #' @param x A numeric value
                #' @param y Another numeric value
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @param x A numeric value
                #' @param y Another numeric value
            `);

            assert.strictEqual(result, exp);
        });

        it('should reflow long @param descriptions', () => {
            const block = createBlock(`
                #' @param x A very long parameter description that needs to be wrapped to fit within the column width limit of the editor
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @param x A very long parameter description that needs to be wrapped to fit
                #'   within the column width limit of the editor
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle multiple @param tags with long descriptions', () => {
            const block = createBlock(`
                #' @param filename The path to the file where the output should be saved including the full directory structure
                #' @param format The output format which can be either csv or json or xml depending on your requirements
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @param filename The path to the file where the output should be saved
                #'   including the full directory structure
                #' @param format The output format which can be either csv or json or xml
                #'   depending on your requirements
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('@return Tags', () => {

        it('should handle @return with short description', () => {
            const block = createBlock(`
                #' @return A data frame
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @return A data frame
            `);

            assert.strictEqual(result, exp);
        });

        it('should reflow long @return descriptions', () => {
            const block = createBlock(`
                #' @return A data frame containing the processed results with columns for id name value and timestamp
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @return A data frame containing the processed results with columns for id
                #'   name value and timestamp
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('Bullet Lists', () => {

        it('should preserve bullet points', () => {
            const block = createBlock(`
                #' - First item
                #' - Second item
                #' - Third item
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' - First item
                #' - Second item
                #' - Third item
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle long bullet items', () => {
            const block = createBlock(`
                #' - This is a very long bullet point that should be preserved as a single line even if it exceeds the column width
            `);

            const result = reflowCommentBlock(block, 80);
            // Bullet points are preserved as-is
            assert.ok(result.includes('- This is a very long bullet point that should be preserved as a single line even if it exceeds the column width'));
        });

        it('should handle asterisk bullets', () => {
            const block = createBlock(`
                #' * First item with asterisk
                #' * Second item with asterisk
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' * First item with asterisk
                #' * Second item with asterisk
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('@examples Blocks', () => {

        it('should preserve @examples code formatting', () => {
            const block = createBlock(`
                #' @examples
                #' x <- 1
                #' y <- 2
                #' print(x + y)
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @examples
                #' x <- 1
                #' y <- 2
                #' print(x + y)
            `);

            assert.strictEqual(result, exp);
        });

        it('should preserve complex @examples with function calls', () => {
            const block = createBlock(`
                #' @examples
                #' temp_file <- fs::path(tempdir(), "render-figure-example.png")
                #' ggplot2::ggsave(
                #'   filename = temp_file,
                #'   plot = ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'     ggplot2::geom_point(),
                #'   width = 4,
                #'   height = 3,
                #'   dpi = 72
                #' )
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @examples
                #' temp_file <- fs::path(tempdir(), "render-figure-example.png")
                #' ggplot2::ggsave(
                #'   filename = temp_file,
                #'   plot = ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'     ggplot2::geom_point(),
                #'   width = 4,
                #'   height = 3,
                #'   dpi = 72
                #' )
            `);

            assert.strictEqual(result, exp);
        });

        it('should preserve @examples with nested function calls', () => {
            const block = createBlock(`
                #' @examples
                #' plot_obj <- ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'   ggplot2::geom_point()
                #' plot_obj@meta$fig_path <- temp_file
                #' plot_obj$summary_data_list <- list(
                #'   rank = list(
                #'     data = tibble::tibble(country = c("AA", "BB"), pred = c(1, 2)),
                #'     col_desc = c(country = "Country", pred = "Prediction"),
                #'     title = "Expected incidence"
                #'   ),
                #'   trend = list(
                #'     data = tibble::tibble(country = c("AA", "BB"), year = c(2020, 2021)),
                #'     col_desc = c(country = "Country", year = "Year"),
                #'     title = "Modelled trend"
                #'   )
                #' )
            `);

            const result = reflowCommentBlock(block, 80);

            // Verify specific lines are preserved exactly
            const lines = result.split('\n');
            assert.ok(lines.some(l => l.includes("plot_obj <- ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg))")),
                "Should preserve multi-line ggplot call");
            assert.ok(lines.some(l => l.includes("rank = list(")),
                "Should preserve list structure");
            assert.ok(lines.some(l => l.includes('title = "Expected incidence"')),
                "Should preserve string literals");
        });

        it('should preserve @examples with indentation', () => {
            const block = createBlock(`
                #' @examples
                #' if (TRUE) {
                #'   x <- 1
                #'   y <- 2
                #' }
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @examples
                #' if (TRUE) {
                #'   x <- 1
                #'   y <- 2
                #' }
            `);

            assert.strictEqual(result, exp);
        });

        it('should end @examples block at next roxygen tag', () => {
            const block = createBlock(`
                #' @examples
                #' x <- 1
                #' y <- 2
                #' @return Nothing
            `);

            const result = reflowCommentBlock(block, 80);
            // Empty line is added between different tag sections
            const exp = expected(`
                #' @examples
                #' x <- 1
                #' y <- 2
                #'
                #' @return Nothing
            `);

            assert.strictEqual(result, exp);
        });

        it('should preserve long lines in @examples without wrapping', () => {
            const block = createBlock(`
                #' @examples
                #' very_long_variable_name <- some_function_with_a_very_long_name(argument_one, argument_two, argument_three, argument_four)
            `);

            const result = reflowCommentBlock(block, 80);

            // The line should NOT be wrapped - it should stay as one line
            assert.ok(result.includes("very_long_variable_name <- some_function_with_a_very_long_name(argument_one, argument_two, argument_three, argument_four)"),
                "Should not wrap long lines in @examples");
        });
    });

    describe('Code Blocks (```)', () => {

        it('should preserve fenced code blocks', () => {
            const block = createBlock(`
                #' Some description
                #' \`\`\`r
                #' x <- 1
                #' y <- 2
                #' \`\`\`
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' Some description
                #' \`\`\`r
                #' x <- 1
                #' y <- 2
                #' \`\`\`
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('Empty Lines and Paragraphs', () => {

        it('should preserve empty lines between sections', () => {
            const block = createBlock(`
                #' First paragraph with some text.
                #'
                #' Second paragraph with more text.
            `);

            const result = reflowCommentBlock(block, 80);
            const lines = result.split('\n');

            // Should have an empty comment line between paragraphs
            assert.ok(lines.some(l => l === "#'"),
                "Should preserve empty comment line between paragraphs");
        });

        it('should handle multiple empty lines', () => {
            const block = createBlock(`
                #' First section.
                #'
                #' Second section.
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' First section.
                #'
                #' Second section.
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('Mixed Content (Comprehensive)', () => {

        it('should handle a complete roxygen block with all elements', () => {
            const block = createBlock(`
                #' Create a plot with custom styling
                #'
                #' This function creates a ggplot2 plot with custom styling options
                #' including colors labels and themes for publication-quality figures.
                #'
                #' @param data A data frame containing the data to plot
                #' @param x The name of the column to use for the x-axis as a string
                #' @param y The name of the column to use for the y-axis as a string
                #' @param color The name of the column to use for coloring points
                #' @param title The plot title as a character string
                #' @param subtitle The plot subtitle as a character string
                #' @param caption The plot caption as a character string
                #'
                #' @return A ggplot2 object that can be further modified or printed
                #'
                #' @details
                #' This function wraps ggplot2::ggplot and applies a default theme
                #' suitable for academic publications.
                #'
                #' @examples
                #' temp_file <- fs::path(tempdir(), "render-figure-example.png")
                #' ggplot2::ggsave(
                #'   filename = temp_file,
                #'   plot = ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'     ggplot2::geom_point(),
                #'   width = 4,
                #'   height = 3,
                #'   dpi = 72
                #' )
                #' plot_obj <- ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'   ggplot2::geom_point()
            `);

            const result = reflowCommentBlock(block, 80);
            const lines = result.split('\n');

            // Verify description is present and reflowed
            assert.ok(lines.some(l => l.includes('This function creates a ggplot2 plot with custom styling')),
                "Description should be present");

            // Verify @param tags are preserved
            assert.ok(lines.some(l => l.includes('@param data A data frame')),
                "@param data should be preserved");
            assert.ok(lines.some(l => l.includes('@param x The name of the column')),
                "@param x should be preserved");

            // Verify @return is preserved
            assert.ok(lines.some(l => l.includes('@return A ggplot2 object')),
                "@return should be preserved");

            // Verify @examples code is NOT collapsed
            assert.ok(lines.some(l => l.includes('temp_file <- fs::path(tempdir(), "render-figure-example.png")')),
                "@examples first line should be preserved");
            assert.ok(lines.some(l => l.includes('ggplot2::ggsave(')),
                "@examples ggsave call should be preserved");
            assert.ok(lines.some(l => l.includes('filename = temp_file,')),
                "@examples ggsave arguments should be on separate lines");
            assert.ok(lines.some(l => l.includes('width = 4,')),
                "@examples ggsave width should be preserved");
            assert.ok(lines.some(l => l.includes('height = 3,')),
                "@examples ggsave height should be preserved");
            assert.ok(lines.some(l => l.includes('dpi = 72')),
                "@examples ggsave dpi should be preserved");
            assert.ok(lines.some(l => l.includes(')')),
                "@examples closing paren should be preserved");
            assert.ok(lines.some(l => l.includes('plot_obj <- ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg))')),
                "@examples plot_obj should be preserved");

            // Verify examples are NOT collapsed into fewer lines
            const exampleLines = lines.filter(l => l.includes("#'") && !l.includes('@') && !l.includes('ggplot2::ggsave('));
            // We should have multiple lines for the examples, not collapsed
            assert.ok(lines.length > 15, "Should have many lines, not collapsed");
        });

        it('should handle roxygen with indented code context', () => {
            const block = createBlock(`
                #' Function description here.
                #' @param x Input value.
                #' @return Processed value.
                #' @examples
                #' result <- my_function(42)
                #' print(result)
            `);
            block.originalIndentation = '    ';

            const result = reflowCommentBlock(block, 80);
            const lines = result.split('\n');

            // All lines should start with the indentation
            lines.forEach(line => {
                if (line.trim().length > 0) {
                    assert.ok(line.startsWith('    #'),
                        `Line should be indented: "${line}"`);
                }
            });
        });

        it('should handle @examples followed by @export', () => {
            const block = createBlock(`
                #' My function
                #' @param x A value
                #' @examples
                #' x <- 1
                #' print(x)
                #' @export
            `);

            const result = reflowCommentBlock(block, 80);
            // Empty line is added between description and first tag, and between tag sections
            const exp = expected(`
                #' My function
                #'
                #' @param x A value
                #'
                #' @examples
                #' x <- 1
                #' print(x)
                #'
                #' @export
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle @examples followed by empty line then another tag', () => {
            const block = createBlock(`
                #' My function
                #' @param x A value
                #' @examples
                #' x <- 1
                #' print(x)
                #'
                #' @return Nothing
            `);

            const result = reflowCommentBlock(block, 80);
            // Empty line is added between description and first tag, and preserved between tag sections
            const exp = expected(`
                #' My function
                #'
                #' @param x A value
                #'
                #' @examples
                #' x <- 1
                #' print(x)
                #'
                #' @return Nothing
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('Edge Cases', () => {

        it('should handle empty roxygen block', () => {
            const block = createBlock(`
                #' This is a comment
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This is a comment
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle @ with escaped @@', () => {
            const block = createBlock(`
                #' Use @@ to escape at signs in roxygen
            `);

            const result = reflowCommentBlock(block, 80);
            // @@ should not be treated as a tag
            assert.ok(result.includes('@@'));
        });

        it('should handle @examples with no code', () => {
            const block = createBlock(`
                #' @examples
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' @examples
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle very long @examples lines', () => {
            const block = createBlock(`
                #' @examples
                #' result <- very_long_function_name(argument_with_long_name, another_long_argument, yet_another_argument, final_argument_that_makes_the_line_very_long)
            `);

            const result = reflowCommentBlock(block, 80);

            // Should NOT wrap the line
            assert.ok(result.includes("result <- very_long_function_name"),
                "Long examples line should not be wrapped");
        });
    });

    describe('Description to Tag Transition', () => {

        it('should add empty line between description and first @param', () => {
            const block = createBlock(`
                #' This is a function description
                #' @param x A value
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This is a function description
                #'
                #' @param x A value
            `);

            assert.strictEqual(result, exp);
        });

        it('should add empty line between description and @return when no @param', () => {
            const block = createBlock(`
                #' This is a function description
                #' @return A value
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This is a function description
                #'
                #' @return A value
            `);

            assert.strictEqual(result, exp);
        });

        it('should handle full roxygen with proper spacing', () => {
            const block = createBlock(`
                #' This is a very long description that should be wrapped to fit within the specified column width limit of the editor
                #' @param x A numeric value that represents the input parameter for this function
                #' @return A data frame
            `);

            const result = reflowCommentBlock(block, 80);
            const exp = expected(`
                #' This is a very long description that should be wrapped to fit within the
                #' specified column width limit of the editor
                #'
                #' @param x A numeric value that represents the input parameter for this
                #'   function
                #'
                #' @return A data frame
            `);

            assert.strictEqual(result, exp);
        });
    });

    describe('Examples Indentation', () => {

        it('should preserve indentation in @examples', () => {
            const block = createBlock(`
                #' @examples
                #' ggplot2::ggsave(
                #'   filename = temp_file,
                #'   width = 4,
                #'   height = 3
                #' )
            `);

            const result = reflowCommentBlock(block, 80);

            // Check that indented lines preserve their indentation
            assert.ok(result.includes("#'   filename = temp_file,"),
                "Should preserve indentation for filename line");
            assert.ok(result.includes("#'   width = 4,"),
                "Should preserve indentation for width line");
            assert.ok(result.includes("#'   height = 3"),
                "Should preserve indentation for height line");
        });

        it('should preserve nested indentation in @examples', () => {
            const block = createBlock(`
                #' @examples
                #' ggplot2::ggsave(
                #'   filename = temp_file,
                #'   plot = ggplot2::ggplot(mtcars, ggplot2::aes(wt, mpg)) +
                #'     ggplot2::geom_point(),
                #'   width = 4
                #' )
            `);

            const result = reflowCommentBlock(block, 80);

            // Check nested indentation is preserved
            assert.ok(result.includes("#'     ggplot2::geom_point(),"),
                "Should preserve nested indentation");
        });

        it('should preserve indentation with tabs', () => {
            const block = createBlock(`
                #' @examples
                #' if (TRUE) {
                #' \tx <- 1
                #' \ty <- 2
                #' }
            `);

            const result = reflowCommentBlock(block, 80);

            // Tab should be preserved (space after #' then tab)
            assert.ok(result.includes("#' \tx <- 1"),
                "Should preserve tab indentation");
        });
    });
});
