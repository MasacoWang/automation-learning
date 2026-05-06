// content.js — Extracts data from both homepage (req list) and candidate feedback tab

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFeedback') {
    const data = extractFromCurrentPage();
    const summaryText = formatSummary(data);
    sendResponse({ data, summaryText });
  }
  if (request.action === 'getReqLinks') {
    sendResponse({ links: getReqLinksWithInterviews() });
  }
  if (request.action === 'debugPage') {
    sendResponse({ text: document.body.innerText.substring(0, 5000) });
  }
  return true;
});

// ===== DETECT PAGE TYPE & EXTRACT =====
function extractFromCurrentPage() {
  const pageText = document.body.innerText;

  // Detect homepage: has multiple req IDs, "Requisitions" header, pipeline columns
  const reqIds = pageText.match(/\(\d{9}\)/g);
  const isHomepage = (reqIds && reqIds.length >= 2) ||
    (pageText.includes('My Requisitions') || pageText.includes('All Requisitions') || pageText.match(/Showing \d+ requisitions/i)) ||
    (pageText.includes('Days Open') && pageText.includes('Prospects'));

  if (isHomepage) {
    return extractFromHomepage(pageText);
  } else if (pageText.match(/Submitted|Pending/i) && pageText.match(/Interview Feedback|Person Screen/i)) {
    return extractFromFeedbackTab(pageText);
  } else {
    return extractFromFeedbackTab(pageText);
  }
}

// ===== HOMEPAGE EXTRACTION =====
// Parses the req list table to show pipeline overview
function extractFromHomepage(pageText) {
  const data = {
    requisition: 'All My Requisitions',
    candidates: [],
    totalFeedback: 0,
    isHomepage: true,
    reqs: [],
    extractedAt: new Date().toISOString()
  };

  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

  // Find each req by matching "Title (9-digit-ID)" pattern
  for (let i = 0; i < lines.length; i++) {
    const reqMatch = lines[i].match(/^(.+?)\s*\((\d{9})\)$/);
    if (!reqMatch) continue;

    const reqTitle = reqMatch[1].trim();
    const reqId = reqMatch[2];
    let hiringManager = '';

    // Next line should be location • HM • Recruiter
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('•')) {
        const parts = lines[j].split('•').map(p => p.trim());
        if (parts.length >= 2) hiringManager = parts[1];
        break;
      }
    }

    // Collect the 7 numbers that follow (Days, Prospects, New, Review, Screen, Interview, Offer)
    const numbers = [];
    for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
      // Stop if we hit the next req
      if (j > i + 2 && lines[j].match(/\(\d{9}\)$/)) break;

      const numStr = lines[j].trim();
      if (numStr.match(/^[\d,.]+[km]?$/i)) {
        numbers.push(parseNumber(numStr));
      }
    }

    // Columns: Days(0), Prospects(1), New Applicant(2), Review(3), Screen(4), Interview(5), Offer(6)
    let screen = 0, interview = 0;
    if (numbers.length >= 7) {
      screen = numbers[4];
      interview = numbers[5];
    } else if (numbers.length >= 6) {
      screen = numbers[3];
      interview = numbers[4];
    }

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

// ===== FEEDBACK TAB EXTRACTION =====
function extractFromFeedbackTab(pageText) {
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

  const data = {
    requisition: findReqTitle(lines),
    candidates: [],
    totalFeedback: 0,
    isHomepage: false,
    extractedAt: new Date().toISOString()
  };

  // Use TreeWalker to find "Submitted" and "Pending" text nodes
  const entries = findFeedbackByStatus();

  if (entries.length > 0) {
    const candidateName = findCandidateName(lines);
    data.candidates.push({ name: candidateName, feedback: entries });
    data.totalFeedback = entries.length;
  }

  return data;
}

