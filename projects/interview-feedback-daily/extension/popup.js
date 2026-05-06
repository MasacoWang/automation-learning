// popup.js — UI logic for the extension popup

const $ = (sel) => document.querySelector(sel);
let currentSummaryText = '';
let currentData = null;

// Load saved settings
chrome.storage.local.get(['webhookUrl', 'emailTo'], (data) => {
  if (data.webhookUrl) $('#webhookUrl').value = data.webhookUrl;
  if (data.emailTo) $('#emailTo').value = data.emailTo;
});

// Toggle settings
$('#toggleSettings').addEventListener('click', () => {
  $('#settingsSection').classList.toggle('hidden');
});

// Debug — show raw page text
$('#debugBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'debugPage' });
    if (response && response.text) {
      $('#summarySection').classList.remove('hidden');
      $('#reqTitle').textContent = 'DEBUG — Raw Page Text';
      $('#countBadge').textContent = '';
      $('#candidateList').innerHTML = `<pre style="font-size:10px;white-space:pre-wrap;max-height:300px;overflow-y:auto;background:#f1f5f9;padding:8px;border-radius:6px">${response.text.replace(/</g,'&lt;')}</pre>`;
    }
  } catch (err) {
    showStatus('Error: refresh TA Hub page first', 'error');
  }
});

// Save settings
$('#saveSettings').addEventListener('click', () => {
  chrome.storage.local.set({
    webhookUrl: $('#webhookUrl').value.trim(),
    emailTo: $('#emailTo').value.trim()
  }, () => showStatus('Settings saved!', 'success'));
});

// Extract feedback from current page only
$('#extractBtn').addEventListener('click', async () => {
  showStatus('Extracting from current page...', 'info');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes('careerhub.microsoft.com')) {
      showStatus('Please open TA Hub first (careerhub.microsoft.com)', 'error');
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractFeedback' });
    if (response && response.data) {
      currentData = response.data;
      currentSummaryText = response.summaryText;
      renderSummary(response.data);
      showStatus(`Found ${response.data.totalFeedback} feedback entries`, 'success');
    } else {
      showStatus('No feedback found. Open a req with Feedback tab visible.', 'error');
    }
  } catch (err) {
    showStatus('Error: Make sure you\'re on TA Hub and refresh the page.', 'error');
  }
});

// Scan ALL reqs from homepage automatically
$('#scanAllBtn').addEventListener('click', async () => {
  showStatus('Scanning TA Hub for all requisition links...', 'info');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes('careerhub.microsoft.com')) {
      showStatus('Please open TA Hub homepage first', 'error');
      return;
    }

    // Step 1: Get all req links from the current page
    const linksResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getReqLinks' });
    if (!linksResponse || !linksResponse.links || linksResponse.links.length === 0) {
      showStatus('No requisition links found on this page.', 'error');
      return;
    }

    const reqLinks = linksResponse.links;
    showStatus(`Found ${reqLinks.length} reqs. Scanning each one... (this takes ~${reqLinks.length * 4}s)`, 'info');

    // Step 2: Send to background to open each req and extract feedback
    const results = await chrome.runtime.sendMessage({
      action: 'scanAllReqs',
      reqLinks: reqLinks
    });

    if (results && results.results && results.results.length > 0) {
      // Combine all results into one summary
      const combined = {
        requisition: `All Reqs (${results.results.length})`,
        candidates: [],
        totalFeedback: 0,
        reqs: results.results
      };

      results.results.forEach(req => {
        req.candidates.forEach(c => {
          c.reqTitle = req.requisition;
          combined.candidates.push(c);
          combined.totalFeedback += c.feedback.length;
        });
      });

      currentData = combined;
      currentSummaryText = formatMultiReqSummary(results.results);
      renderMultiReqSummary(results.results);
      showStatus(`✅ Done! ${combined.totalFeedback} feedback across ${results.results.length} reqs`, 'success');
    } else {
      showStatus('No feedback found in any requisition.', 'error');
    }
  } catch (err) {
    showStatus('Error: ' + err.message, 'error');
  }
});

