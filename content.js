// オンクラスエンハンサー - Content Script（感想エクスポート機能）

(function() {
  'use strict';

  // 重複注入防止ガード
  if (window.__onclassEnhancerInjected) {
    return;
  }
  window.__onclassEnhancerInjected = true;

  let isExporting = false;
  let allFeedbacks = [];
  let currentDateFilter = { start: null, end: null };

  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractFeedbacks') {
      const feedbacks = extractCurrentPageFeedbacks();
      sendResponse({ feedbacks });
    } else if (request.action === 'getPageInfo') {
      sendResponse({
        info: {
          url: window.location.href,
          title: document.title,
          totalPages: getTotalPages(),
          currentPage: getCurrentPage()
        }
      });
    } else if (request.action === 'exportAllPages') {
      currentDateFilter = request.dateFilter || { start: null, end: null };
      exportAllPages();
      sendResponse({ started: true });
    }
    return true;
  });

  function getText(element) {
    return element?.textContent?.trim() || '';
  }

  function getCurrentPage() {
    const activeBtn = document.querySelector('.v-pagination__item--is-active');
    return activeBtn ? parseInt(getText(activeBtn)) : 1;
  }

  function getTotalPages() {
    const paginationItems = document.querySelectorAll('.v-pagination__item');
    let maxPage = 1;
    paginationItems.forEach(item => {
      const num = parseInt(getText(item));
      if (!isNaN(num) && num > maxPage) maxPage = num;
    });
    return maxPage;
  }

  function goToNextPage() {
    const nextBtn = document.querySelector('.v-pagination__next button:not([disabled])');
    if (nextBtn) {
      nextBtn.click();
      return true;
    }
    return false;
  }

  function waitForPageLoad(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const cards = document.querySelectorAll('[class*="_feedbacks_"] .v-card');
        const loader = document.querySelector('.v-card__loader');

        if (cards.length > 0 && !loader) {
          clearInterval(checkInterval);
          setTimeout(resolve, 300);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 200);
    });
  }

  // 現在ページの感想を抽出
  function extractCurrentPageFeedbacks() {
    const feedbacks = [];
    const feedbackContainer = document.querySelector('[class*="_feedbacks_"]');
    if (!feedbackContainer) return feedbacks;

    const cards = feedbackContainer.querySelectorAll('.v-card');

    cards.forEach((card, index) => {
      try {
        const feedback = extractSingleFeedback(card, index + 1);
        if (feedback && feedback.content && feedback.content.length > 5) {
          if (!feedback.content.includes('投稿日で絞り込み') &&
              !feedback.content.includes('絞り込み')) {
            feedbacks.push(feedback);
          }
        }
      } catch (e) {
        console.error('Error:', e);
      }
    });

    return feedbacks;
  }

  // 単一の感想を抽出
  function extractSingleFeedback(card, index) {
    const feedback = {
      id: index,
      userName: '',
      content: '',
      date: '',
      course: '',
      category: '',
      block: ''
    };

    const cardTitle = card.querySelector('.v-card-title');
    if (cardTitle) {
      const userCol = cardTitle.querySelector('.v-col');
      if (userCol) {
        const userLink = userCol.querySelector('a');
        if (userLink) {
          feedback.userName = getText(userLink);
        } else {
          const titleText = getText(userCol);
          const match = titleText.match(/(.+?)\s*さんの感想/);
          if (match) feedback.userName = match[1].trim();
        }
      }

      const dateIcon = cardTitle.querySelector('.mdi-calendar-month');
      if (dateIcon) {
        const dateCol = dateIcon.closest('.v-col');
        if (dateCol) {
          const dateMatch = getText(dateCol).match(/(\d{4}\/\d{2}\/\d{2})/);
          if (dateMatch) feedback.date = dateMatch[1];
        }
      }
    }

    const contentElements = card.querySelectorAll('.v-card-text');
    contentElements.forEach(el => {
      if (el.classList.contains('text-pre-line') || el.className.includes('text-pre-line')) {
        feedback.content = getText(el);
      }
    });

    if (!feedback.content && contentElements.length > 0) {
      const firstContent = getText(contentElements[0]);
      if (!firstContent.includes('コース名') && !firstContent.includes('カテゴリー')) {
        feedback.content = firstContent;
      }
    }

    const cardText = card.textContent || '';

    const courseMatch = cardText.match(/コース名\s*([^\n]+?)(?=カテゴリー|ブロック|$)/);
    if (courseMatch) feedback.course = courseMatch[1].trim();

    const categoryMatch = cardText.match(/カテゴリー\s*([^\n]+?)(?=コース名|ブロック|$)/);
    if (categoryMatch) feedback.category = categoryMatch[1].trim();

    const blockMatch = cardText.match(/ブロック\s*([^\n]+?)(?=コース名|カテゴリー|動画|$)/);
    if (blockMatch) feedback.block = blockMatch[1].trim();

    return feedback;
  }

  // 全ページ一括取得
  async function exportAllPages() {
    if (isExporting) {
      alert('エクスポート中です。しばらくお待ちください。');
      return;
    }

    const totalPages = getTotalPages();

    let dateRangeText = '';
    if (currentDateFilter.start || currentDateFilter.end) {
      dateRangeText = `\n期間: ${currentDateFilter.start || '指定なし'} 〜 ${currentDateFilter.end || '指定なし'}`;
    }

    const confirmed = confirm(
      `全${totalPages}ページの感想を取得します。${dateRangeText}\n` +
      `これには数分かかる場合があります。\n\n` +
      `続行しますか？`
    );

    if (!confirmed) return;

    isExporting = true;
    allFeedbacks = [];

    const progressDiv = createProgressUI();

    try {
      // 最初のページに戻る
      const firstPageBtn = document.querySelector('.v-pagination__item button');
      if (firstPageBtn && getCurrentPage() !== 1) {
        firstPageBtn.click();
        await waitForPageLoad();
      }

      for (let page = 1; page <= totalPages; page++) {
        updateProgress(progressDiv, page, totalPages);

        await waitForPageLoad();

        let pageFeedbacks = extractCurrentPageFeedbacks();

        // 日付フィルタリング
        pageFeedbacks = filterByDate(pageFeedbacks, currentDateFilter);

        pageFeedbacks.forEach((f, i) => {
          f.id = allFeedbacks.length + i + 1;
        });
        allFeedbacks.push(...pageFeedbacks);

        console.log(`Page ${page}/${totalPages}: ${pageFeedbacks.length} feedbacks (filtered)`);

        if (page < totalPages) {
          const hasNext = goToNextPage();
          if (!hasNext) {
            console.log('No more pages');
            break;
          }
          await new Promise(r => setTimeout(r, 500));
        }
      }

      downloadFeedbacks(allFeedbacks);

      progressDiv.innerHTML = `
        <div style="color: #10b981; font-weight: bold;">
          ✓ 完了！ ${allFeedbacks.length}件の感想をエクスポートしました
        </div>
      `;
      setTimeout(() => progressDiv.remove(), 5000);

    } catch (error) {
      console.error('Export error:', error);
      alert(`エラーが発生しました: ${error.message}`);
      progressDiv.remove();
    } finally {
      isExporting = false;
    }
  }

  function createProgressUI() {
    let div = document.getElementById('onclass-progress');
    if (div) div.remove();

    div = document.createElement('div');
    div.id = 'onclass-progress';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      background: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-family: sans-serif;
      min-width: 280px;
    `;
    document.body.appendChild(div);
    return div;
  }

  function updateProgress(div, current, total) {
    const percent = Math.round((current / total) * 100);
    let dateInfo = '';
    if (currentDateFilter.start || currentDateFilter.end) {
      dateInfo = `<div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">
        期間: ${currentDateFilter.start || '指定なし'} 〜 ${currentDateFilter.end || '指定なし'}
      </div>`;
    }
    div.innerHTML = `
      <div style="margin-bottom: 8px; font-weight: bold; color: #1e293b;">
        📥 感想をエクスポート中...
      </div>
      ${dateInfo}
      <div style="margin-bottom: 8px; color: #64748b; font-size: 14px;">
        ページ ${current} / ${total}
      </div>
      <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: #4F46E5; height: 100%; width: ${percent}%; transition: width 0.3s;"></div>
      </div>
      <div style="margin-top: 8px; color: #94a3b8; font-size: 12px;">
        ${allFeedbacks.length}件取得済み
      </div>
    `;
  }

  function downloadFeedbacks(feedbacks) {
    const data = {
      exportedAt: new Date().toISOString(),
      source: window.location.href,
      dateFilter: currentDateFilter,
      count: feedbacks.length,
      feedbacks: feedbacks
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onclass-feedbacks-all-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  console.log('オンクラスエンハンサー: 感想エクスポート機能 初期化完了');
})();
