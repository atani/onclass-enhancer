// Service Worker: コミュニティ通知のバックグラウンド処理

const ALARM_NAME = 'communityNotificationCheck';

// Service Worker起動時にバッジを復元
(async () => {
  const settings = await chrome.storage.sync.get({
    communityNotifications: { unreadCount: 0, lastUnreadDotState: false }
  });

  const count = settings.communityNotifications?.unreadCount || 0;
  const hasUnreadDot = settings.communityNotifications?.lastUnreadDotState || false;

  if (count > 0) {
    await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  } else if (hasUnreadDot) {
    await chrome.action.setBadgeText({ text: '●' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  }
})();
const CHECK_INTERVAL_MINUTES = 1;
const API_BASE = 'https://api.the-online-class.com/v1/enterprise_manager';

// 拡張機能インストール時の初期化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[オンクラスエンハンサー] 拡張機能がインストールされました');
  await initializeSettings();
  await setupAlarm();
  await restoreBadge();
});

// 拡張機能起動時の初期化
chrome.runtime.onStartup.addListener(async () => {
  console.log('[オンクラスエンハンサー] 拡張機能が起動しました');
  await setupAlarm();
  await restoreBadge();
});

// バッジを復元
async function restoreBadge() {
  const settings = await chrome.storage.sync.get({
    communityNotifications: { unreadCount: 0, lastUnreadDotState: false }
  });

  const count = settings.communityNotifications.unreadCount || 0;
  const hasUnreadDot = settings.communityNotifications.lastUnreadDotState || false;

  if (count > 0) {
    await updateBadge(count);
  } else if (hasUnreadDot) {
    await updateBadge(0, false, true);
  }
  console.log('[オンクラスエンハンサー] バッジを復元しました:', { count, hasUnreadDot });
}

// 設定の初期化
async function initializeSettings() {
  const settings = await chrome.storage.sync.get({
    communityNotifications: {
      enabled: true,
      lastCheckedAt: null,
      lastSeenPostIds: [],
      unreadCount: 0
    }
  });

  // デフォルト値がない場合は設定
  if (!settings.communityNotifications.lastCheckedAt) {
    settings.communityNotifications.lastCheckedAt = Date.now();
    await chrome.storage.sync.set(settings);
  }
}

// アラームのセットアップ
async function setupAlarm() {
  const settings = await chrome.storage.sync.get({
    communityNotifications: { enabled: true }
  });

  if (settings.communityNotifications.enabled) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 0.1, // 初回は6秒後に実行
      periodInMinutes: CHECK_INTERVAL_MINUTES
    });
    console.log('[オンクラスエンハンサー] 通知チェックアラームを設定しました');
  } else {
    chrome.alarms.clear(ALARM_NAME);
    console.log('[オンクラスエンハンサー] 通知チェックアラームを解除しました');
  }
}

// アラーム発火時の処理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await checkCommunityNotifications();
  }
});

// コミュニティ通知のチェック
async function checkCommunityNotifications() {
  const settings = await chrome.storage.sync.get({
    communityNotifications: {
      enabled: true,
      lastCheckedAt: null,
      lastSeenPostIds: [],
      unreadCount: 0
    },
    authHeaders: null
  });

  if (!settings.communityNotifications.enabled) {
    return;
  }

  if (!settings.authHeaders) {
    console.log('[オンクラスエンハンサー] 認証情報がありません。コミュニティページを開いてください。');
    return;
  }

  try {
    // コミュニティの投稿を取得
    const posts = await fetchCommunityPosts(settings.authHeaders);

    if (!posts || posts.length === 0) {
      return;
    }

    const lastCheckedAt = settings.communityNotifications.lastCheckedAt || 0;
    const lastSeenPostIds = settings.communityNotifications.lastSeenPostIds || [];

    // 新しい投稿を検出
    const newPosts = posts.filter(post => {
      const postTime = new Date(post.created_at || post.createdAt).getTime();
      const isNew = postTime > lastCheckedAt;
      const isUnseen = !lastSeenPostIds.includes(post.id);
      return isNew && isUnseen;
    });

    // 自分へのメンションを検出
    const mentions = await fetchMentions(settings.authHeaders);
    const newMentions = mentions.filter(mention => {
      const mentionTime = new Date(mention.created_at || mention.createdAt).getTime();
      return mentionTime > lastCheckedAt;
    });

    const totalNew = newPosts.length + newMentions.length;

    if (totalNew > 0) {
      // 通知を表示
      await showNotification(newPosts, newMentions);

      // バッジを更新
      const newUnreadCount = settings.communityNotifications.unreadCount + totalNew;
      await updateBadge(newUnreadCount);

      // 設定を更新
      const newSeenIds = [...lastSeenPostIds, ...newPosts.map(p => p.id)].slice(-100); // 最新100件のみ保持
      await chrome.storage.sync.set({
        communityNotifications: {
          ...settings.communityNotifications,
          lastCheckedAt: Date.now(),
          lastSeenPostIds: newSeenIds,
          unreadCount: newUnreadCount
        }
      });
    } else {
      // チェック時刻のみ更新
      await chrome.storage.sync.set({
        communityNotifications: {
          ...settings.communityNotifications,
          lastCheckedAt: Date.now()
        }
      });
    }
  } catch (error) {
    console.error('[オンクラスエンハンサー] 通知チェックエラー:', error);

    // 認証エラーの場合は認証情報をクリア
    if (error.message === 'AUTH_ERROR') {
      await chrome.storage.sync.remove('authHeaders');
      await updateBadge(0, true); // エラー状態を表示
    }
  }
}

