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
    
    // Look for the feedback section - try multiple parent containers
    const rightPane = queryOneByPartialClass(document, 'pipelineRightPane') || 
                      queryOneByPartialClass(document, 'rightPane') ||
                      queryOneByPartialClass(document, 'detail') ||
                      queryOneByPartialClass(document, 'candidateDetail') ||
                      document.body;
    
    // DEBUG: Log what we find to console
    console.log('[TA Hub Dashboard] Searching for feedback in:', rightPane.className || 'body');
    
    // Get ALL text content to check what keywords exist on page
    const pageText = rightPane.textContent || '';
    const hasSubmittedText = pageText.includes('Submitted');
    const hasPendingText = pageText.includes('Pending');
    const hasFeedbackText = pageText.toLowerCase().includes('feedback');
    console.log('[TA Hub Dashboard] Found keywords - Submitted:', hasSubmittedText, 'Pending:', hasPendingText, 'Feedback:', hasFeedbackText);
    
    // Strategy: Search broadly for ANY element containing status text
    // Use a wider selector to catch any structure
    const allElements = rightPane.querySelectorAll('*');
    const statusElements = [];
    
    allElements.forEach(el => {
      // Only check leaf-ish elements (not too deep containers)
      if (el.children.length > 20) return;
      const text = el.textContent.trim();
      // Find elements that contain "Submitted" or "Pending" but are not too large
      if (text.length > 10 && text.length < 300 && 
          (text.includes('Submitted') || text.includes('Pending since') || text.includes('Pending'))) {
        // Avoid duplicates by checking if parent already in list
        const isChild = statusElements.some(parent => parent.contains(el) && parent !== el);
        const isParent = statusElements.some(child => el.contains(child) && el !== child);
        if (!isChild && !isParent) {
          statusElements.push(el);
        } else if (isParent) {
          // Replace parent with this more specific element
          const idx = statusElements.findIndex(child => el.contains(child) && el !== child);
          if (idx >= 0) statusElements[idx] = el;
        }
      }
    });
    
    console.log('[TA Hub Dashboard] Found status elements:', statusElements.length);
    statusElements.forEach((el, i) => {
      console.log(`[TA Hub Dashboard] Element ${i}:`, el.textContent.trim().substring(0, 100));
    });

    // Process each feedback row
    statusElements.forEach(row => {
      const text = row.textContent.trim();
      
      const hasSubmitted = text.includes('Submitted');
      const hasPending = text.includes('Pending');
      
      if (!hasSubmitted && !hasPending) return;
      
      // --- DETECT HIRE / NO HIRE ---
      // Green thumbs up = Hire, Red thumbs down = No Hire
      let decision = 'none'; // none = pending, hire = thumbs up, no_hire = thumbs down
      
      if (hasSubmitted) {
        // Look for thumbs up/down icons by color or class
        const icons = row.querySelectorAll('svg, [class*="icon"], [class*="thumb"], img, i');
        icons.forEach(icon => {
          const style = window.getComputedStyle(icon);
          const color = style.color || style.fill || '';
          const cls = icon.className || '';
          const parentCls = icon.parentElement?.className || '';
          const svgContent = icon.outerHTML.toLowerCase();
          
          // Green = hire (thumbs up)
          if (color.includes('rgb(0, 128') || color.includes('rgb(16, 185') || 
              color.includes('green') || color.includes('#10b981') ||
              cls.includes('success') || cls.includes('positive') || cls.includes('green') ||
              cls.includes('thumb-up') || cls.includes('thumbUp') ||
              parentCls.includes('success') || parentCls.includes('positive') || parentCls.includes('green') ||
              svgContent.includes('thumb') && (svgContent.includes('green') || svgContent.includes('success'))) {
            decision = 'hire';
          }
          
          // Red = no hire (thumbs down)
          if (color.includes('rgb(239') || color.includes('rgb(220') || color.includes('rgb(255, 0') ||
              color.includes('red') || color.includes('#ef4444') || color.includes('#dc2626') ||
              cls.includes('danger') || cls.includes('negative') || cls.includes('red') ||
              cls.includes('thumb-down') || cls.includes('thumbDown') ||
              parentCls.includes('danger') || parentCls.includes('negative') || parentCls.includes('red') ||
              svgContent.includes('thumb') && (svgContent.includes('red') || svgContent.includes('danger'))) {
            decision = 'no_hire';
          }
        });
        
        // Fallback: check background color of icon container
        const iconContainers = row.querySelectorAll('[class*="status"] *, [class*="icon"]');
        iconContainers.forEach(el => {
          const bg = window.getComputedStyle(el).backgroundColor;
          if (bg && (bg.includes('rgb(16, 185') || bg.includes('rgb(5, 150') || bg.includes('rgb(34, 197'))) {
            decision = 'hire';
          }
          if (bg && (bg.includes('rgb(239, 68') || bg.includes('rgb(220, 38') || bg.includes('rgb(248, 113'))) {
            decision = 'no_hire';
          }
        });
        
        // Fallback 2: aria-label or title attributes on icons
        const allEls = row.querySelectorAll('[aria-label], [title]');
        allEls.forEach(el => {
          const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
          if (label.includes('hire') && !label.includes('no hire') && !label.includes('not hire')) {
            decision = 'hire';
          }
          if (label.includes('no hire') || label.includes('not hire') || label.includes('reject')) {
            decision = 'no_hire';
          }
        });
      }

      // Extract interviewer name
      const nameEl = row.querySelector('a, [class*="name"], [class*="person"], [class*="interviewer"]');
      let interviewer = '';
      if (nameEl) {
        interviewer = nameEl.textContent.trim().split('\n')[0];
      } else {
        // First meaningful text chunk is likely the name
        const spans = row.querySelectorAll('span, div, p');
        for (const span of spans) {
          const t = span.textContent.trim();
          if (t.length > 2 && t.length < 40 && !t.includes('Submitted') && 
              !t.includes('Pending') && !t.includes('Interview feedback') &&
              !t.includes('Phone screen') && !t.includes('feedback form') &&
              !t.includes('Send reminder') && !t.match(/\d{4}/)) {
            interviewer = t;
            break;
          }
        }
      }
      
      if (!interviewer || interviewer.length < 2 || interviewer.length > 50) return;

      // --- DETECT FEEDBACK FORM TYPE ---
      // "Interview feedback form" = Interview stage
      // "Phone screen feedback form" = Phone Screen stage
      let formType = 'other';
      if (text.toLowerCase().includes('phone screen')) {
        formType = 'phone_screen';
      } else if (text.toLowerCase().includes('interview feedback') || text.toLowerCase().includes('interview form')) {
        formType = 'interview';
      } else if (text.toLowerCase().includes('debrief')) {
        formType = 'debrief';
      }

      // Extract date
      const dateMatch = text.match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/);
      
      feedbacks.push({
        interviewer: interviewer.substring(0, 30),
        status: hasSubmitted ? 'submitted' : 'pending',
        decision: hasSubmitted ? decision : 'none',
        formType,
        date: dateMatch ? dateMatch[1] : ''
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
    const totalHire = feedbacks.filter(f => f.decision === 'hire').length;
    const totalNoHire = feedbacks.filter(f => f.decision === 'no_hire').length;
    const totalCandidates = candidates.length;
    const stageCount = Object.keys(stages).length;

    // Group feedbacks by form type
    const phoneScreenFeedbacks = feedbacks.filter(f => f.formType === 'phone_screen');
    const interviewFeedbacks = feedbacks.filter(f => f.formType === 'interview');
    const debriefFeedbacks = feedbacks.filter(f => f.formType === 'debrief');
    const otherFeedbacks = feedbacks.filter(f => f.formType === 'other');

    // Decision logic
    let overallDecision = '';
    if (feedbacks.length > 0 && totalPending === 0) {
      if (totalNoHire === 0 && totalHire > 0) {
        overallDecision = 'all_hire';
      } else if (totalNoHire > 0 && totalHire === 0) {
        overallDecision = 'all_no_hire';
      } else if (totalNoHire > 0 && totalHire > 0) {
        overallDecision = 'mixed';
      }
    }

    // Helper: render a feedback group
    function renderFeedbackGroup(title, icon, groupFeedbacks) {
      if (groupFeedbacks.length === 0) return '';
      const groupHire = groupFeedbacks.filter(f => f.decision === 'hire').length;
      const groupNoHire = groupFeedbacks.filter(f => f.decision === 'no_hire').length;
      const groupPending = groupFeedbacks.filter(f => f.status === 'pending').length;
      
      return `
        <div class="tahub-form-group">
          <div class="tahub-form-group-header">
            <span>${icon} ${title}</span>
            <span class="tahub-form-group-summary">
              ${groupHire > 0 ? `<span class="tahub-badge-hire">👍${groupHire}</span>` : ''}
              ${groupNoHire > 0 ? `<span class="tahub-badge-nohire">👎${groupNoHire}</span>` : ''}
              ${groupPending > 0 ? `<span class="tahub-badge-pending">⏳${groupPending}</span>` : ''}
            </span>
          </div>
          ${groupFeedbacks.map(f => `
            <div class="tahub-fb-row ${f.status} ${f.decision}">
              <span class="tahub-fb-decision">${f.decision === 'hire' ? '👍' : f.decision === 'no_hire' ? '👎' : '⏳'}</span>
              <span class="tahub-fb-name">${f.interviewer}</span>
              <span class="tahub-fb-status">${f.status === 'submitted' ? (f.decision === 'hire' ? 'Hire' : f.decision === 'no_hire' ? 'No Hire' : 'Done') : 'Pending'}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

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
          <div class="tahub-dash-label">Feedback & Decision (${feedbacks.length} total)</div>
          <div class="tahub-feedback-summary">
            <div class="tahub-fb-item tahub-fb-done">👍 Hire: ${totalHire}</div>
            <div class="tahub-fb-item tahub-fb-nohire">👎 No: ${totalNoHire}</div>
            <div class="tahub-fb-item tahub-fb-pending">⏳ Wait: ${totalPending}</div>
          </div>
          
          ${overallDecision ? `
          <div class="tahub-decision-banner ${overallDecision}">
            ${overallDecision === 'all_hire' ? '✅ ALL HIRE → Advance candidate' : ''}
            ${overallDecision === 'all_no_hire' ? '❌ ALL NO HIRE → Dispose candidate' : ''}
            ${overallDecision === 'mixed' ? '⚠️ MIXED — Review with hiring manager' : ''}
          </div>
          ` : ''}
          
          <div class="tahub-feedback-groups">
            ${renderFeedbackGroup('Phone Screen', '📞', phoneScreenFeedbacks)}
            ${renderFeedbackGroup('Interview', '🎤', interviewFeedbacks)}
            ${renderFeedbackGroup('Debrief', '📋', debriefFeedbacks)}
            ${renderFeedbackGroup('Other', '📝', otherFeedbacks)}
          </div>
        </div>
        ` : `
        <div class="tahub-dash-section">
          <div class="tahub-dash-label">Feedback Status</div>
          <p class="tahub-dash-empty">Click a candidate → Feedback tab to see interviewer decisions</p>
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
            ${overallDecision === 'all_hire' ? `<p>🎉 <strong>All positive!</strong> Advance this candidate to the next stage.</p>` : ''}
            ${overallDecision === 'all_no_hire' ? `<p>🚫 <strong>All negative.</strong> Dispose this candidate with a rejection email.</p>` : ''}
            ${overallDecision === 'mixed' ? `<p>⚠️ <strong>Mixed feedback (${totalHire} hire, ${totalNoHire} no hire).</strong> Discuss with hiring manager before deciding.</p>` : ''}
            ${totalPending > 0 ? `<p>⏳ <strong>${totalPending} pending feedback</strong> — chase the interviewers or send a reminder</p>` : ''}
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
