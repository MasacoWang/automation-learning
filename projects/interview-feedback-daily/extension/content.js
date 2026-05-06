// content.js — Text-based extraction that works regardless of CSS class names

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFeedback') {
    const data = extractFeedback();
    const summaryText = formatSummary(data);
    sendResponse({ data, summaryText });
  }
  if (request.action === 'getReqLinks') {
    sendResponse({ links: getReqLinks() });
  }
  if (request.action === 'debugPage') {
    sendResponse({ text: document.body.innerText.substring(0, 5000) });
  }
  return true;
});

function getReqLinks() {
  const links = [];
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href || '';
    if (href.match(/pipeline|requisition|pid=|req_id=/i)) {
      const title = a.textContent.trim();
      if (title.length > 3 && title.length < 200 && !links.find(l => l.url === href)) {
        links.push({ url: href, title });
      }
    }
  });
  return links;
}

function extractFeedback() {
  const pageText = document.body.innerText;
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

  const data = {
    requisition: findReqTitle(lines),
    candidates: [],
    totalFeedback: 0,
    extractedAt: new Date().toISOString()
  };

  // Find all "Submitted" and "Pending" occurrences using DOM TreeWalker
  // This is the most reliable way — find status text nodes, then walk up to get context
  const feedbackEntries = findFeedbackByStatus();

  if (feedbackEntries.length > 0) {
    const candidateName = findCandidateName(lines);
    data.candidates.push({ name: candidateName, feedback: feedbackEntries });
    data.totalFeedback = feedbackEntries.length;
  }

  return data;
}

function findFeedbackByStatus() {
  const entries = [];

  // Use TreeWalker to find exact "Submitted" and "Pending" text nodes
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const t = node.textContent.trim();
      return (t === 'Submitted' || t === 'Pending') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const statusNodes = [];
  while (walker.nextNode()) statusNodes.push(walker.currentNode);

  statusNodes.forEach(node => {
    // Walk up to find the row/container (look for a parent that contains all the info)
    let container = node.parentElement;
    for (let i = 0; i < 8; i++) {
      if (!container || !container.parentElement) break;
      const childText = container.innerText || '';
      const childLines = childText.split('\n').filter(l => l.trim()).length;
      // Feedback row usually has 3-10 lines and contains form type keywords
      if (childLines >= 3 && childText.match(/Interview Feedback|Person Screen|Quick Notes|Quick Feedback/i)) break;
      container = container.parentElement;
    }

    if (!container) return;

    const text = container.innerText || '';
    const fb = parseContainerText(text, node.textContent.trim());

    // Try to detect hire/no-hire from colored elements in this container
    detectDecisionFromColors(container, fb);

    if (fb.interviewer || fb.formType) {
      entries.push(fb);
    }
  });

  return entries;
}

function parseContainerText(text, status) {
  const fb = {
    interviewer: '',
    formType: '',
    decision: status === 'Pending' ? 'pending' : 'unknown',
    status: status.toLowerCase(),
    date: ''
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Form type
    if (!fb.formType) {
      if (line.match(/Interview Feedback/i)) fb.formType = 'Interview';
      else if (line.match(/Person Screen/i)) fb.formType = 'Phone Screen';
      else if (line.match(/Quick (Notes|Feedback)/i)) fb.formType = 'Quick Notes';
    }

    // Date
    if (!fb.date) {
      const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s*\d{0,4})/i);
      if (dateMatch) fb.date = dateMatch[1];
    }

    // Interviewer name: looks like "Firstname Lastname" or "Firstname Last..."
    // Skip lines that are form types, statuses, dates, or too long
    if (!fb.interviewer &&
        line.length > 3 && line.length < 50 &&
        line.match(/^[A-Z]/) &&
        !line.match(/^(Interview|Person|Phone|Quick|Submitted|Pending|Send|Feedback|Form|View|Notes|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
      fb.interviewer = line;
    }
  }

  return fb;
}

