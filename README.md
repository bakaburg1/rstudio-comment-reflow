# RStudio Comment Reflow for VS Code

This extension brings RStudio's comment reflow functionality to Visual Studio Code. It provides intelligent comment reflowing that respects Roxygen documentation, markdown code blocks, and bullet points.

This extension adapts code from [Posit RStudio](https://github.com/rstudio/rstudio/), implementing their comment reflow functionality for VS Code users.

## Features

- Reflows comments to fit within the editor's word wrap column width
- Preserves Roxygen documentation tags and formatting
- Handles markdown code blocks (```) without reflowing their contents
- Preserves bullet points and lists
- Supports multiple programming languages (R, Python, TypeScript/JavaScript, and more)
- Maintains original comment indentation and prefixes

## Usage

1. Place your cursor inside a comment block or select multiple comment lines
2. Press `Cmd+Shift+/` (Mac) or `Ctrl+Shift+/` (Windows/Linux)
3. The comment will be reflowed to fit within your editor's word wrap column

## Configuration

The extension uses VS Code's `editor.wordWrapColumn` setting to determine the maximum line length. You can adjust this in your VS Code settings:

```json
{
    "editor.wordWrapColumn": 80
}
```

## Supported Comment Types

- R/Python style comments (#)
- JavaScript/TypeScript style comments (// and /* */)
- Roxygen documentation (@tags)
- Markdown code blocks
- Bullet points (- and *)

## Examples

### Basic Comment Reflow

Before:
```r
# This is a very long comment that exceeds the word wrap column and needs to be reflowed to make it more readable and conform to the specified width limit.
```

After:
```r
# This is a very long comment that exceeds the word wrap column and needs to be
# reflowed to make it more readable and conform to the specified width limit.
```

### Roxygen Documentation

Before:
```r
#' @param x A very long parameter description that exceeds the word wrap column and needs to be reflowed while preserving the Roxygen tag formatting.
#' @return Another long description that needs to be reflowed while maintaining proper documentation structure.
```

After:
```r
#' @param x A very long parameter description that exceeds the word wrap column
#'   and needs to be reflowed while preserving the Roxygen tag formatting.
#' @return Another long description that needs to be reflowed while maintaining
#'   proper documentation structure.
```

## Installation

### From VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux) to open the Extensions view
3. Search for "RStudio Comment Reflow"
4. Click Install
5. Reload VS Code when prompted

### Manual Installation

1. Download the latest `.vsix` file from the [releases page](https://github.com/bakaburg1/rstudio-comment-reflow/releases)
2. Open VS Code
3. Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux) to open the Extensions view
4. Click on the three dots (...) at the top of the Extensions view
5. Select "Install from VSIX..."
6. Navigate to the downloaded `.vsix` file and select it
7. Reload VS Code when prompted

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/bakaburg1/rstudio-comment-reflow.git
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the GNU Affero General Public License version 3 (AGPL-3.0). This is the same license used by RStudio, from which this extension adapts code.

The complete license text can be found in the [LICENSE](LICENSE) file. Additional attribution information is available in the [NOTICE](NOTICE) file.

## Acknowledgments

This extension adapts code from [Posit RStudio](https://github.com/rstudio/rstudio/). The comment reflow functionality is based on RStudio's implementation, and portions of the code are Copyright (C) Posit Software, PBC (formerly RStudio).

The original RStudio implementation can be found at:
- Repository: https://github.com/rstudio/rstudio/
- License: AGPL v3 