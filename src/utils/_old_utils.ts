import { NextFunction, Request, Response } from 'express';
import { getCfg, getPageGenerator } from '../Constants';
import { ApiError } from './ApiError';
import ApiErrs from './ApiErrs';

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


  return getPageGenerator().globals.url.base + returnStr;
}

export function getPartOfSecret(maxLength: number = 1024): Buffer {
  return Buffer.from(getCfg().data.secret, 'base64').subarray(0, maxLength);
}
