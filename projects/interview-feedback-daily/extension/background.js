// background.js — Scans req pages using fetch (no visible tabs)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAllReqs') {
    scanAllRequisitions(request.reqLinks).then(sendResponse);
    return true;
  }
});

async function scanAllRequisitions(reqLinks) {
  const allResults = [];

  for (const req of reqLinks) {
    try {
      const result = await fetchAndParse(req.url, req.title);
      if (result) {
        allResults.push(result);
      }
    } catch (e) {
      console.error(`Failed to scan ${req.title}:`, e);
    }
  }

  return { results: allResults };
}

async function fetchAndParse(url, title) {
  // Fetch the page HTML silently (uses existing session cookies)
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) return null;

  const html = await response.text();

  // Parse HTML to extract text content
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const pageText = doc.body.innerText || doc.body.textContent || '';

  // Look for feedback-related content
  const data = {
    requisition: title,
    reqUrl: url,
    candidates: [],
    totalFeedback: 0
  };

  // Check if page has feedback data (Submitted/Pending)
  if (pageText.match(/Submitted|Pending/i) && pageText.match(/Interview Feedback|Person Screen/i)) {
    const entries = parseTextForFeedback(pageText);
    if (entries.length > 0) {
      data.candidates.push({ name: findCandidateInText(pageText), feedback: entries });
      data.totalFeedback = entries.length;
    }
  }

  // Also extract pipeline counts from the page
  const screenMatch = pageText.match(/Screen\s*[\n\r]+(\d+)/i);
  const interviewMatch = pageText.match(/Interview\s*[\n\r]+(\d+)/i);
  if (screenMatch || interviewMatch) {
    data.screen = screenMatch ? parseInt(screenMatch[1]) : 0;
    data.interview = interviewMatch ? parseInt(interviewMatch[1]) : 0;
  }

  return data;
}

function parseTextForFeedback(pageText) {
  const entries = [];
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line === 'Submitted' || line === 'Pending') {
      const fb = {
        interviewer: '',
        formType: '',
        decision: line === 'Pending' ? 'pending' : 'unknown',
        status: line.toLowerCase(),
        date: ''
      };

      // Look backwards for context
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        const prev = lines[j];
        if (!fb.formType) {
          if (prev.match(/Interview Feedback/i)) fb.formType = 'Interview';
          else if (prev.match(/Person Screen/i)) fb.formType = 'Phone Screen';
          else if (prev.match(/Quick (Notes|Feedback)/i)) fb.formType = 'Quick Notes';
        }
        if (!fb.interviewer && prev.length > 3 && prev.length < 50 && prev.match(/^[A-Z]/) &&
            !prev.match(/^(Interview|Person|Phone|Quick|Submitted|Pending|Send|Feedback|Form|View|Notes|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i)) {
          fb.interviewer = prev;
        }
      }

      // Look forward for date
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 3); j++) {
        const dateMatch = lines[j].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2},?\s*\d{0,4})/i);
        if (dateMatch) { fb.date = dateMatch[1]; break; }
      }

      if (fb.interviewer || fb.formType) entries.push(fb);
    }
  }
  return entries;
}

function findCandidateInText(pageText) {
  const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 50)) {
    if (line.length > 3 && line.length < 40 && line.match(/^[A-Z][a-z]+[\s-][A-Z]/) &&
        !line.match(/^(Senior|Junior|Staff|Principal|Interview|Person|Phone|Quick|Submitted|Pending|Microsoft|Feedback|All Active|Open|Pipeline|Taiwan|Hong Kong|TALENT)/i)) {
      return line;
    }
  }
  return 'Unknown Candidate';
}
