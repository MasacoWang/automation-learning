/* TA Hub Dashboard - Content Script
 * Reads candidate and feedback data from the TA Hub page
 * and creates a floating summary dashboard.
 * 
 * Selectors based on actual TA Hub (CareerHub) HTML structure:
 * - App root: #ta-app
 * - Pipeline: .pipelineRightPaneContent
 * - Candidate names: [class*="candidateName"]
 * - Table rows: [class*="octable-module"][class*="table-row"]
 * - Workflow tabs: [class*="workflowTabs"]
 */

(function() {
  'use strict';

  // Avoid running twice
  if (document.getElementById('tahub-dashboard')) return;

  // --- HELPER: Find elements by partial class name ---
  function queryByPartialClass(parent, partial) {
    return parent.querySelectorAll(`[class*="${partial}"]`);
  }

  function queryOneByPartialClass(parent, partial) {
    return parent.querySelector(`[class*="${partial}"]`);
  }

  // --- DATA EXTRACTION ---

  function extractReqInfo() {
    // Look for table-summary span or pipeline header
    const summaryEl = document.querySelector('[id*="table-summary"], [class*="pipelineHeader"]');
    const title = summaryEl ? summaryEl.textContent.trim() : '';
    
    // Try header area
    const headerEl = queryOneByPartialClass(document, 'headerContainer');
    const headerText = headerEl ? headerEl.textContent.trim() : '';

    return { title: headerText || title || 'Current Requisition' };
  }

  function extractStageCounts() {
    // Read the workflow tabs (Applicants, Review, Screen, Interview, etc.)
    const tabContainer = queryOneByPartialClass(document, 'workflowTabs') || 
                          queryOneByPartialClass(document, 'pipeline-preview-workflow-tabs');
    const stages = {};
    
    if (tabContainer) {
      // Find all tab elements
      const tabs = tabContainer.querySelectorAll('[role="tab"], button, a, [class*="tab"]');
      tabs.forEach(tab => {
        const text = tab.textContent.trim();
        // Match patterns like "Applicants 92" or "Interview (8)" or just number in child element
        const match = text.match(/(Applicants|Review|Screen|Interview|Offer|Pre-Hire|Hired|Prospects|Contacted\s*Prospects)[^\d]*(\d+)/i);
        if (match) {
          stages[match[1]] = parseInt(match[2]) || 0;
        }
      });
    }

    // Fallback: scan all text for stage patterns
    if (Object.keys(stages).length === 0) {
      const allText = document.body.innerText;
      const stageNames = ['Applicants', 'Review', 'Screen', 'Interview', 'Offer', 'Pre-Hire', 'Hired', 'Prospects'];
      stageNames.forEach(name => {
        const regex = new RegExp(name + '\\s*(\\d+)', 'i');
        const m = allText.match(regex);
        if (m) stages[name] = parseInt(m[1]);
      });
    }

    return stages;
  }

  function extractCandidates() {
    const candidates = [];
    
    // Find candidate rows using octable structure
    const tableBody = queryOneByPartialClass(document, 'octable-module_table') || 
                      document.querySelector('table tbody') ||
                      queryOneByPartialClass(document, 'table-module');
    
    if (!tableBody) return candidates;

    // Get all rows
    const rows = tableBody.querySelectorAll('tr, [class*="table-row"]');
    
    rows.forEach(row => {
      // Candidate name - look for the specific class pattern
      const nameEl = queryOneByPartialClass(row, 'candidateName') || 
                     row.querySelector('a[href*="candidate"], a[href*="applicant"]') ||
                     row.querySelector('td:first-child a');
      
      if (!nameEl) return;
      
      const name = nameEl.textContent.trim().split('\n')[0];
      if (!name || name.length < 2) return;

      // Stage/status
      const cells = row.querySelectorAll('td, [class*="table-cell"]');
      let stage = '';
      let date = '';
      let feedbackCount = 0;

      cells.forEach((cell, i) => {
        const text = cell.textContent.trim();
        // Check for stage names
        if (text.match(/^(Review|Screen|Interview|Offer|Hired|Applied|New)/i)) {
          stage = text;
        }
        // Check for dates
        if (text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || text.match(/\d{4}-\d{2}-\d{2}/)) {
          date = text;
        }
        // Check for feedback avatars/icons
        const avatars = cell.querySelectorAll('[class*="avatar"], [class*="profile"], img[class*="round"], [class*="feedback"]');
        if (avatars.length > 0) {
          feedbackCount = avatars.length;
          // Check for "+N" more indicator
          const moreMatch = cell.textContent.match(/\+(\d+)/);
          if (moreMatch) feedbackCount += parseInt(moreMatch[1]);
        }
      });

      candidates.push({
        name,
        stage: stage || 'Unknown',
        date,
        feedbackCount,
        hasFeedback: feedbackCount > 0
      });
    });

    return candidates;
  }

  function extractFeedbackDetail() {
    // When viewing a candidate's Feedback tab
    const feedbacks = [];
    
    // Look for the feedback section - could be in right panel
    const rightPane = queryOneByPartialClass(document, 'pipelineRightPane') || document.body;
    
    // Find feedback-related containers
    const feedbackContainers = rightPane.querySelectorAll(
      '[class*="feedback"], [class*="interview"], [class*="evaluation"]'
    );

    feedbackContainers.forEach(container => {
      // Look for rows within feedback sections
      const rows = container.querySelectorAll('tr, [class*="row"], [class*="item"]');
      
      rows.forEach(row => {
        const text = row.textContent.trim();
        if (text.length < 5) return;
        
        // Check if this row has a status indicator
        const hasSubmitted = text.toLowerCase().includes('submitted') || text.toLowerCase().includes('completed');
        const hasPending = text.toLowerCase().includes('pending') || text.toLowerCase().includes('not started');
        const hasDeclined = text.toLowerCase().includes('declined');
        
        if (!hasSubmitted && !hasPending && !hasDeclined) return;

        // Try to extract interviewer name (usually the first text element)
        const nameEl = row.querySelector('a, [class*="name"], [class*="person"], span:first-child');
        const interviewer = nameEl ? nameEl.textContent.trim().split('\n')[0] : text.split(/\s{2,}/)[0];
        
        if (interviewer && interviewer.length > 2 && interviewer.length < 50) {
          // Extract date if present
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})/);
          
          feedbacks.push({
            interviewer: interviewer.substring(0, 30),
            status: hasSubmitted ? 'submitted' : hasPending ? 'pending' : 'declined',
            date: dateMatch ? dateMatch[1] : ''
          });
        }
      });
    });

    // Deduplicate by interviewer name
    const seen = new Set();
    return feedbacks.filter(f => {
      if (seen.has(f.interviewer)) return false;
      seen.add(f.interviewer);
      return true;
    });
  }

  // --- DASHBOARD UI ---

  function createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'tahub-dashboard';
    
    const reqInfo = extractReqInfo();
    const stages = extractStageCounts();
    const candidates = extractCandidates();
    const feedbacks = extractFeedbackDetail();

    const totalSubmitted = feedbacks.filter(f => f.status === 'submitted').length;
    const totalPending = feedbacks.filter(f => f.status === 'pending').length;
    const totalCandidates = candidates.length;
    const stageCount = Object.keys(stages).length;

    dashboard.innerHTML = `
      <div class="tahub-dash-header">
        <span class="tahub-dash-title">📊 Dashboard</span>
        <button class="tahub-dash-close" onclick="document.getElementById('tahub-dashboard').classList.toggle('tahub-minimized')">−</button>
      </div>
      <div class="tahub-dash-body">
        
        ${stageCount > 0 ? `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Pipeline Summary</div>
          <div class="tahub-dash-stages">
            ${Object.entries(stages).map(([name, count]) => `
              <div class="tahub-stage-item">
                <span class="tahub-stage-name">${name}</span>
                <span class="tahub-stage-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Pipeline Summary</div>
          <p class="tahub-dash-empty">Navigate to a requisition to see pipeline data</p>
        </div>
        `}

        ${feedbacks.length > 0 ? `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Feedback Status (${feedbacks.length} interviewers)</div>
          <div class="tahub-feedback-summary">
            <div class="tahub-fb-item tahub-fb-done">✅ Done: ${totalSubmitted}</div>
            <div class="tahub-fb-item tahub-fb-pending">⏳ Pending: ${totalPending}</div>
          </div>
          <div class="tahub-feedback-list">
            ${feedbacks.map(f => `
              <div class="tahub-fb-row ${f.status}">
                <span class="tahub-fb-name">${f.interviewer}</span>
                <span class="tahub-fb-status">${f.status === 'submitted' ? '✅' : f.status === 'pending' ? '⏳' : '❌'}</span>
                <span class="tahub-fb-date">${f.date}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Feedback Status</div>
          <p class="tahub-dash-empty">Click a candidate → Feedback tab to see interviewer status</p>
        </div>
        `}

        ${totalCandidates > 0 ? `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Candidates Found: ${totalCandidates}</div>
          <div class="tahub-action-list">
            ${candidates.slice(0, 8).map(c => `
              <div class="tahub-action-row">
                <span class="tahub-action-name">${c.name}</span>
                <span class="tahub-action-stage">${c.stage}</span>
                <span class="tahub-action-fb">${c.feedbackCount > 0 ? '💬' + c.feedbackCount : '—'}</span>
              </div>
            `).join('')}
            ${totalCandidates > 8 ? `<p style="text-align:center;color:#9ca3af;font-size:11px;">+ ${totalCandidates - 8} more</p>` : ''}
          </div>
        </div>
        ` : ''}

        <div class="tahub-dash-section">
          <div class="tahub-dash-label">💡 Recommendation</div>
          <div class="tahub-recommendation">
            ${totalPending > 0 ? `<p>⏳ <strong>${totalPending} pending feedback</strong> — chase the interviewers</p>` : ''}
            ${totalSubmitted > 0 && totalPending === 0 ? `<p>✅ <strong>All feedback in!</strong> — Make your decision: advance or dispose</p>` : ''}
            ${feedbacks.length === 0 && totalCandidates > 0 ? `<p>📋 ${totalCandidates} candidates found. Click into each to check their feedback tab.</p>` : ''}
            ${feedbacks.length === 0 && totalCandidates === 0 ? `<p>👉 Open a requisition and click the Interview or Screen tab</p>` : ''}
          </div>
        </div>

        <div class="tahub-dash-footer">
          <button class="tahub-refresh-btn" onclick="window.tahubRefresh()">🔄 Refresh</button>
          <span class="tahub-dash-time">${new Date().toLocaleTimeString()}</span>
        </div>
      </div>
    `;

    document.body.appendChild(dashboard);
  }

  // Refresh function
  window.tahubRefresh = function() {
    const existing = document.getElementById('tahub-dashboard');
    if (existing) existing.remove();
    createDashboard();
  };

  // --- INIT ---
  function init() {
    // Wait for SPA content to render
    setTimeout(createDashboard, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-scan when page content changes (SPA navigation)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(window.tahubRefresh, 3000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
