import { NextFunction, Request, Response } from 'express';
import { isIPv4, isIPv6 } from 'net';

import { pageGenerator } from '..';
import { ApiError, ApiErrs } from './errors';

const FQDN_PATTERN = /^(?=.{1,253})(?!.*--.*)(?:(?![0-9-])[a-z0-9-]{1,63}(?<!-)\.){1,}(?:(?![0-9-])[a-z0-9-]{1,63}(?<!-))\.?$/i,
    EMAIL_PATTERN = /^[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

/**
 * **Example usage**
 *
 * ```
 * formatStr('{0} ({0}) is {{0}} **{2}** using {1}!', ['Sprax', 'TypeScript']);
 * // Sprax (Sprax) is {0} **undefined** using TypeScript!
 * ```
 *
 * @param str The string to replace. Use `{i}` with `i` as the index. Escape using double brackes `{{i}}`
 * @param args An array of arguments to replace. Index 0 is used to replace `{0}`
 * @param fallbackValue The string to use if an index is not present in args-array. Defaults to `'undefined'`
 *
 * @author 0i0 (https://gist.github.com/0i0/1519811/5490acd26f8257189a3026f852d010a20636316c)
 */
export function formatStr(str: string, args: string[], fallbackValue?: string) {
  return str.replace(/\{\{|\}\}|\{(\d+)\}/g, (curlyBrack, index) => {
    return ((curlyBrack == '{{') ? '{' : ((curlyBrack == '}}') ? '}' : args[index] ?? fallbackValue));
  });
}

/**
 * Checks if string only contains numbers (negative numbers are not allowed)
 */
export function isNumber(str: string): boolean {
  if (typeof str == 'number') return !Number.isNaN(str) && Number.isFinite(str);
  if (typeof str != 'string') return false;

  return /^[0-9]+$/.test(str);
}

export function isHttpURL(str: string): boolean {
  if (/^https?:\/\/.*$/i.test(str)) { // Starts with 'http(s)://'?
    let host = str.toLowerCase().substring(7 + (str.startsWith('https') ? 1 : 0));  // normalize and remove protocol

    if (host.indexOf('/') != -1) {
      host = host.substring(0, host.indexOf('/'));  // Remove path from url
    }

    // Valid port range?
    if (host.lastIndexOf(':') != -1) {
      const port = host.substring(host.lastIndexOf(':') + 1);
      host = host.substring(0, host.lastIndexOf(':'));

      if (!isNumber(port) || port == '0' || parseInt(port) > 65535 /* unsigned int2 */) return false;
    }

    return isIPv4(host) || isIPv6(host) || isValidFQDN(host);
  }

  return false;
}

/**
 * Checks if a given string is a valid FQDN (Domain) based on RFC1034 and RFC2181
 *
 * @author https://regex101.com/library/SuU6Iq
 */
export function isValidFQDN(str: string): boolean {
  return FQDN_PATTERN.test(str);
}

export function isValidEmail(str: string): boolean {
  return str.length > 5 && str.length < 256 && EMAIL_PATTERN.test(str);
}

/**
 * Replaces all multiple spaces, tabs, etc. with a single space
 *
 * **Replaces new lines (e.g. `\n`) with a space**
 */
export function toNeutralString(str: string) {
  return str.trim().replace(/\s\s+/g, ' ');
}

/**
 * This shortcut function responses with HTTP 405 to the requests having
 * a method that does not have corresponding request handler.
 *
 * For example if a resource allows only GET and POST requests then
 * PUT, DELETE, etc. requests will be responsed with the 405.
 *
 * HTTP 405 is required to have Allow-header set to a list of allowed
 * methods so in this case the response has "Allow: GET, POST, HEAD" in its headers.
 *
 * Example usage
 *
 *    // A handler that allows only GET (and HEAD) requests and returns
 *    app.all('/path', (req, res, next) => {
 *      restful(req, res, {
 *        get: () => {
 *          res.send('Hello world!');
 *        }
 *      });
 *    });
 *
 * Orignal author: https://stackoverflow.com/a/15754373/9346616
 */
export function restful(req: Request, res: Response, next: NextFunction, handlers: { [key: string]: () => void }): void {
  const method = (req.method || '').toLowerCase();

  if (method in handlers) return handlers[method]();
  if (method == 'head' && 'get' in handlers) return handlers['get']();

  const allowedMethods: string[] = Object.keys(handlers);
  if (!allowedMethods.includes('head')) {
    allowedMethods.push('head');
  }

  res.set('Allow', allowedMethods.join(', ').toUpperCase());
  return next(ApiError.create(ApiErrs.METHOD_NOT_ALLOWED, {allowedMethods}));
}

export function urlContainsLangKey(url: string): boolean {
  return url.match(/^\/[a-z]{2}(\/|$)/i) != null;
}

export function stripLangKeyFromURL(url: string): string {
  return urlContainsLangKey(url) ? (url.length == 3 ? '/' : url.substring(3)) : url;
}

export function stripParamsFromURL(url: string): string {
  return url.indexOf('?') == -1 ? url : url.substring(0, url.indexOf('?'));
}

export function appendParamToURL(url: string, key: string, value: string | null): string {
  if (value == null) return url;

  if (url.indexOf('?') == -1) {
    url += '?';
  } else if (!url.endsWith('?')) {
    url += '&';
  }

  return `${url}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function appendParamsToURL(url: string, params: { key: string, value: string | null }[]): string {
  params = params.filter((elem) => elem.value != null);
  if (params.length == 0) return url;

  if (url.indexOf('?') == -1) {
    url += '?';
  }

  let isFirstParam = url.endsWith('?');
  for (const param of params) {
    if (!isFirstParam) {
      url += '&';
    }

    url += `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value as string)}`;
    isFirstParam = false;
  }

  return url;
}

export function getReturnURL(req: Request): string | null {
  let returnStr = req.query.return;

  if (typeof returnStr != 'string') return null;

  returnStr = returnStr.trim();
  if (returnStr.length == 0 || returnStr.charAt(0) != '/') return null;

  return pageGenerator.globals.url.base + returnStr;
}
