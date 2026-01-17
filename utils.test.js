// オンクラスエンハンサー - ユーティリティ関数テスト

const { escapeCsvField } = require('./utils');

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
