// content.js — Extracts interview feedback from TA Hub
// Pattern detected from actual page:
//   [Name]
//   [TITLE IN CAPS]
//   Interview feedback
//   [Form: "Interview Feedback Template" / "Person Screen"]
//   Submitted / Pending
//   [Date]

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFeedback') {
    const data = extractFromCurrentPage();
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

function extractFromCurrentPage() {
  const pageText = document.body.innerText;
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

  // Detect page type
  const reqIds = pageText.match(/\(\d{9}\)/g);
  const isHomepage = (reqIds && reqIds.length >= 3) &&
    (pageText.includes('My Requisitions') || pageText.includes('Days Open'));

  if (isHomepage) {
    return extractHomepage(lines);
  } else {
    return extractFeedbackPage(lines);
  }
}

// ===== FEEDBACK PAGE EXTRACTION =====
function extractFeedbackPage(lines) {
  const data = {
    requisition: '',
    candidates: [],
    totalFeedback: 0,
    isHomepage: false,
    extractedAt: new Date().toISOString()
  };

  // Find candidate name (appears early, format: "Firstname Lastname\nTitle, Company")
  let candidateName = 'Unknown';
  for (let i = 0; i < Math.min(60, lines.length); i++) {
    // Pattern from debug: "Ruo-Chun Tzeng" followed by "Data Scientist, Ericsson AB"
    if (lines[i].match(/^[A-Z][a-z]+(-[A-Z][a-z]+)?\s+[A-Z][a-z]/) &&
        lines[i].length < 40 &&
        !lines[i].match(/^(Senior|Junior|Staff|Principal|Interview|Microsoft|TALENT|Taiwan|Hong Kong|Requisition)/i)) {
      candidateName = lines[i];
      break;
    }
  }

  // Find all feedback entries grouped by requisition
  // Pattern: "Requisition\n[Title (ID)]" then feedback entries follow
  let currentReq = '';
  const reqFeedbacks = {}; // { reqTitle: [feedback entries] }

  for (let i = 0; i < lines.length; i++) {
    // Detect requisition header
    if (lines[i] === 'Requisition' && i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      if (nextLine.match(/\(\d{9}\)/)) {
        currentReq = nextLine;
        if (!reqFeedbacks[currentReq]) reqFeedbacks[currentReq] = [];
      }
      continue;
    }

    // Detect feedback entry: line says "Interview feedback" (the label)
    if (lines[i] === 'Interview feedback' || lines[i] === 'Interview Feedback') {
      const fb = {
        interviewer: '',
        title: '',
        formType: '',
        decision: 'unknown',
        status: 'unknown',
        date: ''
      };

      // Look BACKWARDS for interviewer name and title
      // Pattern: Name (2 lines back), TITLE IN CAPS (1 line back)
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const prev = lines[j];
        // Title in CAPS (e.g., "PRINCIPAL APPLIED SCIENTIST")
        if (!fb.title && prev === prev.toUpperCase() && prev.length > 3 && prev.length < 60 &&
            !prev.match(/^(TALENT|ACQUISITION|HUB|RT)$/)) {
          fb.title = prev;
        }
        // Interviewer name
        if (!fb.interviewer && prev.match(/^[A-Z][a-z]+/) && prev.length < 40 &&
            prev !== prev.toUpperCase() &&
            !prev.match(/^(Interview|Requisition|Senior|Feedback|Submitted|Pending|Person|Based|Descriptive)/i)) {
          fb.interviewer = prev;
        }
      }

      // Look FORWARD for form type, status, date
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 5); j++) {
        const next = lines[j];

        // Form type
        if (!fb.formType) {
          if (next.match(/Interview Feedback Template/i)) fb.formType = 'Interview';
          else if (next.match(/Person Screen/i)) fb.formType = 'Phone Screen';
          else if (next.match(/Quick Notes/i) || next.match(/Quick Feedback/i)) fb.formType = 'Quick Notes';
        }

        // Status
        if (next === 'Submitted') fb.status = 'submitted';
        if (next === 'Pending') { fb.status = 'pending'; fb.decision = 'pending'; }

        // Date
        const dateMatch = next.match(/^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4})$/i);
        if (dateMatch) fb.date = dateMatch[1];
      }

      // If we haven't set a currentReq yet, try to find it
      if (!currentReq) {
        for (let j = 0; j < i; j++) {
          if (lines[j].match(/\(\d{9}\)/) && lines[j].length < 100) {
            currentReq = lines[j];
            break;
          }
        }
        if (!currentReq) currentReq = 'Unknown Req';
        if (!reqFeedbacks[currentReq]) reqFeedbacks[currentReq] = [];
      }

      if (fb.interviewer || fb.formType) {
        reqFeedbacks[currentReq].push(fb);
      }
    }
  }

  // Detect hire/no-hire decisions from DOM colors
  detectDecisionsFromDOM(reqFeedbacks);

  // Build output
  data.requisition = Object.keys(reqFeedbacks)[0] || 'Unknown Req';

  for (const [reqTitle, feedbacks] of Object.entries(reqFeedbacks)) {
    if (feedbacks.length > 0) {
      data.candidates.push({
        name: `${candidateName} — ${reqTitle}`,
        feedback: feedbacks
      });
      data.totalFeedback += feedbacks.length;
    }
  }

  return data;
}

