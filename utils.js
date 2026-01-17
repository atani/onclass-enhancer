// オンクラスエンハンサー - ユーティリティ関数

/**
 * CSVフィールドをエスケープ
 * @param {*} field - エスケープするフィールド
 * @returns {string} エスケープされた文字列
 */
function escapeCsvField(field) {
  if (!field) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Node.js環境（テスト用）でのエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeCsvField };
}