function findFeedbackByStatus() {
  const entries = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const t = node.textContent.trim();
      return (t === 'Submitted' || t === 'Pending') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const statusNodes = [];
  while (walker.nextNode()) statusNodes.push(walker.currentNode);

  statusNodes.forEach(node => {
    let container = node.parentElement;
    for (let i = 0; i < 8; i++) {
      if (!container || !container.parentElement) break;
      const text = container.innerText || '';
      if (text.match(/Interview Feedback|Person Screen|Quick Notes|Quick Feedback/i)) break;
      container = container.parentElement;
    }

    if (!container) return;

    const text = container.innerText || '';
    const fb = parseContainerText(text, node.textContent.trim());
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
    if (!fb.formType) {
      if (line.match(/Interview Feedback/i)) fb.formType = 'Interview';
      else if (line.match(/Person Screen/i)) fb.formType = 'Phone Screen';
      else if (line.match(/Quick (Notes|Feedback)/i)) fb.formType = 'Quick Notes';
    }

    if (!fb.date) {
      const dateMatch = line.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s*\d{0,4})/i);
      if (dateMatch) fb.date = dateMatch[1];
    }

    if (!fb.interviewer && line.length > 3 && line.length < 50 && line.match(/^[A-Z]/) &&
        !line.match(/^(Interview|Person|Phone|Quick|Submitted|Pending|Send|Feedback|Form|View|Notes|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
      fb.interviewer = line;
    }
  }

  return fb;
}

function detectDecisionFromColors(container, fb) {
  if (fb.status === 'pending') return;
  const svgs = container.querySelectorAll('svg');
  for (const svg of svgs) {
    const elements = [svg, ...svg.querySelectorAll('path, circle, rect, g')];
    for (const el of elements) {
      const fill = (el.getAttribute('fill') || '').toLowerCase();
      const stroke = (el.getAttribute('stroke') || '').toLowerCase();
      const color = fill || stroke;
      if (color.match(/#22c55e|#16a34a|#10b981|#34d399|#4ade80|#059669|#15803d|green/)) { fb.decision = 'hire'; return; }
      if (color.match(/#ef4444|#dc2626|#f87171|#b91c1c|#991b1b|red/)) { fb.decision = 'no-hire'; return; }
    }
  }
}

function findReqTitle(lines) {
  const idMatch = lines.join(' ').match(/\((\d{9})\)/);
  for (const line of lines.slice(0, 40)) {
    if (line.match(/\(\d{9}\)/) && line.length < 100) {
      return line;
    }
    if (line.match(/engineer|scientist|manager|designer|analyst|developer|specialist|director|lead/i) &&
        line.length > 5 && line.length < 100) {
      return idMatch ? `${line} (${idMatch[1]})` : line;
    }
  }
  return idMatch ? `Req ${idMatch[1]}` : 'Unknown Requisition';
}

function findCandidateName(lines) {
  for (const line of lines.slice(0, 50)) {
    if (line.length > 3 && line.length < 40 &&
        line.match(/^[A-Z][a-z]+[\s-][A-Z]/) &&
        !line.match(/^(Senior|Junior|Staff|Principal|Interview|Person|Phone|Quick|Submitted|Pending|Microsoft|Feedback|All Active|Open|Pipeline|Taiwan|Hong Kong|TALENT)/i)) {
      return line;
    }
  }
  return 'Unknown Candidate';
}

// ===== GET REQ LINKS FOR AUTO-SCAN =====
function getReqLinksWithInterviews() {
  // Only grab the actual requisition title links (not calibration, assessment, etc.)
  const links = [];
  const seen = new Set();

  document.querySelectorAll('a[href]').forEach(a => {
    const text = a.textContent.trim();
    const href = a.href;

    // Must contain a 9-digit req ID in parentheses
    const idMatch = text.match(/\((\d{9})\)/);
    if (!idMatch) return;

    // Must look like a job title (contains role keywords)
    if (!text.match(/engineer|scientist|manager|designer|analyst|developer|specialist|director|lead|technician|architect|marshal/i)) return;

    // Skip if text contains action words (calibration, assessment, etc.)
    if (text.match(/calibration|assessment|create|confirm|delete|edit/i)) return;

    // Skip duplicates
    const reqId = idMatch[1];
    if (seen.has(reqId)) return;
    seen.add(reqId);

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
    lines.push('📊 REQUISITIONS WITH ACTIVE SCREEN/INTERVIEW:');
    lines.push('');

    if (data.reqs && data.reqs.length > 0) {
      data.reqs.forEach(req => {
        lines.push(`🎯 ${req.title} (${req.id})`);
        lines.push(`   HM: ${req.hiringManager}`);
        if (req.screen > 0) lines.push(`   📞 Screen: ${req.screen} candidate(s)`);
        if (req.interview > 0) lines.push(`   🎤 Interview: ${req.interview} candidate(s)`);
        lines.push('');
      });

      const totalScreen = data.reqs.reduce((s, r) => s + r.screen, 0);
      const totalInterview = data.reqs.reduce((s, r) => s + r.interview, 0);
      lines.push('─'.repeat(30));
      lines.push(`📊 TOTAL: ${totalScreen} in Screen | ${totalInterview} in Interview`);
      lines.push(`   across ${data.reqs.length} requisitions`);
    } else {
      lines.push('✅ No candidates currently in Screen/Interview stage.');
    }
  } else {
    lines.push(`🎯 ${data.requisition}`);

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
  }

  return lines.join('\n');
}
