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

// Save settings
$('#saveSettings').addEventListener('click', () => {
  chrome.storage.local.set({
    webhookUrl: $('#webhookUrl').value.trim(),
    emailTo: $('#emailTo').value.trim()
  }, () => showStatus('Settings saved!', 'success'));
});

// Extract feedback
$('#extractBtn').addEventListener('click', async () => {
  showStatus('Extracting from TA Hub...', 'info');
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
  $('#reqTitle').textContent = data.requisition || 'Unknown Req';
  $('#countBadge').textContent = `${data.totalFeedback} feedback`;

  const list = $('#candidateList');
  list.innerHTML = '';

  data.candidates.forEach(c => {
    const card = document.createElement('div');
    card.className = 'candidate-card';

    const hireCount = c.feedback.filter(f => f.decision === 'hire').length;
    const noHireCount = c.feedback.filter(f => f.decision === 'no-hire').length;
    const pendingCount = c.feedback.filter(f => f.status === 'pending').length;

    let statusText = pendingCount > 0
      ? `⏳ ${pendingCount} pending`
      : `✅ All ${c.feedback.length} received`;

    card.innerHTML = `
      <h3>👤 ${c.name}</h3>
      <div class="meta">${statusText} — 👍 ${hireCount} | 👎 ${noHireCount}</div>
      ${c.feedback.map(f => {
        const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
        return `<div class="feedback-row">
          <span class="icon">${icon}</span>
          <span class="name">${f.interviewer}</span>
          <span class="form-type">${f.formType || ''}</span>
          <span class="date">${f.date || ''}</span>
        </div>`;
      }).join('')}
    `;
    list.appendChild(card);
  });
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
