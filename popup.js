// オンクラスエンハンサー - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // 要素を取得
  const unreadCountEl = document.getElementById('unreadCount');
  const authStatusEl = document.getElementById('authStatus');
  const statusHintEl = document.getElementById('statusHint');
  const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');
  const openCommunityBtn = document.getElementById('openCommunityBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const exportSection = document.getElementById('exportSection');
  const exportBtn = document.getElementById('exportBtn');
  const feedbackLinkSection = document.getElementById('feedbackLinkSection');
  const openFeedbackBtn = document.getElementById('openFeedbackBtn');

  // 設定を読み込み
  const settings = await chrome.storage.sync.get({
    communityNotifications: { unreadCount: 0, lastUnreadDotState: false },
    authHeaders: null,
    feedbackExport: true
  });

  // 通知ステータスを更新
  updateNotificationStatus(settings);

  // 現在のタブを取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isOnclassPage = tab.url?.includes('manager.the-online-class.com');
  const isFeedbackPage = tab.url?.includes('manager.the-online-class.com/feedbacks');

  // エクスポート機能が有効なら表示
  if (settings.feedbackExport) {
    if (isFeedbackPage) {
      // 感想ページならエクスポートボタンを表示
      exportSection.style.display = 'block';
    } else {
      // それ以外なら感想ページへのリンクを表示
      feedbackLinkSection.style.display = 'block';
    }
  }

  // 通知クリアボタン
  clearNotificationsBtn.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'ONCLASS_CLEAR_UNREAD' });
      unreadCountEl.textContent = '0';
      unreadCountEl.classList.remove('ok');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  });

  // コミュニティを開くボタン
  openCommunityBtn.addEventListener('click', async () => {
    await chrome.tabs.create({
      url: 'https://manager.the-online-class.com/community'
    });
    window.close();
  });

  // 設定を開くボタン
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // 感想ページを開くボタン
  openFeedbackBtn.addEventListener('click', async () => {
    await chrome.tabs.create({
      url: 'https://manager.the-online-class.com/feedbacks'
    });
    window.close();
  });

  // 感想エクスポートボタン
  exportBtn.addEventListener('click', async () => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['utils.js', 'content.js']
      });
      await new Promise(r => setTimeout(r, 100));

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'exportAllPages'
      });

      if (response?.started) {
        window.close();
      } else if (response?.error) {
        alert(response.error);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('エラー: 感想ページを開いてから実行してください');
    }
  });

  // 通知ステータス更新関数
  function updateNotificationStatus(settings) {
    const unreadCount = settings.communityNotifications?.unreadCount ?? 0;
    const hasUnreadDot = settings.communityNotifications?.lastUnreadDotState ?? false;

    if (unreadCount > 0) {
      unreadCountEl.textContent = String(unreadCount);
      unreadCountEl.classList.add('ok');
    } else if (hasUnreadDot) {
      unreadCountEl.textContent = '未読あり';
      unreadCountEl.classList.add('ok');
    } else {
      unreadCountEl.textContent = '0';
      unreadCountEl.classList.remove('ok');
    }

    if (settings.authHeaders) {
      authStatusEl.textContent = '接続済み';
      authStatusEl.classList.add('ok');
      authStatusEl.classList.remove('error');
      statusHintEl.style.display = 'none';
    } else {
      authStatusEl.textContent = '未接続';
      authStatusEl.classList.add('error');
      authStatusEl.classList.remove('ok');
      statusHintEl.style.display = 'block';
    }
  }

  // ストレージ変更を監視
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      chrome.storage.sync.get({
        communityNotifications: { unreadCount: 0, lastUnreadDotState: false },
        authHeaders: null
      }).then(updateNotificationStatus);
    }
  });
});
