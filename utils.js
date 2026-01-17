// オンクラスエンハンサー - ユーティリティ関数

/**
 * 日付でフィードバックをフィルタリング
 * @param {Array} feedbacks - フィードバックの配列
 * @param {Object} filter - { start: string|null, end: string|null }
 * @returns {Array} フィルタリングされたフィードバック
 */
function filterByDate(feedbacks, filter) {
  if (!filter.start && !filter.end) return feedbacks;

  return feedbacks.filter(f => {
    if (!f.date) return true;
    const feedbackDate = f.date.replace(/\//g, '-');
    if (filter.start && feedbackDate < filter.start) return false;
    if (filter.end && feedbackDate > filter.end) return false;
    return true;
  });
}

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
  module.exports = { filterByDate, escapeCsvField };
}
