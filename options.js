// オンクラスエンハンサー - Options Script

document.addEventListener('DOMContentLoaded', async () => {
  // 要素を取得
  const autoCategoryMoveToggle = document.getElementById('autoCategoryMove');
  const communityNotificationsToggle = document.getElementById('communityNotifications');
  const notifyUnreadPostsToggle = document.getElementById('notifyUnreadPosts');
  const feedbackExportToggle = document.getElementById('feedbackExport');
  const saveIndicator = document.getElementById('saveIndicator');

  // 設定を読み込み
  const settings = await chrome.storage.sync.get({
    autoCategoryMove: false,
    communityNotifications: { enabled: true, notifyUnreadPosts: false },
    feedbackExport: true
  });

  // UIに反映
  autoCategoryMoveToggle.checked = settings.autoCategoryMove;
  communityNotificationsToggle.checked = settings.communityNotifications?.enabled ?? true;
  notifyUnreadPostsToggle.checked = settings.communityNotifications?.notifyUnreadPosts ?? false;
  feedbackExportToggle.checked = settings.feedbackExport ?? true;

  // 保存インジケーターを表示
  function showSaveIndicator() {
    saveIndicator.classList.add('show');
    setTimeout(() => {
      saveIndicator.classList.remove('show');
    }, 2000);
  }

  // カテゴリ自動移動
  autoCategoryMoveToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({
      autoCategoryMove: autoCategoryMoveToggle.checked
    });
    showSaveIndicator();
  });

  // コミュニティ通知
  communityNotificationsToggle.addEventListener('change', async () => {
    const currentSettings = await chrome.storage.sync.get({
      communityNotifications: { enabled: true, notifyUnreadPosts: false }
    });
    await chrome.storage.sync.set({
      communityNotifications: {
        ...currentSettings.communityNotifications,
        enabled: communityNotificationsToggle.checked
      }
    });
    showSaveIndicator();
  });

  // 未読投稿も通知
  notifyUnreadPostsToggle.addEventListener('change', async () => {
    const currentSettings = await chrome.storage.sync.get({
      communityNotifications: { enabled: true, notifyUnreadPosts: false }
    });
    await chrome.storage.sync.set({
      communityNotifications: {
        ...currentSettings.communityNotifications,
        notifyUnreadPosts: notifyUnreadPostsToggle.checked
      }
    });
    showSaveIndicator();
  });

  // 感想エクスポート
  feedbackExportToggle.addEventListener('change', async () => {
    await chrome.storage.sync.set({
      feedbackExport: feedbackExportToggle.checked
    });
    showSaveIndicator();
  });
});