function detectDecisionFromColors(container, fb) {
  if (fb.status === 'pending') return;

  // Look for SVGs with green/red fills
  const svgs = container.querySelectorAll('svg');
  for (const svg of svgs) {
    const elements = [svg, ...svg.querySelectorAll('path, circle, rect, g')];
    for (const el of elements) {
      const fill = (el.getAttribute('fill') || '').toLowerCase();
      const stroke = (el.getAttribute('stroke') || '').toLowerCase();
      const color = fill || stroke;

      // Green = hire
      if (color.match(/#22c55e|#16a34a|#10b981|#34d399|#4ade80|#059669|#15803d|#166534|green|#00a|#0a0/)) {
        fb.decision = 'hire'; return;
      }
      // Red = no hire
      if (color.match(/#ef4444|#dc2626|#f87171|#b91c1c|#991b1b|#7f1d1d|red|#e00|#d00|#c00/)) {
        fb.decision = 'no-hire'; return;
      }
    }
  }

  // Check computed colors on any icon-like elements
  const icons = container.querySelectorAll('i, span, div');
  for (const icon of icons) {
    if (icon.children.length > 2) continue; // skip containers
    try {
      const style = window.getComputedStyle(icon);
      const color = style.color;
      const bg = style.backgroundColor;

      if (isGreenColor(color) || isGreenColor(bg)) { fb.decision = 'hire'; return; }
      if (isRedColor(color) || isRedColor(bg)) { fb.decision = 'no-hire'; return; }
    } catch (e) {}
  }
}

function isGreenColor(color) {
  if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'rgb(0, 0, 0)') return false;
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) {
    const [, r, g, b] = [0, +m[1], +m[2], +m[3]];
    return g > 140 && r < 140 && b < 140;
  }
  return false;
}

function isRedColor(color) {
  if (!color || color === 'rgba(0, 0, 0, 0)' || color === 'rgb(0, 0, 0)') return false;
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) {
    const [, r, g, b] = [0, +m[1], +m[2], +m[3]];
    return r > 170 && g < 120 && b < 120;
  }
  return false;
}

function findReqTitle(lines) {
  const idMatch = lines.join(' ').match(/(\d{9})/);
  for (const line of lines.slice(0, 40)) {
    if (line.match(/engineer|scientist|manager|designer|analyst|developer|specialist|director|lead/i) &&
        line.length > 5 && line.length < 100) {
      return idMatch ? `${line} (${idMatch[1]})` : line;
    }
  }
  return idMatch ? `Req ${idMatch[1]}` : 'Unknown Requisition';
}

function findCandidateName(lines) {
  // Candidate name is usually prominent near top, before feedback details
  for (const line of lines.slice(0, 50)) {
    if (line.length > 3 && line.length < 40 &&
        line.match(/^[A-Z][a-z]+[\s-][A-Z]/) &&
        !line.match(/^(Senior|Junior|Staff|Principal|Interview|Person|Phone|Quick|Submitted|Pending|Microsoft|Feedback|All Active|Open|Pipeline)/i)) {
      return line;
    }
  }
  return 'Unknown Candidate';
}

function formatSummary(data) {
  const lines = [];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  lines.push('📋 INTERVIEW FEEDBACK SUMMARY');
  lines.push(`📅 ${today}`);
  lines.push(`🎯 ${data.requisition}`);
  lines.push('━'.repeat(40));

  if (data.candidates.length === 0) {
    lines.push('');
    lines.push('⚠️ No feedback found.');
    lines.push('Open a candidate → Feedback tab, then try again.');
    return lines.join('\n');
  }

  data.candidates.forEach(c => {
    const ps = c.feedback.filter(f => f.formType === 'Phone Screen');
    const iv = c.feedback.filter(f => f.formType === 'Interview');
    const other = c.feedback.filter(f => f.formType !== 'Phone Screen' && f.formType !== 'Interview');
    const hire = c.feedback.filter(f => f.decision === 'hire').length;
    const noHire = c.feedback.filter(f => f.decision === 'no-hire').length;
    const pending = c.feedback.filter(f => f.status === 'pending').length;

    lines.push('');
    lines.push(`👤 ${c.name}`);
    lines.push(`   👍 ${hire} Hire | 👎 ${noHire} No Hire | ⏳ ${pending} Pending`);

    const printGroup = (title, list) => {
      if (list.length === 0) return;
      lines.push(`   ┌ ${title} (${list.length})`);
      list.forEach(f => {
        const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
        lines.push(`   │ ${icon} ${f.interviewer} ${f.date ? '(' + f.date + ')' : ''}`);
      });
    };

    printGroup('📞 PHONE SCREEN', ps);
    printGroup('🎤 INTERVIEW', iv);
    printGroup('📝 OTHER', other);
  });

  const pending = data.candidates.flatMap(c => c.feedback.filter(f => f.status === 'pending'));
  if (pending.length > 0) {
    lines.push('');
    lines.push(`⚡ ACTION: ${pending.length} feedback still pending!`);
  }

  return lines.join('\n');
}
