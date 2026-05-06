// content.js — Runs on TA Hub pages, extracts feedback data when requested

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractFeedback') {
    try {
      const data = extractAllFeedback();
      const summaryText = formatTextSummary(data);
      sendResponse({ data, summaryText });
    } catch (e) {
      sendResponse({ data: null, error: e.message });
    }
  }
  return true;
});

function extractAllFeedback() {
  const data = {
    requisition: getRequisition(),
    candidates: [],
    totalFeedback: 0,
    extractedAt: new Date().toISOString()
  };

  // Strategy 1: Feedback detail view (individual candidate's feedback tab)
  const detailFeedback = extractFeedbackDetailView();
  if (detailFeedback.length > 0) {
    const candidateName = getCandidateName();
    data.candidates.push({
      name: candidateName,
      feedback: detailFeedback
    });
    data.totalFeedback = detailFeedback.length;
    return data;
  }

  // Strategy 2: Pipeline/list view with feedback column
  const pipelineCandidates = extractPipelineView();
  if (pipelineCandidates.length > 0) {
    data.candidates = pipelineCandidates;
    data.totalFeedback = pipelineCandidates.reduce((sum, c) => sum + c.feedback.length, 0);
  }

  return data;
}

// ===== REQUISITION INFO =====
function getRequisition() {
  // Try page title / header
  const selectors = [
    'h1', '[class*="reqTitle"]', '[class*="requisitionTitle"]',
    '[class*="jobTitle"]', '[class*="JobTitle"]', '[class*="positionTitle"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 3) {
      let title = el.textContent.trim();
      // Try to append position ID
      const idMatch = document.body.innerText.match(/(?:Position|Req|Job)\s*(?:ID)?[\s:#]*(\d{9})/i);
      if (idMatch) title += ` (${idMatch[1]})`;
      return title;
    }
  }
  const idMatch = document.body.innerText.match(/(\d{9})/);
  return idMatch ? `Req ${idMatch[1]}` : 'Unknown Requisition';
}

// ===== CANDIDATE NAME =====
function getCandidateName() {
  const selectors = [
    '[class*="candidateName"]', '[class*="CandidateName"]',
    '[class*="profileName"]', '[class*="ProfileName"]',
    '[class*="applicantName"]', '[class*="ApplicantName"]'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 1) {
      return el.textContent.trim();
    }
  }
  // Fallback: look for a prominent name near feedback section
  const h2s = document.querySelectorAll('h2, h3');
  for (const h of h2s) {
    const text = h.textContent.trim();
    if (text.length > 2 && text.length < 40 && !text.match(/feedback|interview|status|stage/i)) {
      return text;
    }
  }
  return 'Unknown Candidate';
}

// ===== STRATEGY 1: FEEDBACK DETAIL VIEW =====
// When you're on a candidate's Feedback tab showing individual interviewer rows
function extractFeedbackDetailView() {
  const results = [];
  const pageText = document.body.innerText;

  // Look for rows that contain interviewer feedback entries
  // Pattern from screenshots: each row has interviewer name, form type, status, date, thumb icon
  const allElements = document.querySelectorAll(
    '[class*="feedbackRow"], [class*="FeedbackRow"], [class*="feedback-row"],' +
    '[class*="interviewerRow"], [class*="InterviewerRow"],' +
    '[class*="feedbackItem"], [class*="FeedbackItem"],' +
    '[class*="feedbackCard"], [class*="FeedbackCard"],' +
    'tr[class*="feedback"], tr[class*="Feedback"],' +
    '[class*="evaluator"], [class*="Evaluator"]'
  );

  if (allElements.length > 0) {
    allElements.forEach(el => {
      const fb = parseFeedbackElement(el);
      if (fb) results.push(fb);
    });
    return results;
  }

  // Fallback: scan table rows or generic list items
  const rows = document.querySelectorAll('table tbody tr, [role="row"], [class*="Row"]:not([class*="header"])');
  rows.forEach(row => {
    const text = row.textContent || '';
    if (text.match(/submitted|pending/i) && text.match(/interview|feedback|screen|notes/i)) {
      const fb = parseFeedbackElement(row);
      if (fb) results.push(fb);
    }
  });

  return results;
}

