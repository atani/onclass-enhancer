// オンクラスエンハンサー - ユーティリティ関数テスト

const { filterByDate, escapeCsvField } = require('./utils');

describe('filterByDate', () => {
  const feedbacks = [
    { id: 1, date: '2024/01/15', content: 'テスト1' },
    { id: 2, date: '2024/02/20', content: 'テスト2' },
    { id: 3, date: '2024/03/25', content: 'テスト3' },
    { id: 4, date: '', content: 'テスト4（日付なし）' }
  ];

  test('フィルタなしの場合は全件返す', () => {
    const result = filterByDate(feedbacks, { start: null, end: null });
    expect(result).toHaveLength(4);
  });

  test('開始日のみ指定', () => {
    const result = filterByDate(feedbacks, { start: '2024-02-01', end: null });
    expect(result).toHaveLength(3); // 2月以降 + 日付なし
    expect(result.map(f => f.id)).toContain(2);
    expect(result.map(f => f.id)).toContain(3);
    expect(result.map(f => f.id)).toContain(4);
  });

  test('終了日のみ指定', () => {
    const result = filterByDate(feedbacks, { start: null, end: '2024-02-28' });
    expect(result).toHaveLength(3); // 2月以前 + 日付なし
    expect(result.map(f => f.id)).toContain(1);
    expect(result.map(f => f.id)).toContain(2);
    expect(result.map(f => f.id)).toContain(4);
  });

  test('期間指定（両方）', () => {
    const result = filterByDate(feedbacks, { start: '2024-02-01', end: '2024-02-28' });
    expect(result).toHaveLength(2); // 2月のみ + 日付なし
    expect(result.map(f => f.id)).toContain(2);
    expect(result.map(f => f.id)).toContain(4);
  });

  test('日付なしのフィードバックは常に含まれる', () => {
    const result = filterByDate(feedbacks, { start: '2024-12-01', end: '2024-12-31' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });
});

describe('escapeCsvField', () => {
  test('通常の文字列はそのまま返す', () => {
    expect(escapeCsvField('テスト')).toBe('テスト');
  });

  test('カンマを含む場合はダブルクォートで囲む', () => {
    expect(escapeCsvField('テスト,データ')).toBe('"テスト,データ"');
  });

  test('ダブルクォートを含む場合はエスケープ', () => {
    expect(escapeCsvField('テスト"データ')).toBe('"テスト""データ"');
  });

  test('改行を含む場合はダブルクォートで囲む', () => {
    expect(escapeCsvField('テスト\nデータ')).toBe('"テスト\nデータ"');
  });

  test('nullやundefinedは空文字を返す', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  test('数値は文字列に変換', () => {
    expect(escapeCsvField(123)).toBe('123');
  });
});