// ===== DETECT DECISIONS FROM DOM =====
function detectDecisionsFromDOM(reqFeedbacks) {
  // Find all elements that contain "Interview feedback" text, then check nearby SVGs
  const allTextNodes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => node.textContent.trim() === 'Interview feedback' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
  });
  while (walker.nextNode()) allTextNodes.push(walker.currentNode);

  // For each feedback label, walk up to find the row container and check for colored icons
  let entryIndex = 0;
  const allEntries = Object.values(reqFeedbacks).flat();

  allTextNodes.forEach((textNode, idx) => {
    if (idx >= allEntries.length) return;
    const entry = allEntries[idx];
    if (entry.status === 'pending') return; // skip pending

    // Walk up to find container
    let container = textNode.parentElement;
    for (let i = 0; i < 10; i++) {
      if (!container || !container.parentElement) break;
      const text = container.innerText || '';
      // Stop when we have a container with the interviewer name and status
      if (text.includes('Submitted') || text.includes('Pending')) break;
      container = container.parentElement;
    }

    if (!container) return;

    // Look for SVG with green/red color
    const svgs = container.querySelectorAll('svg');
    for (const svg of svgs) {
      const allEls = [svg, ...svg.querySelectorAll('*')];
      for (const el of allEls) {
        const fill = (el.getAttribute('fill') || '').toLowerCase();
        const color = (el.getAttribute('color') || '').toLowerCase();
        const stroke = (el.getAttribute('stroke') || '').toLowerCase();
        const allColors = fill + color + stroke;

        if (allColors.match(/#22c55e|#16a34a|#10b981|#34d399|#4ade80|#059669|#15803d|#166534|green|#0[0-9a-f]8|#2e7d32|#388e3c|#43a047|#4caf50|#66bb6a/)) {
          entry.decision = 'hire';
          return;
        }
        if (allColors.match(/#ef4444|#dc2626|#f87171|#b91c1c|#991b1b|#c62828|#d32f2f|#e53935|#f44336|red/)) {
          entry.decision = 'no-hire';
          return;
        }
      }
    }

    // Also check for thumbs up/down icons by class name
    const icons = container.querySelectorAll('[class*="thumb"], [class*="Thumb"], [class*="icon"], [class*="Icon"]');
    for (const icon of icons) {
      const cls = (icon.className || '').toString().toLowerCase();
      if (cls.match(/up|positive|green|success|like/)) { entry.decision = 'hire'; return; }
      if (cls.match(/down|negative|red|danger|dislike/)) { entry.decision = 'no-hire'; return; }
    }

    // Check computed style colors
    const coloredEls = container.querySelectorAll('svg, i, span');
    for (const el of coloredEls) {
      try {
        const style = window.getComputedStyle(el);
        const c = style.color;
        if (isGreen(c)) { entry.decision = 'hire'; return; }
        if (isRed(c)) { entry.decision = 'no-hire'; return; }
      } catch (e) {}
    }

    // Fallback: check feedback text for keywords
    const containerText = (container.innerText || '').toLowerCase();
    if (containerText.match(/strong hire|recommend.*hire|suggest.*hire|would hire/)) {
      entry.decision = 'hire';
    } else if (containerText.match(/no hire|not recommend|would not|decline|reject/)) {
      entry.decision = 'no-hire';
    }
  });
}

function isGreen(color) {
  if (!color) return false;
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return +m[2] > 140 && +m[1] < 140 && +m[3] < 140;
  return false;
}

function isRed(color) {
  if (!color) return false;
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (m) return +m[1] > 170 && +m[2] < 120 && +m[3] < 120;
  return false;
}

// ===== HOMEPAGE EXTRACTION =====
function extractHomepage(lines) {
  const data = {
    requisition: 'All My Requisitions',
    candidates: [],
    totalFeedback: 0,
    isHomepage: true,
    reqs: [],
    extractedAt: new Date().toISOString()
  };

  for (let i = 0; i < lines.length; i++) {
    const reqMatch = lines[i].match(/^(.+?)\s*\((\d{9})\)$/);
    if (!reqMatch) continue;

    const reqTitle = reqMatch[1].trim();
    const reqId = reqMatch[2];
    let hiringManager = '';

    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('•')) {
        const parts = lines[j].split('•').map(p => p.trim());
        if (parts.length >= 2) hiringManager = parts[1];
        break;
      }
    }

    // Collect numbers
    const numbers = [];
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      if (j > i + 2 && lines[j].match(/\(\d{9}\)$/)) break;
      if (lines[j].match(/^[\d,.]+[km]?$/i)) {
        numbers.push(parseNumber(lines[j]));
      }
    }

    let screen = 0, interview = 0;
    if (numbers.length >= 7) { screen = numbers[4]; interview = numbers[5]; }
    else if (numbers.length >= 6) { screen = numbers[3]; interview = numbers[4]; }

    if (screen > 0 || interview > 0) {
      data.reqs.push({ title: reqTitle, id: reqId, hiringManager, screen, interview });
      const feedback = [];
      if (screen > 0) feedback.push({ interviewer: `${screen} candidate(s)`, formType: 'Phone Screen', decision: 'unknown', status: 'in-progress', date: '' });
      if (interview > 0) feedback.push({ interviewer: `${interview} candidate(s)`, formType: 'Interview', decision: 'unknown', status: 'in-progress', date: '' });
      data.candidates.push({ name: `${reqTitle} (${reqId})`, hiringManager, feedback });
      data.totalFeedback += screen + interview;
    }
  }

  return data;
}