// コミュニティ投稿を取得
async function fetchCommunityPosts(authHeaders) {
  // 複数のエンドポイントパターンを試す
  const endpoints = [
    '/community/posts',
    '/community/timeline',
    '/communities/posts',
    '/community_posts'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access-token': authHeaders.accessToken,
          'client': authHeaders.client,
          'uid': authHeaders.uid
        }
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_ERROR');
      }

      if (response.ok) {
        const data = await response.json();
        // レスポンス形式: {data: [...]} または [...]
        const posts = data.data || data;
        if (Array.isArray(posts)) {
          console.log(`[オンクラスエンハンサー] エンドポイント ${endpoint} で投稿を取得しました`);
          // 成功したエンドポイントを保存
          await chrome.storage.sync.set({ communityPostsEndpoint: endpoint });
          return posts;
        }
      }
    } catch (error) {
      if (error.message === 'AUTH_ERROR') {
        throw error;
      }
      console.log(`[オンクラスエンハンサー] エンドポイント ${endpoint} は利用できません`);
    }
  }

  // 保存されたエンドポイントを試す
  const settings = await chrome.storage.sync.get({ communityPostsEndpoint: null });
  if (settings.communityPostsEndpoint) {
    try {
      const response = await fetch(`${API_BASE}${settings.communityPostsEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access-token': authHeaders.accessToken,
          'client': authHeaders.client,
          'uid': authHeaders.uid
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.data || data;
      }
    } catch (error) {
      console.log('[オンクラスエンハンサー] 保存されたエンドポイントも利用できません');
    }
  }

  return [];
}

// メンションを取得
async function fetchMentions(authHeaders) {
  const endpoints = [
    '/notifications',
    '/mentions',
    '/community/mentions'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'access-token': authHeaders.accessToken,
          'client': authHeaders.client,
          'uid': authHeaders.uid
        }
      });

      if (response.ok) {
        const data = await response.json();
        const mentions = data.data || data;
        if (Array.isArray(mentions)) {
          return mentions;
        }
      }
    } catch (error) {
      // 続行
    }
  }

  return [];
}

// 通知を表示
async function showNotification(newPosts, newMentions) {
  const postCount = newPosts.length;
  const mentionCount = newMentions.length;

  let title = 'オンクラス コミュニティ';
  let message = '';

  if (postCount > 0 && mentionCount > 0) {
    message = `${postCount}件の新しい投稿と${mentionCount}件のメンションがあります`;
  } else if (postCount > 0) {
    message = `${postCount}件の新しい投稿があります`;
    if (newPosts[0].user_name || newPosts[0].userName) {
      const userName = newPosts[0].user_name || newPosts[0].userName;
      message = `${userName}さんが投稿しました`;
      if (postCount > 1) {
        message += ` (他${postCount - 1}件)`;
      }
    }
  } else if (mentionCount > 0) {
    message = `${mentionCount}件のメンションがあります`;
  }

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// バッジを更新
async function updateBadge(count, isError = false, showDot = false) {
  if (isError) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
  } else if (count > 0) {
    await chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  } else if (showDot) {
    // 未読ドット（数字なし）
    await chrome.action.setBadgeText({ text: '●' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// 通知クリック時の処理
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // コミュニティページを開く
  await chrome.tabs.create({
    url: 'https://manager.the-online-class.com/community'
  });

  // 通知をクリア
  await chrome.notifications.clear(notificationId);

  // 未読数をリセット
  const settings = await chrome.storage.sync.get({
    communityNotifications: { unreadCount: 0 }
  });
  await chrome.storage.sync.set({
    communityNotifications: {
      ...settings.communityNotifications,
      unreadCount: 0
    }
  });
  await updateBadge(0);
});

// Content Scriptからのメッセージを受信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ONCLASS_AUTH_CAPTURED') {
    // 認証情報を保存
    chrome.storage.sync.set({
      authHeaders: message.authHeaders
    }).then(() => {
      console.log('[オンクラスエンハンサー] 認証情報を保存しました');
      sendResponse({ success: true });
    });
    return true; // 非同期レスポンスを示す
  }

  if (message.type === 'ONCLASS_CLEAR_UNREAD') {
    // 未読数とlastMentionCountをクリア
    chrome.storage.sync.get({
      communityNotifications: { unreadCount: 0, lastMentionCount: 0 }
    }).then(settings => {
      return chrome.storage.sync.set({
        communityNotifications: {
          ...settings.communityNotifications,
          unreadCount: 0,
          lastMentionCount: 0
        }
      });
    }).then(() => {
      updateBadge(0);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'ONCLASS_TOGGLE_NOTIFICATIONS') {
    chrome.storage.sync.get({
      communityNotifications: { enabled: true }
    }).then(settings => {
      const newEnabled = !settings.communityNotifications.enabled;
      return chrome.storage.sync.set({
        communityNotifications: {
          ...settings.communityNotifications,
          enabled: newEnabled
        }
      }).then(() => newEnabled);
    }).then(newEnabled => {
      setupAlarm();
      sendResponse({ success: true, enabled: newEnabled });
    });
    return true;
  }

  if (message.type === 'ONCLASS_API_ENDPOINT_DETECTED') {
    // 検出されたAPIエンドポイントを保存
    chrome.storage.sync.set({
      communityPostsEndpoint: message.endpoint
    }).then(() => {
      console.log('[オンクラスエンハンサー] APIエンドポイントを保存しました:', message.endpoint);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'ONCLASS_MENTION_COUNT') {
    // メンション数を受け取って処理
    handleMentionCount(message.count).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'ONCLASS_UNREAD_DOT') {
    // 未読ドット状態を受け取って処理
    handleUnreadDot(message.hasUnread).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// メンション数の処理
async function handleMentionCount(count) {
  const settings = await chrome.storage.sync.get({
    communityNotifications: { enabled: true, unreadCount: 0, lastMentionCount: 0 }
  });

  if (!settings.communityNotifications.enabled) {
    return;
  }

  const lastCount = settings.communityNotifications.lastMentionCount || 0;

  // メンション数が増えた場合のみ通知
  if (count > lastCount) {
    const newMentions = count - lastCount;

    // ブラウザ通知を表示
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'オンクラス コミュニティ',
      message: `${newMentions}件の新しいメンションがあります`,
      priority: 2
    });

    console.log('[オンクラスエンハンサー] 新しいメンションを検出:', newMentions);
  }

  // バッジを更新
  await updateBadge(count);

  // 設定を更新
  await chrome.storage.sync.set({
    communityNotifications: {
      ...settings.communityNotifications,
      unreadCount: count,
      lastMentionCount: count
    }
  });
}

// 未読ドットの処理
async function handleUnreadDot(hasUnread) {
  const settings = await chrome.storage.sync.get({
    communityNotifications: { enabled: true, notifyUnreadPosts: false, lastUnreadDotState: false }
  });

  if (!settings.communityNotifications.enabled) {
    return;
  }

  // 「未読投稿も通知」設定がONの場合のみ
  if (!settings.communityNotifications.notifyUnreadPosts) {
    return;
  }

  const lastState = settings.communityNotifications.lastUnreadDotState || false;

  // 未読ドットが新しく表示された場合のみ通知
  if (hasUnread && !lastState) {
    // ブラウザ通知を表示
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'オンクラス コミュニティ',
      message: '新しい投稿があります',
      priority: 2
    });

    console.log('[オンクラスエンハンサー] 未読投稿を検出');

    // メンションがなくても、未読があることをバッジで示す
    const currentCount = settings.communityNotifications.unreadCount || 0;
    if (currentCount === 0) {
      await updateBadge(0, false, true); // ドット表示
    }
  }

  // 設定を更新
  await chrome.storage.sync.set({
    communityNotifications: {
      ...settings.communityNotifications,
      lastUnreadDotState: hasUnread
    }
  });
}

// 設定変更を監視
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.communityNotifications) {
    const newValue = changes.communityNotifications.newValue;
    const oldValue = changes.communityNotifications.oldValue;

    // enabled が変更された場合、アラームを再設定
    if (newValue?.enabled !== oldValue?.enabled) {
      setupAlarm();
    }

    // notifyUnreadPosts がOFFになった場合、未読ドット状態をクリア
    if (oldValue?.notifyUnreadPosts && !newValue?.notifyUnreadPosts) {
      // メンション数がなければバッジをクリア
      const count = newValue?.unreadCount || 0;
      if (count === 0) {
        await updateBadge(0);
      }
      // lastUnreadDotState をクリア
      await chrome.storage.sync.set({
        communityNotifications: {
          ...newValue,
          lastUnreadDotState: false
        }
      });
    }
  }
});
