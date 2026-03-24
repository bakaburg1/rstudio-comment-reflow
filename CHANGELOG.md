# Changelog

## 0.1.3

### Bug Fixes

- **@examples blocks**: Fixed major bug where `@examples` code was being reflowed like prose text. R code inside `@examples` blocks is now preserved exactly as written, including:
  - Indentation of function arguments
  - Nested code structure
  - Multiple separate example sections with empty lines
  - Tab and space indentation

- **Description to tag transition**: Added empty comment line (`#'`) between description paragraphs and the first roxygen tag (e.g., `@param`, `@return`), matching RStudio behavior.

- **Indentation preservation**: Fixed regex in `extractCommentBlock` to preserve indentation after `#'` prefix. Indented code like `#'   filename = temp_file,` now correctly preserves the leading spaces.

### Improvements

- **Code structure**: Extracted core reflow logic into separate `reflow.ts` module for better testability.

### Testing

- **Added 34 unit tests** covering:
  - Simple descriptions
  - @param tags
  - @return tags
  - Bullet lists
  - @examples blocks (the main bug fix)
  - Fenced code blocks (```)
  - Empty lines and paragraphs
  - Mixed content (comprehensive)
  - Edge cases
  - Description to tag transitions
  - Indentation preservation (spaces and tabs)
