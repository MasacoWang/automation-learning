/* TA Hub Dashboard - Content Script
 * Reads candidate and feedback data from the TA Hub page
 * and creates a floating summary dashboard.
 */

(function() {
  'use strict';

  // Avoid running twice
  if (document.getElementById('tahub-dashboard')) return;

  // --- DATA EXTRACTION ---

  function extractReqInfo() {
    // Get requisition title and ID from page header
    const titleEl = document.querySelector('h1, [class*="requisition-title"], [class*="job-title"]');
    const title = titleEl ? titleEl.textContent.trim() : 'Unknown Requisition';
    
    // Try to find req ID (usually in format like 200028279)
    const idMatch = document.body.textContent.match(/(\d{9})/);
    const reqId = idMatch ? idMatch[1] : '';

    return { title, reqId };
  }

  function extractStageCounts() {
    // Read the tab counts: Applicants, Review, Screen, Interview, Offer, Hired
    const tabs = document.querySelectorAll('[role="tab"], [class*="tab"], nav a, nav button');
    const stages = {};
    
    tabs.forEach(tab => {
      const text = tab.textContent.trim();
      const match = text.match(/^(Applicants|Review|Screen|Interview|Offer|Pre-Hire|Hired|Prospects|Contacted Prospects)\s*(\d+)?/i);
      if (match) {
        const name = match[1];
        const count = parseInt(match[2]) || 0;
        stages[name] = count;
      }
    });

    return stages;
  }

  function extractCandidates() {
    // Read candidate rows from the list view
    const candidates = [];
    
    // Look for candidate rows (table rows or list items)
    const rows = document.querySelectorAll('[class*="applicant-row"], [class*="candidate-row"], table tbody tr, [class*="list-item"]');
    
    rows.forEach(row => {
      const nameEl = row.querySelector('[class*="name"], [class*="candidate"] a, td:first-child');
      const stageEl = row.querySelector('[class*="stage"], [class*="hiring-stage"], td:nth-child(2)');
      const dateEl = row.querySelector('[class*="date"], [class*="application-time"], td:nth-child(3)');
      const feedbackEl = row.querySelector('[class*="feedback"], td:nth-child(4)');
      
      if (nameEl) {
        const feedbackAvatars = feedbackEl ? feedbackEl.querySelectorAll('[class*="avatar"], img, [class*="circle"]') : [];
        const moreCount = feedbackEl ? feedbackEl.textContent.match(/\+(\d+)/) : null;
        const totalFeedback = feedbackAvatars.length + (moreCount ? parseInt(moreCount[1]) : 0);
        
        candidates.push({
          name: nameEl.textContent.trim().split('\n')[0],
          stage: stageEl ? stageEl.textContent.trim() : 'Unknown',
          date: dateEl ? dateEl.textContent.trim() : '',
          feedbackCount: totalFeedback,
          hasFeedback: totalFeedback > 0
        });
      }
    });

    return candidates;
  }

  function extractFeedbackDetail() {
    // When on candidate detail view - read feedback tab
    const feedbacks = [];
    
    // Look for feedback entries (interviewer rows)
    const feedbackRows = document.querySelectorAll('[class*="feedback-item"], [class*="interviewer-row"], [class*="feedback"] tr');
    
    feedbackRows.forEach(row => {
      const interviewerEl = row.querySelector('[class*="interviewer"], [class*="name"]');
      const statusEl = row.querySelector('[class*="status"]');
      const dateEl = row.querySelector('[class*="date"]');
      
      if (interviewerEl) {
        const statusText = statusEl ? statusEl.textContent.trim() : '';
        feedbacks.push({
          interviewer: interviewerEl.textContent.trim().split('\n')[0],
          status: statusText.toLowerCase().includes('submitted') ? 'submitted' : 
                  statusText.toLowerCase().includes('pending') ? 'pending' : 
                  statusText.toLowerCase().includes('declined') ? 'declined' : 'unknown',
          date: dateEl ? dateEl.textContent.trim() : ''
        });
      }
    });

    return feedbacks;
  }

  // --- DASHBOARD UI ---

  function createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.id = 'tahub-dashboard';
    
    const reqInfo = extractReqInfo();
    const stages = extractStageCounts();
    const candidates = extractCandidates();
    const feedbacks = extractFeedbackDetail();

    // Calculate summary
    const needsAction = candidates.filter(c => !c.hasFeedback && c.stage !== 'Hired');
    const waitingFeedback = candidates.filter(c => c.stage.toLowerCase().includes('interview') || c.stage.toLowerCase().includes('screen'));
    
    const totalSubmitted = feedbacks.filter(f => f.status === 'submitted').length;
    const totalPending = feedbacks.filter(f => f.status === 'pending').length;

    dashboard.innerHTML = `
      <div class="tahub-dash-header">
        <span class="tahub-dash-title">📊 Dashboard</span>
        <button class="tahub-dash-close" onclick="document.getElementById('tahub-dashboard').classList.toggle('tahub-minimized')">−</button>
      </div>
      <div class="tahub-dash-body">
        
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

        ${feedbacks.length > 0 ? `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Feedback Status</div>
          <div class="tahub-feedback-summary">
            <div class="tahub-fb-item tahub-fb-done">✅ Submitted: ${totalSubmitted}</div>
            <div class="tahub-fb-item tahub-fb-pending">⏳ Pending: ${totalPending}</div>
          </div>
          <div class="tahub-feedback-list">
            ${feedbacks.map(f => `
              <div class="tahub-fb-row ${f.status}">
                <span class="tahub-fb-name">${f.interviewer}</span>
                <span class="tahub-fb-status">${f.status === 'submitted' ? '✅' : f.status === 'pending' ? '⏳' : '❓'} ${f.status}</span>
                <span class="tahub-fb-date">${f.date}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <div class="tahub-dash-section">
          <div class="tahub-dash-label">⚡ Quick Actions Needed</div>
          ${candidates.length > 0 ? `
            <div class="tahub-action-list">
              ${candidates.slice(0, 10).map(c => `
                <div class="tahub-action-row">
                  <span class="tahub-action-name">${c.name}</span>
                  <span class="tahub-action-stage">${c.stage}</span>
                  <span class="tahub-action-fb">${c.hasFeedback ? '✅' : '⏳'} ${c.feedbackCount} feedback</span>
                </div>
              `).join('')}
            </div>
          ` : '<p class="tahub-dash-empty">Click into a requisition to see candidates</p>'}
        </div>

        <div class="tahub-dash-section">
          <div class="tahub-dash-label">💡 Recommendation</div>
          <div class="tahub-recommendation">
            ${totalPending > 0 ? `<p>⏳ <strong>${totalPending} feedback(s) pending</strong> — follow up with interviewers</p>` : ''}
            ${totalSubmitted > 0 && totalPending === 0 ? `<p>✅ <strong>All feedback received!</strong> — Ready to make a decision (advance or dispose)</p>` : ''}
            ${feedbacks.length === 0 && candidates.length > 0 ? `<p>📋 <strong>${candidates.length} candidates</strong> in this req. Click each to check their feedback.</p>` : ''}
            ${feedbacks.length === 0 && candidates.length === 0 ? `<p>Navigate to a requisition to see the dashboard.</p>` : ''}
          </div>
        </div>

        <div class="tahub-dash-footer">
          <button class="tahub-refresh-btn" onclick="window.tahubRefresh()">🔄 Refresh</button>
          <span class="tahub-dash-time">Updated: ${new Date().toLocaleTimeString()}</span>
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
  
  // Wait for page to load, then create dashboard
  function init() {
    // Wait a bit for dynamic content to render
    setTimeout(createDashboard, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-scan when URL changes (SPA navigation)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(window.tahubRefresh, 2000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
