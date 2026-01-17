// Content Script: ページスクリプトの注入と設定管理

(function() {
  console.log('[オンクラスエンハンサー] injector.js 開始');

  // 即座にページスクリプトを注入（設定は後から読み込む）
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-script.js');
  // デフォルト設定で開始（後から更新される）
  script.dataset.settings = JSON.stringify({ autoCategoryMove: true });
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => {
    console.log('[オンクラスエンハンサー] page-script.js 注入完了');
    script.remove();
  };
  script.onerror = (e) => {
    console.error('[オンクラスエンハンサー] page-script.js 注入失敗:', e);
  };

  // 設定を非同期で読み込んでページスクリプトに通知
  chrome.storage.sync.get({ autoCategoryMove: false }).then(settings => {
    console.log('[オンクラスエンハンサー] 設定:', settings);
    window.postMessage({
      type: 'ONCLASS_ENHANCER_SETTINGS_CHANGED',
      settings: settings
    }, '*');
  });

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