// ===== STRATEGY 2: PIPELINE VIEW =====
// When you're on the pipeline/list view showing all candidates
function extractPipelineView() {
  const candidates = [];
  const rows = document.querySelectorAll(
    '[class*="candidateRow"], [class*="CandidateRow"],' +
    '[class*="candidate-row"], [class*="applicantRow"],' +
    '[class*="pipelineRow"], [class*="PipelineRow"],' +
    '[class*="candidateCard"], [class*="CandidateCard"]'
  );

  rows.forEach(row => {
    const nameEl = row.querySelector(
      '[class*="candidateName"], [class*="CandidateName"],' +
      '[class*="name"], a[href*="candidate"], a[href*="applicant"]'
    );
    if (!nameEl) return;

    const name = nameEl.textContent.trim();
    if (!name || name.length < 2) return;

    const candidate = { name, feedback: [] };

    // Check for feedback indicators in this row
    const feedbackSection = row.querySelector('[class*="feedback"], [class*="Feedback"]');
    if (feedbackSection) {
      // Count avatars/icons for submitted feedback
      const avatars = feedbackSection.querySelectorAll('img, [class*="avatar"], [class*="Avatar"]');
      avatars.forEach(av => {
        candidate.feedback.push({
          interviewer: av.getAttribute('alt') || av.getAttribute('title') || 'Interviewer',
          formType: '',
          decision: 'submitted',
          status: 'submitted',
          date: ''
        });
      });

      // Check for "+N" more indicator
      const moreMatch = feedbackSection.textContent.match(/\+(\d+)/);
      if (moreMatch) {
        const count = parseInt(moreMatch[1]);
        for (let i = 0; i < count; i++) {
          candidate.feedback.push({
            interviewer: `Interviewer ${candidate.feedback.length + 1}`,
            formType: '',
            decision: 'submitted',
            status: 'submitted',
            date: ''
          });
        }
      }
    }

    // Check for status text
    const statusText = row.textContent || '';
    if (statusText.match(/pending/i) && candidate.feedback.length === 0) {
      candidate.feedback.push({
        interviewer: 'Unknown',
        formType: '',
        decision: 'pending',
        status: 'pending',
        date: ''
      });
    }

    if (candidate.feedback.length > 0 || statusText.match(/feedback/i)) {
      candidates.push(candidate);
    }
  });

  return candidates;
}

// ===== PARSE INDIVIDUAL FEEDBACK ELEMENT =====
function parseFeedbackElement(el) {
  const text = el.textContent || '';
  const fb = {
    interviewer: '',
    formType: '',
    decision: 'unknown',
    status: 'unknown',
    date: ''
  };

  // Get interviewer name — usually the first prominent text/name element
  const nameSelectors = [
    '[class*="name"], [class*="Name"]',
    'strong', 'b', 'h4', 'h5',
    '[class*="interviewer"], [class*="Interviewer"]',
    '[class*="evaluator"], [class*="Evaluator"]'
  ];
  for (const sel of nameSelectors) {
    const nameEl = el.querySelector(sel);
    if (nameEl) {
      const name = nameEl.textContent.trim();
      // Filter out non-names
      if (name.length > 1 && name.length < 50 &&
          !name.match(/submitted|pending|interview|feedback|screen|form/i)) {
        fb.interviewer = name;
        break;
      }
    }
  }

  // If no name found from elements, try first line of text
  if (!fb.interviewer) {
    const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length > 2 && line.length < 40 &&
          !line.match(/submitted|pending|interview|feedback|screen|form|send|reminder/i)) {
        fb.interviewer = line;
        break;
      }
    }
  }

  // Form type
  if (text.match(/person\s*screen/i) || text.match(/phone\s*screen/i)) {
    fb.formType = 'Phone Screen';
  } else if (text.match(/quick\s*(feedback|notes)/i)) {
    fb.formType = 'Quick Notes';
  } else if (text.match(/interview\s*feedback/i)) {
    fb.formType = 'Interview';
  }

  // Status
  if (text.match(/pending/i)) {
    fb.status = 'pending';
    fb.decision = 'pending';
  } else if (text.match(/submitted/i)) {
    fb.status = 'submitted';
  }

  // Date
  const dateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s*\d{4})/i);
  if (dateMatch) fb.date = dateMatch[1];

  // Decision — green thumb = hire, red thumb = no hire
  fb.decision = detectDecision(el, fb.decision);

  // Only return if we found meaningful data
  if (fb.interviewer || fb.formType) return fb;
  return null;
}

