// オンクラスエンハンサー - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // 設定要素
  const autoCategoryMoveToggle = document.getElementById('autoCategoryMove');

  // エクスポート要素
  const pageStatus = document.getElementById('pageStatus');
  const totalPagesEl = document.getElementById('totalPages');
  const exportAllBtn = document.getElementById('exportAllBtn');
  const exportCurrentBtn = document.getElementById('exportCurrentBtn');
  const exportFormat = document.getElementById('exportFormat');
  const startDate = document.getElementById('startDate');
  const endDate = document.getElementById('endDate');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const helpBtn = document.getElementById('helpBtn');

  // 折りたたみ
  const exportHeader = document.getElementById('exportHeader');
  const exportContent = document.getElementById('exportContent');

  // 設定を読み込み
  const settings = await chrome.storage.sync.get({
    autoCategoryMove: false
  });
  autoCategoryMoveToggle.checked = settings.autoCategoryMove;

  // 設定変更を保存
  autoCategoryMoveToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({
      autoCategoryMove: autoCategoryMoveToggle.checked
    });
  });

  // 折りたたみ機能
  exportHeader.addEventListener('click', () => {
    exportHeader.classList.toggle('collapsed');
    exportContent.classList.toggle('collapsed');
  });

  // 現在のタブを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOnclassPage = tab.url?.includes('manager.the-online-class.com');

  // ページステータスを更新
  if (isOnclassPage) {
    pageStatus.textContent = 'オンクラス管理画面 ✓';
    pageStatus.classList.add('ok');
    exportAllBtn.disabled = false;
    exportCurrentBtn.disabled = false;

    // 総ページ数を取得
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'content.js']
      });
      await new Promise(r => setTimeout(r, 200));

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
      if (response?.info?.totalPages) {
        totalPagesEl.textContent = `${response.info.totalPages} ページ`;
      }
    } catch (e) {
      console.log('Could not get page info:', e);
    }
  } else {
    pageStatus.textContent = '対象外のページ';
    pageStatus.classList.add('error');
    exportAllBtn.disabled = true;
    exportCurrentBtn.disabled = true;
  }

  // 全ページ一括取得
  exportAllBtn.addEventListener('click', async () => {
    const dateFilter = getDateFilter();

    exportAllBtn.disabled = true;
    exportCurrentBtn.disabled = true;
    loading.style.display = 'block';
    result.style.display = 'none';

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'content.js']
      });
      await new Promise(r => setTimeout(r, 100));

      // 全ページ取得を開始
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'exportAllPages',
        dateFilter: dateFilter
      });

      if (response?.started) {
        showResult('エクスポートを開始しました。ページ上の進捗バーをご確認ください。');
      } else if (response?.error) {
        showResult(response.error, true);
      }
    } catch (error) {
      console.error('Export error:', error);
      showResult(`エラー: ${error.message}`, true);
    } finally {
      loading.style.display = 'none';
      exportAllBtn.disabled = false;
      exportCurrentBtn.disabled = false;
    }
  });

  // このページのみ
  exportCurrentBtn.addEventListener('click', async () => {
    const dateFilter = getDateFilter();

    exportAllBtn.disabled = true;
    exportCurrentBtn.disabled = true;
    loading.style.display = 'block';
    result.style.display = 'none';

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'content.js']
      });
      await new Promise(r => setTimeout(r, 100));

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractFeedbacks',
        dateFilter: dateFilter
      });
      let feedbacks = response?.feedbacks || [];

      // 日付フィルタリング（クライアント側でも）
      if (dateFilter.start || dateFilter.end) {
        feedbacks = filterByDate(feedbacks, dateFilter);
      }

      if (feedbacks.length === 0) {
        showResult('該当する感想データが見つかりませんでした。', true);
        return;
      }

      const format = exportFormat.value;
      if (format === 'json') {
        downloadJSON(feedbacks, tab.url);
      } else {
        downloadCSV(feedbacks);
      }

      showResult(`${feedbacks.length}件の感想をエクスポートしました！`);
    } catch (error) {
      console.error('Export error:', error);
      showResult(`エラー: ${error.message}`, true);
    } finally {
      loading.style.display = 'none';
      exportAllBtn.disabled = false;
      exportCurrentBtn.disabled = false;
    }
  });

  // ヘルプボタン
  helpBtn.addEventListener('click', () => {
    alert(
      '【機能設定】\n' +
      '・カテゴリ自動移動: ONにすると、新規作成したカテゴリが自動で先頭に移動します\n\n' +
      '【感想エクスポート】\n' +
      '1. オンクラス管理画面の感想ページを開く\n' +
      '2. 期間を指定（任意）\n' +
      '3. 「全ページ一括取得」または「このページのみ」をクリック\n\n' +
      '【全ページ取得について】\n' +
      '・全ページを自動で巡回して取得します\n' +
      '・ページ数が多い場合は数分かかります\n' +
      '・取得中はブラウザを閉じないでください\n\n' +
      '【サポート】\n' +
      '問題が解決しない場合は開発者にお問い合わせください。'
    );
  });

  function getDateFilter() {
    return {
      start: startDate.value || null,
      end: endDate.value || null
    };
  }

  function showResult(message, isError = false) {
    result.textContent = message;
    result.style.display = 'block';
    result.classList.toggle('error', isError);
  }

  function downloadJSON(feedbacks, source) {
    const data = {
      exportedAt: new Date().toISOString(),
      source: source,
      dateFilter: getDateFilter(),
      count: feedbacks.length,
      feedbacks: feedbacks
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `onclass-feedbacks-${new Date().toISOString().split('T')[0]}.json`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
  }

  function downloadCSV(feedbacks) {
    const headers = ['ID', 'ユーザー名', '日付', 'コース名', 'カテゴリー', 'ブロック', '感想内容'];
    const rows = feedbacks.map(f => [
      f.id,
      escapeCsvField(f.userName),
      escapeCsvField(f.date),
      escapeCsvField(f.course),
      escapeCsvField(f.category),
      escapeCsvField(f.block),
      escapeCsvField(f.content)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `onclass-feedbacks-${new Date().toISOString().split('T')[0]}.csv`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
  }
});
