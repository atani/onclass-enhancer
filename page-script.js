// ページコンテキストで実行されるスクリプト
// fetch/XMLHttpRequestをプロキシしてAPI通信を監視し、カテゴリ作成時に自動で先頭に移動

(function() {
  console.log('[オンクラスエンハンサー] page-script.js 開始');

  // 設定を取得
  const scriptElement = document.currentScript;
  let settings = { autoCategoryMove: false };

  if (scriptElement && scriptElement.dataset.settings) {
    try {
      settings = JSON.parse(scriptElement.dataset.settings);
      console.log('[オンクラスエンハンサー] 設定読み込み:', settings);
    } catch (e) {
      console.error('[オンクラスエンハンサー] 設定のパースに失敗:', e);
    }
  }

  // 設定変更を監視
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'ONCLASS_ENHANCER_SETTINGS_CHANGED') {
      settings = { ...settings, ...event.data.settings };
      console.log('[オンクラスエンハンサー] 設定変更:', settings);
    }
  });

  // 認証情報を保持
  let authHeaders = null;

  // オリジナルのfetchを保存
  const originalFetch = window.fetch;

  // fetchをプロキシ
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method || 'GET';

    const response = await originalFetch.apply(this, arguments);

    // カテゴリ作成APIへのPOSTを検知
    if (settings.autoCategoryMove &&
        method.toUpperCase() === 'POST' &&
        url.includes('/course_categories')) {

      console.log('[オンクラスエンハンサー] カテゴリ作成API検知 (fetch):', url);

      try {
        // レスポンスをクローンして読み取り
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();

        // レスポンスヘッダーから認証情報を取得
        authHeaders = {
          'access-token': response.headers.get('access-token'),
          'client': response.headers.get('client'),
          'uid': response.headers.get('uid')
        };

        console.log('[オンクラスエンハンサー] レスポンス:', data);
        console.log('[オンクラスエンハンサー] 認証ヘッダー:', authHeaders);

        // レスポンス形式: {data: {id: ...}} または {id: ...}
        const categoryId = data?.data?.id || data?.id;
        if (categoryId) {
          moveCategoryToTop(categoryId);
        }
      } catch (e) {
        console.error('[オンクラスエンハンサー] レスポンスの解析に失敗:', e);
        notifyError('レスポンスの解析に失敗しました');
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
    const originalSetRequestHeader = xhr.setRequestHeader;

    let method = '';
    let url = '';
    const requestHeaders = {};

    xhr.open = function(m, u, ...args) {
      method = m;
      url = u;
      return originalOpen.apply(this, [m, u, ...args]);
    };

    xhr.setRequestHeader = function(name, value) {
      requestHeaders[name.toLowerCase()] = value;
      return originalSetRequestHeader.apply(this, [name, value]);
    };

    xhr.addEventListener('load', function() {
      // カテゴリ作成APIへのPOSTを検知
      if (settings.autoCategoryMove &&
          method.toUpperCase() === 'POST' &&
          url.includes('/course_categories')) {

        console.log('[オンクラスエンハンサー] カテゴリ作成API検知 (XHR):', url);

        try {
          // レスポンスヘッダーから認証情報を取得
          authHeaders = {
            'access-token': xhr.getResponseHeader('access-token'),
            'client': xhr.getResponseHeader('client'),
            'uid': xhr.getResponseHeader('uid')
          };

          // レスポンスから作成されたカテゴリIDを取得
          const response = JSON.parse(xhr.responseText);
          console.log('[オンクラスエンハンサー] レスポンス:', response);

          // レスポンス形式: {data: {id: ...}} または {id: ...}
          const categoryId = response?.data?.id || response?.id;
          if (categoryId) {
            moveCategoryToTop(categoryId);
          }
        } catch (e) {
          console.error('[オンクラスエンハンサー] レスポンスの解析に失敗:', e);
          notifyError('レスポンスの解析に失敗しました');
        }
      }
    });

    return xhr;
  };

  // プロトタイプをコピー
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;

  console.log('[オンクラスエンハンサー] fetch/XHR プロキシ設定完了');

  // カテゴリを先頭に移動
  async function moveCategoryToTop(categoryId) {
    if (!authHeaders || !authHeaders['access-token']) {
      notifyError('認証情報が取得できませんでした');
      return;
    }

    try {
      const response = await fetch(`https://api.the-online-class.com/api/v1/course_categories/${categoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'access-token': authHeaders['access-token'],
          'client': authHeaders['client'],
          'uid': authHeaders['uid']
        },
        body: JSON.stringify({
          course_category: {
            row_order_position: 0
          }
        })
      });

      if (response.ok) {
        notifySuccess(categoryId);
        // ページをリロードして変更を反映
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        notifyError(`カテゴリ移動に失敗しました (${response.status})`);
      }
    } catch (e) {
      console.error('[オンクラスエンハンサー] カテゴリ移動エラー:', e);
      notifyError('カテゴリ移動中にエラーが発生しました');
    }
  }

  // 成功通知
  function notifySuccess(categoryId) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_CATEGORY_MOVED',
      categoryId: categoryId
    }, '*');
  }

  // エラー通知
  function notifyError(message) {
    window.postMessage({
      type: 'ONCLASS_ENHANCER_ERROR',
      message: message
    }, '*');
  }
})();
