// background.js — Handles scanning multiple reqs by opening tabs in background

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAllReqs') {
    scanAllRequisitions(request.reqLinks).then(sendResponse);
    return true; // keep channel open for async
  }
});

async function scanAllRequisitions(reqLinks) {
  const allResults = [];

  for (const req of reqLinks) {
    try {
      const result = await scanSingleReq(req.url, req.title);
      if (result && result.candidates.length > 0) {
        allResults.push(result);
      }
    } catch (e) {
      console.error(`Failed to scan ${req.title}:`, e);
    }
  }

  return { results: allResults };
}

async function scanSingleReq(url, title) {
  return new Promise((resolve) => {
    // Open tab in background
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;

      // Wait for page to load, then extract
      const listener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);

          // Give page a moment to render dynamic content
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'extractFeedback' }, (response) => {
              // Close the background tab
              chrome.tabs.remove(tabId);

              if (response && response.data) {
                response.data.requisition = title || response.data.requisition;
                response.data.reqUrl = url;
                resolve(response.data);
              } else {
                resolve(null);
              }
            });
          }, 3000); // wait 3s for page to render
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 15s
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.remove(tabId).catch(() => {});
        resolve(null);
      }, 15000);
    });
  });
}
