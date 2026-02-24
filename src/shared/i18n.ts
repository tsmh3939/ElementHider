/**
 * Chrome i18n API のラッパー
 */

/** chrome.i18n.getMessage のショートハンド。キーが見つからない場合はキー名を返す。 */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key;
}