// ===== DETECT HIRE/NO-HIRE DECISION =====
function detectDecision(el, fallback) {
  // Check SVGs for color
  const svgs = el.querySelectorAll('svg');
  for (const svg of svgs) {
    const fill = (svg.getAttribute('fill') || '').toLowerCase();
    const cls = (svg.className?.baseVal || svg.getAttribute('class') || '').toLowerCase();
    const path = svg.querySelector('path');
    const pathFill = path ? (path.getAttribute('fill') || '').toLowerCase() : '';

    if (fill.match(/#22c55e|#16a34a|#10b981|#34d399|#4ade80|green/) ||
        pathFill.match(/#22c55e|#16a34a|#10b981|#34d399|#4ade80|green/) ||
        cls.match(/up|positive|success|hire|green/)) {
      return 'hire';
    }
    if (fill.match(/#ef4444|#dc2626|#f87171|#fca5a5|red/) ||
        pathFill.match(/#ef4444|#dc2626|#f87171|#fca5a5|red/) ||
        cls.match(/down|negative|reject|nohire|red|danger/)) {
      return 'no-hire';
    }
  }

  // Check icon elements
  const icons = el.querySelectorAll('[class*="icon"], [class*="Icon"], [class*="thumb"], [class*="Thumb"]');
  for (const icon of icons) {
    const cls = (icon.className || '').toString().toLowerCase();
    const style = (icon.getAttribute('style') || '').toLowerCase();
    const color = window.getComputedStyle(icon).color;

    if (cls.match(/up|positive|success|hire/) || style.match(/green/)) return 'hire';
    if (cls.match(/down|negative|reject|nohire/) || style.match(/red/)) return 'no-hire';

    // Check computed color (green-ish RGB)
    if (color) {
      const rgb = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgb) {
        const [, r, g, b] = rgb.map(Number);
        if (g > 150 && r < 100 && b < 100) return 'hire';
        if (r > 180 && g < 100 && b < 100) return 'no-hire';
      }
    }
  }

  // Check for emoji/text indicators
  const textLower = (el.textContent || '').toLowerCase();
  if (textLower.includes('👍') || textLower.match(/\bstrong hire\b|\bhire\b/)) return 'hire';
  if (textLower.includes('👎') || textLower.match(/\bno hire\b|\breject\b|\bdecline\b/)) return 'no-hire';

  return fallback;
}

// ===== FORMAT TEXT SUMMARY =====
function formatTextSummary(data) {
  const lines = [];
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  lines.push(`📋 INTERVIEW FEEDBACK SUMMARY`);
  lines.push(`📅 ${today}`);
  lines.push(`🎯 ${data.requisition}`);
  lines.push('━'.repeat(40));

  if (data.candidates.length === 0) {
    lines.push('\n⚠️ No feedback data found on this page.');
    return lines.join('\n');
  }

  data.candidates.forEach(c => {
    const phoneScreen = c.feedback.filter(f => f.formType === 'Phone Screen');
    const interview = c.feedback.filter(f => f.formType === 'Interview');
    const other = c.feedback.filter(f => f.formType !== 'Phone Screen' && f.formType !== 'Interview');

    const hireCount = c.feedback.filter(f => f.decision === 'hire').length;
    const noHireCount = c.feedback.filter(f => f.decision === 'no-hire').length;
    const pendingCount = c.feedback.filter(f => f.status === 'pending').length;

    lines.push('');
    lines.push(`👤 ${c.name}`);
    lines.push(`   👍 ${hireCount} Hire | 👎 ${noHireCount} No Hire | ⏳ ${pendingCount} Pending`);

    if (phoneScreen.length > 0) {
      lines.push(`   ┌ 📞 PHONE SCREEN (${phoneScreen.length})`);
      phoneScreen.forEach(f => {
        const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
        const date = f.date ? ` (${f.date})` : '';
        lines.push(`   │ ${icon} ${f.interviewer}${date}`);
      });
    }

    if (interview.length > 0) {
      lines.push(`   ┌ 🎤 INTERVIEW (${interview.length})`);
      interview.forEach(f => {
        const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
        const date = f.date ? ` (${f.date})` : '';
        lines.push(`   │ ${icon} ${f.interviewer}${date}`);
      });
    }

    if (other.length > 0) {
      lines.push(`   ┌ 📝 OTHER (${other.length})`);
      other.forEach(f => {
        const icon = f.decision === 'hire' ? '👍' : f.decision === 'no-hire' ? '👎' : '⏳';
        const form = f.formType ? ` [${f.formType}]` : '';
        const date = f.date ? ` (${f.date})` : '';
        lines.push(`   │ ${icon} ${f.interviewer}${form}${date}`);
      });
    }
  });

  // Action items
  const pendingAll = data.candidates.flatMap(c =>
    c.feedback.filter(f => f.status === 'pending').map(f => ({ ...f, candidate: c.name }))
  );
  if (pendingAll.length > 0) {
    lines.push('');
    lines.push(`⚡ ACTION NEEDED: ${pendingAll.length} pending feedback`);
    pendingAll.forEach(p => {
      lines.push(`   • Remind ${p.interviewer} → ${p.candidate}`);
    });
  }

  return lines.join('\n');
}