function renderMultiReqSummary(reqs) {
  $('#summarySection').classList.remove('hidden');
  $('#reqTitle').textContent = `${reqs.length} Requisitions`;
  const totalFb = reqs.reduce((sum, r) => sum + r.candidates.reduce((s, c) => s + c.feedback.length, 0), 0);
  $('#countBadge').textContent = `${totalFb} feedback`;

  const list = $('#candidateList');
  list.innerHTML = '';

  reqs.forEach(req => {
    // Req header
    const reqHeader = document.createElement('div');
    reqHeader.className = 'req-header';
    reqHeader.innerHTML = `<h3>🎯 ${req.requisition}</h3>`;
    list.appendChild(reqHeader);

    req.candidates.forEach(c => {
      const card = document.createElement('div');
      card.className = 'candidate-card';

      const phoneScreen = c.feedback.filter(f => f.formType === 'Phone Screen');
      const interview = c.feedback.filter(f => f.formType === 'Interview');
      const other = c.feedback.filter(f => f.formType !== 'Phone Screen' && f.formType !== 'Interview');
      const hire = c.feedback.filter(f => f.decision === 'hire');
      const noHire = c.feedback.filter(f => f.decision === 'no-hire');
      const pending = c.feedback.filter(f => f.status === 'pending');

      card.innerHTML = `
        <h3>👤 ${c.name}</h3>
        <div class="overview-badges">
          <span class="badge badge-hire">👍 ${hire.length}</span>
          <span class="badge badge-nohire">👎 ${noHire.length}</span>
          <span class="badge badge-pending">⏳ ${pending.length}</span>
        </div>
        ${renderGroup('📞 Phone Screen', phoneScreen)}
        ${renderGroup('🎤 Interview', interview)}
        ${other.length > 0 ? renderGroup('📝 Other', other) : ''}
      `;
      list.appendChild(card);
    });
  });
}

function formatMultiReqSummary(reqs) {
  const lines = [];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  lines.push(`📋 INTERVIEW FEEDBACK DAILY SUMMARY`);
  lines.push(`📅 ${today}`);
  lines.push(`📊 ${reqs.length} Requisitions Scanned`);
  lines.push('━'.repeat(40));

  reqs.forEach(req => {
    lines.push('');
    lines.push(`🎯 ${req.requisition}`);
    lines.push('─'.repeat(30));

    req.candidates.forEach(c => {
      const phoneScreen = c.feedback.filter(f => f.formType === 'Phone Screen');
      const interview = c.feedback.filter(f => f.formType === 'Interview');
      const other = c.feedback.filter(f => f.formType !== 'Phone Screen' && f.formType !== 'Interview');
      const hireCount = c.feedback.filter(f => f.decision === 'hire').length;
      const noHireCount = c.feedback.filter(f => f.decision === 'no-hire').length;
      const pendingCount = c.feedback.filter(f => f.status === 'pending').length;

      lines.push(`  👤 ${c.name}`);
      lines.push(`     👍 ${hireCount} Hire | 👎 ${noHireCount} No Hire | ⏳ ${pendingCount} Pending`);

      if (phoneScreen.length > 0) {
        lines.push(`     📞 Phone Screen:`);
        phoneScreen.forEach(f => {
          const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
          lines.push(`        ${icon} ${f.interviewer} ${f.date ? '(' + f.date + ')' : ''}`);
        });
      }
      if (interview.length > 0) {
        lines.push(`     🎤 Interview:`);
        interview.forEach(f => {
          const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
          lines.push(`        ${icon} ${f.interviewer} ${f.date ? '(' + f.date + ')' : ''}`);
        });
      }
      if (other.length > 0) {
        lines.push(`     📝 Other:`);
        other.forEach(f => {
          const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
          lines.push(`        ${icon} ${f.interviewer} ${f.date ? '(' + f.date + ')' : ''}`);
        });
      }
    });
  });

  // Pending reminders
  const allPending = [];
  reqs.forEach(req => {
    req.candidates.forEach(c => {
      c.feedback.filter(f => f.status === 'pending').forEach(f => {
        allPending.push({ interviewer: f.interviewer, candidate: c.name, req: req.requisition });
      });
    });
  });

  if (allPending.length > 0) {
    lines.push('');
    lines.push(`⚡ ACTION NEEDED: ${allPending.length} pending feedback`);
    allPending.forEach(p => {
      lines.push(`   • Remind ${p.interviewer} → ${p.candidate} (${p.req})`);
    });
  }

  return lines.join('\n');
}

// Copy
$('#copyBtn').addEventListener('click', async () => {
  if (!currentSummaryText) { showStatus('Extract feedback first', 'error'); return; }
  await navigator.clipboard.writeText(currentSummaryText);
  showStatus('Copied to clipboard! ✅', 'success');
});

