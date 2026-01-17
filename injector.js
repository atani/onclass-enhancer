// Content Script: ページスクリプトの注入と設定管理

(async function() {
  // 設定を取得
  const settings = await chrome.storage.sync.get({
    autoCategoryMove: false
  });

  // ページスクリプトを注入
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-script.js');
  script.dataset.settings = JSON.stringify(settings);
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();

  // ページスクリプトからのメッセージを受信
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data.type === 'ONCLASS_ENHANCER_CATEGORY_MOVED') {
      console.log('[オンクラスエンハンサー] カテゴリを先頭に移動しました:', event.data.categoryId);
    }

    if (event.data.type === 'ONCLASS_ENHANCER_ERROR') {
      console.error('[オンクラスエンハンサー] エラー:', event.data.message);
    }
  });

  // 設定変更を監視してページスクリプトに通知
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.autoCategoryMove) {
      window.postMessage({
        type: 'ONCLASS_ENHANCER_SETTINGS_CHANGED',
        settings: {
          autoCategoryMove: changes.autoCategoryMove.newValue
        }
      }, '*');
    }
  });
})();