function parseNumber(str) {
  if (!str) return 0;
  str = str.toLowerCase().replace(/,/g, '');
  if (str.endsWith('k')) return Math.round(parseFloat(str) * 1000);
  if (str.endsWith('m')) return Math.round(parseFloat(str) * 1000000);
  return parseInt(str) || 0;
}

// ===== GET REQ LINKS =====
function getReqLinks() {
  const links = [];
  const seen = new Set();
  document.querySelectorAll('a[href]').forEach(a => {
    const text = a.textContent.trim();
    const href = a.href;
    const idMatch = text.match(/\((\d{9})\)/);
    if (!idMatch) return;
    if (!text.match(/engineer|scientist|manager|designer|analyst|developer|specialist|director|lead|technician|architect|marshal/i)) return;
    if (text.match(/calibration|assessment|create|confirm|delete|edit/i)) return;
    if (seen.has(idMatch[1])) return;
    seen.add(idMatch[1]);
    links.push({ url: href, title: text.split('\n')[0].trim() });
  });
  return links;
}

// ===== FORMAT SUMMARY =====
function formatSummary(data) {
  const lines = [];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  lines.push('📋 INTERVIEW FEEDBACK SUMMARY');
  lines.push(`📅 ${today}`);
  lines.push('━'.repeat(40));

  if (data.isHomepage) {
    lines.push('');
    lines.push('📊 REQS WITH ACTIVE SCREEN/INTERVIEW:');
    if (data.reqs && data.reqs.length > 0) {
      data.reqs.forEach(req => {
        lines.push('');
        lines.push(`🎯 ${req.title} (${req.id})`);
        lines.push(`   HM: ${req.hiringManager}`);
        if (req.screen > 0) lines.push(`   📞 Screen: ${req.screen}`);
        if (req.interview > 0) lines.push(`   🎤 Interview: ${req.interview}`);
      });
      const ts = data.reqs.reduce((s, r) => s + r.screen, 0);
      const ti = data.reqs.reduce((s, r) => s + r.interview, 0);
      lines.push('');
      lines.push(`📊 TOTAL: ${ts} Screen | ${ti} Interview across ${data.reqs.length} reqs`);
    } else {
      lines.push('✅ No candidates in Screen/Interview.');
    }
  } else {
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
      if (other.length > 0) printGroup('📝 OTHER', other);
    });

    const allPending = data.candidates.flatMap(c => c.feedback.filter(f => f.status === 'pending'));
    if (allPending.length > 0) {
      lines.push('');
      lines.push(`⚡ ACTION: ${allPending.length} feedback still pending — send reminders!`);
    }
  }

  return lines.join('\n');
}
