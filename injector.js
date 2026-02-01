// Content Script: ページスクリプトの注入と設定管理

(function() {
  const isOnCommunityPage = window.location.pathname.startsWith('/community');

  // コミュニティページを開いたら通知をクリア
  if (isOnCommunityPage) {
    chrome.runtime.sendMessage({ type: 'ONCLASS_CLEAR_UNREAD' })
      .catch(err => console.log('[オンクラスエンハンサー] 通知クリア:', err));
  }

  // page-script.js を注入（カテゴリ自動移動機能用）
  const pageScript = document.createElement('script');
  pageScript.src = chrome.runtime.getURL('page-script.js');
  pageScript.dataset.settings = JSON.stringify({ autoCategoryMove: true });
  (document.head || document.documentElement).appendChild(pageScript);
  pageScript.onload = () => pageScript.remove();

  // community-script.js を注入（認証情報取得のため、すべてのページで実行）
  const communityScript = document.createElement('script');
  communityScript.src = chrome.runtime.getURL('community-script.js');
  (document.head || document.documentElement).appendChild(communityScript);
  communityScript.onload = () => communityScript.remove();

  // 設定を非同期で読み込んでページスクリプトに通知
  chrome.storage.sync.get({ autoCategoryMove: false }).then(settings => {
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

    // コミュニティスクリプトからの認証情報を受信してService Workerに転送
    if (event.data.type === 'ONCLASS_ENHANCER_AUTH_CAPTURED') {
      chrome.runtime.sendMessage({
        type: 'ONCLASS_AUTH_CAPTURED',
        authHeaders: event.data.authHeaders
      }).catch(err => console.error('[オンクラスエンハンサー] 認証情報の送信に失敗:', err));
    }

    // コミュニティスクリプトからのエンドポイント検出を受信してService Workerに転送
    if (event.data.type === 'ONCLASS_ENHANCER_ENDPOINT_DETECTED') {
      chrome.runtime.sendMessage({
        type: 'ONCLASS_API_ENDPOINT_DETECTED',
        endpoint: event.data.endpoint
      }).catch(err => console.error('[オンクラスエンハンサー] エンドポイントの送信に失敗:', err));
    }

    // コミュニティスクリプトからのメンション数を受信してService Workerに転送
    if (event.data.type === 'ONCLASS_ENHANCER_MENTION_COUNT') {
      chrome.runtime.sendMessage({
        type: 'ONCLASS_MENTION_COUNT',
        count: event.data.count
      }).catch(err => console.error('[オンクラスエンハンサー] メンション数の送信に失敗:', err));
    }

    // コミュニティスクリプトからの未読ドット状態を受信してService Workerに転送
    if (event.data.type === 'ONCLASS_ENHANCER_UNREAD_DOT') {
      chrome.runtime.sendMessage({
        type: 'ONCLASS_UNREAD_DOT',
        hasUnread: event.data.hasUnread
      }).catch(err => console.error('[オンクラスエンハンサー] 未読状態の送信に失敗:', err));
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
