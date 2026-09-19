/**
 * Escape HTML Characters for Telegram's HTML parse mode.
 * `&` must be escaped first, otherwise the `&` in `&lt;`/`&gt;` gets
 * escaped again.
 * @param {string} str - The string with characters to escape
 * @return {string} Escaped strings
 */
export function toEscapeHTMLMsg(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
