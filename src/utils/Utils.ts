export default class Utils {
  /**
   * Trims the string and replaces all multiple (sequential) whitespace characters (e.g. spaces, tabs, line feed, ...) with a single space
   */
  public static normalizeWhitespaceChars(str: string): string {
    return str.trim().replace(/\s\s+/g, ' ');
  }
}
