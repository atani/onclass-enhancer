// ページコンテキストで実行されるスクリプト
// コミュニティページでAPIエンドポイントと認証情報を検出・保存
// サイドバーのメンションバッジを監視

(function() {
  let authCaptured = false;
  let lastMentionCount = -1;
  let lastUnreadDotState = false;

  // サイドバーのメンションバッジと未読ドットを監視
  function checkMentionBadge() {
    // すべてのv-badge__badgeを探して、コミュニティに属するものを見つける
    const allBadges = document.querySelectorAll('.v-badge__badge');

    for (const badge of allBadges) {
      // .v-list-item-title を探す
      const listItemTitle = badge.closest('.v-list-item-title');
      if (listItemTitle && listItemTitle.textContent.includes('コミュニティ')) {
        const badgeText = badge.textContent.trim();

        if (badgeText === '') {
          // 空のバッジ = 未読ドット
          if (!lastUnreadDotState) {
            lastUnreadDotState = true;
            notifyUnreadDot(true);
          }
          // 未読ドットがある場合、メンション数は0
          if (lastMentionCount !== 0) {
            lastMentionCount = 0;
          }
        } else {
          // 数字がある = メンション数
          const count = parseInt(badgeText, 10);
          if (!isNaN(count) && count !== lastMentionCount) {
            lastMentionCount = count;
            notifyMentionCount(count);
          }
          // メンション数がある場合、未読ドットは関係ない
          if (lastUnreadDotState) {
            lastUnreadDotState = false;
          }
        }
        return; // コミュニティのバッジが見つかったので終了
      }
    }

    // コミュニティのバッジが見つからない場合、状態をリセット
    if (lastMentionCount !== 0) {
      lastMentionCount = 0;
    }
    if (lastUnreadDotState) {
      lastUnreadDotState = false;
      notifyUnreadDot(false);
    }
  }

  // 未読ドットの状態をContent Scriptに通知
  function notifyUnreadDot(hasUnread) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_UNREAD_DOT',
      hasUnread: hasUnread
    }, '*');
    console.log('[オンクラスエンハンサー] 未読ドットを検出:', hasUnread);
  }

  // メンション数をContent Scriptに通知
  function notifyMentionCount(count) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_MENTION_COUNT',
      count: count
    }, '*');
    console.log('[オンクラスエンハンサー] メンション数を検出:', count);
  }

  // DOM準備完了後に監視を開始
  function startObserver() {
    if (!document.body) {
      // bodyがまだない場合は少し待つ
      setTimeout(startObserver, 100);
      return;
    }

    // 初回チェック
    setTimeout(checkMentionBadge, 1000);

    // 定期的にチェック（5秒ごと）
    setInterval(checkMentionBadge, 5000);

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      checkMentionBadge();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // 開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // オリジナルのfetchを保存
  const originalFetch = window.fetch;

  // fetchをプロキシ
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input.url;

    const response = await originalFetch.apply(this, arguments);

    // api.the-online-class.com へのリクエストを監視
    if (url.includes('api.the-online-class.com')) {
      try {
        // 認証情報を取得
        const accessToken = response.headers.get('access-token');
        const client = response.headers.get('client');
        const uid = response.headers.get('uid');

        if (accessToken && client && uid && !authCaptured) {
          authCaptured = true;
          notifyAuthCaptured({
            accessToken: accessToken,
            client: client,
            uid: uid
          });
        }

        // コミュニティ関連のエンドポイントを検出
        if (url.includes('/community') || url.includes('/notification') || url.includes('/mention')) {
          const urlObj = new URL(url);
          const endpoint = urlObj.pathname.replace('/v1/enterprise_manager', '');
          notifyEndpointDetected(endpoint);
        }
      } catch (e) {
        // エラーは無視
      }
    }

    return response;
  };

  // オリジナルのXMLHttpRequestを保存
  const OriginalXHR = window.XMLHttpRequest;

  // XMLHttpRequestをプロキシ
  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    let url = '';

    xhr.open = function(method, u, ...args) {
      url = u;
      return originalOpen.apply(this, [method, u, ...args]);
    };

    xhr.addEventListener('load', function() {
      if (url.includes('api.the-online-class.com')) {
        try {
          // 認証情報を取得
          const accessToken = xhr.getResponseHeader('access-token');
          const client = xhr.getResponseHeader('client');
          const uid = xhr.getResponseHeader('uid');

          if (accessToken && client && uid && !authCaptured) {
            authCaptured = true;
            notifyAuthCaptured({
              accessToken: accessToken,
              client: client,
              uid: uid
            });
          }

          // コミュニティ関連のエンドポイントを検出
          if (url.includes('/community') || url.includes('/notification') || url.includes('/mention')) {
            const urlObj = new URL(url);
            const endpoint = urlObj.pathname.replace('/v1/enterprise_manager', '');
            notifyEndpointDetected(endpoint);
          }
        } catch (e) {
          // エラーは無視
        }
      }
    });

    return xhr;
  };

  // プロトタイプをコピー
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;

  // 認証情報をContent Scriptに通知
  function notifyAuthCaptured(authHeaders) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_AUTH_CAPTURED',
      authHeaders: authHeaders
    }, '*');
    console.log('[オンクラスエンハンサー] 認証情報を検出しました');
  }

  // 検出したエンドポイントをContent Scriptに通知
  function notifyEndpointDetected(endpoint) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_ENDPOINT_DETECTED',
      endpoint: endpoint
    }, '*');
    console.log('[オンクラスエンハンサー] APIエンドポイントを検出しました:', endpoint);
  }
})();