// Email
$('#emailBtn').addEventListener('click', async () => {
  if (!currentSummaryText) { showStatus('Extract feedback first', 'error'); return; }
  const { emailTo } = await chrome.storage.local.get(['emailTo']);
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const subject = encodeURIComponent(`Interview Feedback Summary — ${today}`);
  const body = encodeURIComponent(currentSummaryText);
  const to = emailTo || '';
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${subject}&body=${body}`;
  chrome.tabs.create({ url });
});

// Teams
$('#teamsBtn').addEventListener('click', async () => {
  if (!currentData) { showStatus('Extract feedback first', 'error'); return; }
  const { webhookUrl } = await chrome.storage.local.get(['webhookUrl']);
  if (!webhookUrl) {
    showStatus('Set Teams Webhook URL in Settings first', 'error');
    return;
  }
  showStatus('Sending to Teams...', 'info');
  try {
    const card = buildTeamsCard(currentData);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card)
    });
    if (res.ok) showStatus('Sent to Teams! ✅', 'success');
    else showStatus(`Teams error: ${res.status}`, 'error');
  } catch (e) {
    showStatus('Failed: ' + e.message, 'error');
  }
});

function renderSummary(data) {
  $('#summarySection').classList.remove('hidden');

  if (data.isHomepage) {
    // Homepage view — show req overview
    $('#reqTitle').textContent = 'My Active Requisitions';
    const totalScreen = data.reqs ? data.reqs.reduce((s, r) => s + r.screen, 0) : 0;
    const totalInterview = data.reqs ? data.reqs.reduce((s, r) => s + r.interview, 0) : 0;
    $('#countBadge').textContent = `${totalScreen} Screen | ${totalInterview} Interview`;

    const list = $('#candidateList');
    list.innerHTML = '';

    if (data.reqs && data.reqs.length > 0) {
      data.reqs.forEach(req => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.innerHTML = `
          <h3>🎯 ${req.title} (${req.id})</h3>
          <div class="meta">HM: ${req.hiringManager}</div>
          <div class="overview-badges">
            ${req.screen > 0 ? `<span class="badge badge-pending">📞 ${req.screen} Screen</span>` : ''}
            ${req.interview > 0 ? `<span class="badge badge-hire">🎤 ${req.interview} Interview</span>` : ''}
          </div>
        `;
        list.appendChild(card);
      });
    } else {
      const empty = document.createElement('div');
      empty.className = 'candidate-card';
      empty.innerHTML = '<p>✅ No candidates in Screen/Interview stage.</p>';
      list.appendChild(empty);
    }
  } else {
    // Feedback tab view — show detailed feedback
    $('#reqTitle').textContent = data.requisition || 'Unknown Req';
    $('#countBadge').textContent = `${data.totalFeedback} feedback`;

    const list = $('#candidateList');
    list.innerHTML = '';

    data.candidates.forEach(c => {
      const card = document.createElement('div');
      card.className = 'candidate-card';

      const phoneScreen = c.feedback.filter(f => f.formType === 'Phone Screen');
      const interview = c.feedback.filter(f => f.formType === 'Interview');
      const other = c.feedback.filter(f => f.formType !== 'Phone Screen' && f.formType !== 'Interview');
      const hire = c.feedback.filter(f => f.decision === 'hire');
      const noHire = c.feedback.filter(f => f.decision === 'no-hire');
      const pending = c.feedback.filter(f => f.status === 'pending');

      card.innerHTML = `
        <h3>👤 ${c.name}</h3>
        <div class="overview-badges">
          <span class="badge badge-hire">👍 ${hire.length} Hire</span>
          <span class="badge badge-nohire">👎 ${noHire.length} No Hire</span>
          <span class="badge badge-pending">⏳ ${pending.length} Pending</span>
        </div>
        ${renderGroup('📞 Phone Screen', phoneScreen)}
        ${renderGroup('🎤 Interview', interview)}
        ${other.length > 0 ? renderGroup('📝 Other', other) : ''}
      `;
      list.appendChild(card);
    });
  }
}

function renderGroup(title, feedbackList) {
  if (feedbackList.length === 0) return '';
  const rows = feedbackList.map(f => {
    const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
    return `<div class="feedback-row">
      <span class="icon">${icon}</span>
      <span class="name">${f.interviewer}</span>
      <span class="date">${f.date || ''}</span>
    </div>`;
  }).join('');
  return `<div class="feedback-group">
    <div class="group-title">${title} (${feedbackList.length})</div>
    ${rows}
  </div>`;
}

function buildTeamsCard(data) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const facts = data.candidates.map(c => {
    const h = c.feedback.filter(f => f.decision === 'hire').length;
    const n = c.feedback.filter(f => f.decision === 'no-hire').length;
    const p = c.feedback.filter(f => f.status === 'pending').length;
    const status = p > 0 ? `⏳ ${p} pending` : '✅ All in';
    return { name: c.name, value: `${status} | 👍${h} 👎${n}` };
  });
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "themeColor": "4f46e5",
    "summary": "Interview Feedback Daily",
    "sections": [{
      "activityTitle": `📋 Interview Feedback — ${today}`,
      "activitySubtitle": data.requisition,
      "facts": facts,
      "markdown": true
    }]
  };
}

function showStatus(msg, type) {
  const el = $('#statusMsg');
  el.textContent = msg;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
  if (type === 'success') setTimeout(() => el.classList.add('hidden'), 3000);
}
