import * as Net from 'net';

export const HOSTNAME_PATTERN = /(?=^.{4,253}$)(^((?!-)[a-z0-9-]{0,62}[a-z0-9]\.)+[a-z]{2,63}\.?$)/i;
export const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/="?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export type HttpCheckResult = { valid: boolean, issue?: 'protocol' | 'port' | 'hostname' };

export default class Utils {
  /**
   * **Example usage**
   *
   * ```
   * formatStr('{0} ({0}) is {{0}} **{2}** using {1}!', ['Sprax', 'TypeScript']);
   * // Sprax (Sprax) is {0} **undefined** using TypeScript!
   * ```
   *
   * @param str The string to replace. Use `{i}` with `i` as the index. Escape using double brackets `{{i}}`
   * @param args An array of arguments to replace. Index 0 is used to replace `{0}`
   * @param fallbackValue The string to use if an index is not present in args-array. Defaults to `'undefined'`
   *
   * @author 0i0 (https://gist.github.com/0i0/1519811/5490acd26f8257189a3026f852d010a20636316c)
   */
  public static formatStr(str: string, args: string[], fallbackValue?: string) {
    return str.replace(/{{|}}|{(\d+)}/g, (curlyBracket, index) => {
      return ((curlyBracket == '{{') ? '{' : ((curlyBracket == '}}') ? '}' : args[index] ?? fallbackValue));
    });
  }

  /**
   * Return true if the given string only contains number characters.
   */
  public static isNumeric(str: string): boolean {
    return /^[0-9]+$/.test(str);
  }

  public static looksLikeHttpUrl(url: string): HttpCheckResult {
    // Protocol
    if (!/^https?:\/\/.*$/i.test(url)) {
      return {valid: false, issue: 'protocol'};
    }

    let lowerHost = url.toLowerCase().substring(url.indexOf('/') + 2);

    // Path
    if (lowerHost.indexOf('/') != -1) {
      lowerHost = lowerHost.substring(0, lowerHost.indexOf('/'));
    }

    // Port
    if (lowerHost.lastIndexOf(':') != -1) {
      const portStr = lowerHost.substring(lowerHost.lastIndexOf(':') + 1);
      const port = parseInt(portStr, 10);
      lowerHost = lowerHost.substring(0, lowerHost.lastIndexOf(':'));

      if (!Utils.isNumeric(portStr) || port <= 0 || port > 65535 /* unsigned int2 */) {
        return {valid: false, issue: 'port'};
      }
    }

    if (Net.isIPv4(lowerHost) || Net.isIPv6(lowerHost) || lowerHost == 'localhost') {
      return {valid: true};
    }

    const valid = HOSTNAME_PATTERN.test(lowerHost);

    if (valid) {
      return {valid};
    }

    return {valid, issue: 'hostname'};
  }

  public static looksLikeValidEmail(email: string): boolean {
    return EMAIL_PATTERN.test(email);
  }

  /**
   * Trims the string and replaces all multiple (sequential) whitespace characters (e.g. spaces, tabs, line feed, ...) with a single space
   */
  public static normalizeWhitespaceChars(str: string): string {
    return str.trim().replace(/\s\s+/g, ' ');
  }
}
