/**
 * Autonomous AI Human Simulation - Admin Control Panel Controller
 */

class AdminApp {
  constructor() {
    this.currentTab = 'sim-view';
    this.snapshot = null;
    this.refreshInterval = null;
    this.worldCanvas = null;
    this.agentFilters = {
      search: '',
      status: '',
      activity: '',
      location: '',
      belief: '',
      sortBy: 'id',
      sortOrder: 'asc',
      page: 1,
      limit: 15
    };
    this.rewardFilters = {
      search: '',
      pointType: '',
      isReversal: '',
      page: 1,
      limit: 15
    };
    this.auditFilters = {
      search: '',
      targetType: '',
      page: 1,
      limit: 20
    };
    this.prayerFilters = {
      search: '',
      category: '',
      status: '',
      page: 1,
      limit: 10
    };
    this.selectedAgentId = null;
    this.currentReviewPrayer = null;

    this.init();
  }

  async init() {
    this.bindEvents();

    // Check if initial admin account setup is needed
    try {
      const status = await window.apiClient.checkSetupStatus();
      if (!status.hasAdmin) {
        this.showSetupModal();
        return;
      }
    } catch (e) {
      console.warn('Setup status check failed:', e);
    }

    // Check current session
    const session = await window.apiClient.getCurrentSession();
    if (!session) {
      this.showLoginModal();
    } else {
      this.onAuthenticated(session.admin);
    }

    // Hook auth required
    window.apiClient.onAuthRequired = () => {
      this.showLoginModal();
    };
  }

  onAuthenticated(admin) {
    this.hideModals();
    document.getElementById('admin-name-display').textContent = admin.username;
    document.getElementById('admin-role-display').textContent = admin.role;

    // Start live polling loop for simulation state
    this.startLivePolling();

    // Init 2D canvas if on sim-view
    this.initCanvasIfNeeded();

    // Render active tab
    this.renderCurrentTab();
  }

  startLivePolling() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.fetchSnapshot();
    this.refreshInterval = setInterval(() => {
      this.fetchSnapshot();
    }, 2500);
  }

  async fetchSnapshot() {
    try {
      const data = await window.apiClient.getWorldSnapshot();
      this.snapshot = data;
      this.updateHeaderAndWidgets(data);

      if (this.worldCanvas) {
        this.worldCanvas.updateState(data.agents, data.locations);
      }

      // If overview is visible, update KPI numbers in place
      if (this.currentTab === 'overview') {
        this.updateOverviewLiveMetrics(data);
      }
    } catch (err) {
      console.warn('Snapshot fetch error:', err);
    }
  }

  updateHeaderAndWidgets(data) {
    // Clock & Weather
    const clockEl = document.getElementById('world-clock-text');
    if (clockEl) clockEl.textContent = `${data.worldTime} • ${data.weather}`;

    // Sidebar Engine Status Pulse
    const pulseEl = document.getElementById('engine-pulse-dot');
    const statusTextEl = document.getElementById('engine-status-text');
    if (pulseEl && statusTextEl) {
      if (data.isRunning) {
        pulseEl.className = 'pulse-dot';
        statusTextEl.textContent = 'Engine Running';
      } else {
        pulseEl.className = 'pulse-dot paused';
        statusTextEl.textContent = 'Engine Paused';
      }
    }

    // Sidebar Badges
    const totalBadge = document.getElementById('sidebar-total-badge');
    if (totalBadge) totalBadge.textContent = data.kpis.totalAgents;

    const activeBadge = document.getElementById('sidebar-active-badge');
    if (activeBadge) activeBadge.textContent = data.kpis.activeAgents;

    const inactiveBadge = document.getElementById('sidebar-inactive-badge');
    const inactiveCount = data.kpis.pausedAgents + data.kpis.deactivatedAgents;
    if (inactiveBadge) {
      inactiveBadge.textContent = inactiveCount;
      inactiveBadge.className = inactiveCount > 0 ? 'nav-badge alert' : 'nav-badge';
    }

    const prayersBadge = document.getElementById('sidebar-prayers-badge');
    if (prayersBadge) {
      const pCount = data.kpis.pendingPrayers !== undefined ? data.kpis.pendingPrayers : 0;
      prayersBadge.textContent = pCount;
      prayersBadge.className = pCount > 0 ? 'nav-badge alert' : 'nav-badge';
    }

    const deceasedBadge = document.getElementById('sidebar-deceased-badge');
    if (deceasedBadge) {
      deceasedBadge.textContent = data.kpis.deceasedAgents !== undefined ? data.kpis.deceasedAgents : 0;
    }

    const headerDeaths = document.getElementById('header-deaths-count');
    if (headerDeaths) {
      headerDeaths.textContent = data.kpis.deceasedAgents !== undefined ? data.kpis.deceasedAgents : 0;
    }

    // Temporal Simulation & Solar System Speed Sync
    const spd = (data.timeSpeedMultiplier || (data.settings && data.settings.time_speed_multiplier) || 1.0);
    const speedVal = parseFloat(spd) || 1.0;
    const speedEls = document.querySelectorAll('.sim-speed-val, .solar-speed-display');
    speedEls.forEach(el => {
      el.textContent = `${speedVal.toFixed(1)}x`;
    });
    const speedSlider = document.getElementById('solar-speed-slider');
    if (speedSlider && document.activeElement !== speedSlider) {
      speedSlider.value = speedVal;
    }
    if (this.worldCanvas && !this.userAdjustedSpeedManually) {
      this.worldCanvas.solarSpeedMultiplier = speedVal;
      this.worldCanvas.updateSolarControlsUI();
    }
  }

  initCanvasIfNeeded() {
    const canvasEl = document.getElementById('simulation-canvas');
    if (canvasEl && !this.worldCanvas) {
      this.worldCanvas = new window.SimulationWorldCanvas(canvasEl, (agent) => {
        this.openAgentDetailModal(agent.id);
      });
      if (this.snapshot) {
        this.worldCanvas.updateState(this.snapshot.agents, this.snapshot.locations);
      }
    }
  }

  bindEvents() {
    // Sidebar Tab Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        document.querySelector('.app-sidebar').classList.toggle('mobile-open');
      });
    }

    // Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          await window.apiClient.logout();
          this.showToast('Logged out successfully.', 'info');
          this.showLoginModal();
        } catch (e) {
          this.showToast(e.message, 'error');
        }
      });
    }

    // Modal Close buttons
    document.querySelectorAll('.modal-close, [data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => this.hideModals());
    });

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        try {
          const res = await window.apiClient.login(u, p);
          this.showToast(`Welcome back, ${res.admin.username}!`, 'success');
          this.onAuthenticated(res.admin);
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }

    // Initial Setup Form Submit
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
      setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('setup-username').value;
        const p = document.getElementById('setup-password').value;
        const p2 = document.getElementById('setup-password-confirm').value;

        if (p !== p2) {
          this.showToast('Passwords do not match.', 'error');
          return;
        }

        try {
          const res = await window.apiClient.initialSetup(u, p);
          this.showToast('Administrator created successfully!', 'success');
          this.onAuthenticated(res.admin);
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      });
    }
  }

  switchTab(tabName) {
    this.currentTab = tabName;

    // Update nav active classes
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      if (item.dataset.tab === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Close mobile sidebar if open
    document.querySelector('.app-sidebar').classList.remove('mobile-open');

    // Update Header title
    const titles = {
      'sim-view': 'Simulation World Live Viewer',
      'overview': 'Simulation Executive Overview',
      'agents': 'Human Agent Directory',
      'active-agents': 'Active Autonomous Agents',
      'inactive-agents': 'Paused & Deactivated Agents',
      'prayers': 'Prayers & Mannats Inbox (Spiritual Review)',
      'lifecycles': 'Life Cycle, Aging & Death System',
      'beliefs': 'Belief Profile Management',
      'rewards': 'Configurable Reward Center',
      'settings': 'Simulation Engine Settings',
      'audit': 'Security & Administrative Audit Logs'
    };
    const titleEl = document.getElementById('current-page-title');
    if (titleEl) titleEl.textContent = titles[tabName] || 'Dashboard';

    // Show/hide view containers
    document.querySelectorAll('.tab-view-container').forEach(el => {
      el.style.display = el.id === `view-${tabName}` ? 'block' : 'none';
    });

    this.renderCurrentTab();
  }

  renderCurrentTab() {
    switch (this.currentTab) {
      case 'sim-view':
        this.initCanvasIfNeeded();
        if (this.worldCanvas && this.snapshot) {
          this.worldCanvas.resize();
          this.worldCanvas.updateState(this.snapshot.agents, this.snapshot.locations);
        }
        break;
      case 'overview':
        this.renderOverviewTab();
        break;
      case 'agents':
        this.agentFilters.status = '';
        this.renderAgentsTab();
        break;
      case 'active-agents':
        this.agentFilters.status = 'active';
        this.renderAgentsTab();
        break;
      case 'inactive-agents':
        this.renderInactiveAgentsTab();
        break;
      case 'prayers':
        this.renderPrayersTab();
        break;
      case 'lifecycles':
        this.renderLifecyclesTab();
        break;
      case 'beliefs':
        this.renderBeliefsTab();
        break;
      case 'rewards':
        this.renderRewardsTab();
        break;
      case 'settings':
        this.renderSettingsTab();
        break;
      case 'audit':
        this.renderAuditTab();
        break;
    }
  }

  // ==========================================
  // TAB: OVERVIEW
  // ==========================================
  async renderOverviewTab() {
    if (!this.snapshot) await this.fetchSnapshot();
    if (!this.snapshot) return;

    this.updateOverviewLiveMetrics(this.snapshot);
  }

  updateOverviewLiveMetrics(data) {
    const k = data.kpis;
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('kpi-total-agents', k.totalAgents);
    setTxt('kpi-active-agents', k.activeAgents);
    setTxt('kpi-paused-agents', k.pausedAgents);
    setTxt('kpi-deactivated-agents', k.deactivatedAgents);
    setTxt('kpi-sleeping-agents', k.sleepingAgents);
    setTxt('kpi-total-born', k.totalBorn !== undefined ? k.totalBorn : 0);
    setTxt('kpi-max-generation', `Gen ${k.maxGeneration !== undefined ? k.maxGeneration : 1}`);
    setTxt('kpi-living-agents', k.livingAgents !== undefined ? k.livingAgents : k.totalAgents);
    setTxt('kpi-deceased-agents', k.deceasedAgents !== undefined ? k.deceasedAgents : 0);
    setTxt('header-deaths-count', k.deceasedAgents !== undefined ? k.deceasedAgents : 0);
    setTxt('kpi-pending-prayers', k.pendingPrayers !== undefined ? k.pendingPrayers : 0);
    setTxt('kpi-fulfilled-prayers', k.fulfilledPrayers !== undefined ? k.fulfilledPrayers : 0);

    const deceasedListContainer = document.getElementById('overview-deceased-list');
    if (deceasedListContainer) {
      this.renderOverviewDeceased(deceasedListContainer);
    }

    // Activities
    setTxt('kpi-act-working', k.activities.working);
    setTxt('kpi-act-eating', k.activities.eating);
    setTxt('kpi-act-walking', k.activities.walking);
    setTxt('kpi-act-resting', k.activities.resting);
    setTxt('kpi-act-socializing', k.activities.socializing);

    // Beliefs
    setTxt('kpi-belief-god', k.beliefs['Trusts in God'] || 0);
    setTxt('kpi-belief-nogod', k.beliefs['Does not trust in God'] || 0);
    setTxt('kpi-belief-unsure', k.beliefs['Unsure or undecided'] || 0);
    setTxt('kpi-belief-unspec', k.beliefs['Belief not specified'] || 0);

    // Rewards
    setTxt('kpi-rewards-issued', `${k.rewards.totalIssued.toFixed(0)} pts`);
    setTxt('kpi-rewards-reversed', `${k.rewards.totalReversed.toFixed(0)} pts`);
    setTxt('kpi-rewards-net', `${k.rewards.netPoints.toFixed(0)} pts`);

    // Recent World Events Feed
    const eventsContainer = document.getElementById('overview-recent-events');
    if (eventsContainer) {
      if (data.recentEvents.length === 0) {
        eventsContainer.innerHTML = '<div style="color:var(--text-muted);padding:10px;">No recent events recorded.</div>';
      } else {
        eventsContainer.innerHTML = data.recentEvents.map(evt => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);">${new Date(evt.timestamp).toLocaleTimeString()}</span>
            <div style="flex:1;">
              <span style="color:#fff;font-weight:500;">${this.escapeHtml(evt.message)}</span>
            </div>
          </div>
        `).join('');
      }
    }

    // Recent Administrative Activity Feed
    const adminLogsContainer = document.getElementById('overview-admin-activity');
    if (adminLogsContainer) {
      if (data.recentAdminLogs.length === 0) {
        adminLogsContainer.innerHTML = '<div style="color:var(--text-muted);padding:10px;">No administrative activity yet.</div>';
      } else {
        adminLogsContainer.innerHTML = data.recentAdminLogs.map(l => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-dim);">${new Date(l.timestamp).toLocaleTimeString()}</span>
            <div style="flex:1;">
              <strong style="color:var(--primary-400);">${this.escapeHtml(l.actor)}:</strong>
              <span style="color:#e2e8f0;"> ${this.escapeHtml(l.action)}</span>
              ${l.target_name ? `<span style="color:var(--text-muted);"> &rarr; ${this.escapeHtml(l.target_name)}</span>` : ''}
            </div>
          </div>
        `).join('');
      }
    }
  }

  // ==========================================
  // TAB: AGENTS MANAGEMENT & ACTIVE/INACTIVE
  // ==========================================
  async renderAgentsTab() {
    const isActiveTab = this.currentTab === 'active-agents';
    const containerId = isActiveTab ? 'agents-table-body-active' : 'agents-table-body';
    const paginationId = isActiveTab ? 'active-agents-pagination' : 'agents-pagination';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;">Loading human agents...</td></tr>';

    try {
      const filters = { ...this.agentFilters };
      if (isActiveTab) {
        filters.status = 'active';
      }
      const res = await window.apiClient.getAgents(filters);
      this.populateAgentsTable(res.data, container);
      this.renderPagination(paginationId, res.pagination, (newPage) => {
        this.agentFilters.page = newPage;
        this.renderAgentsTab();
      });
    } catch (err) {
      container.innerHTML = `<tr><td colspan="8" style="color:var(--danger-text);padding:20px;">Failed to load agents: ${err.message}</td></tr>`;
    }
  }

  async renderInactiveAgentsTab() {
    const container = document.getElementById('inactive-agents-table-body');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Loading paused and deactivated agents...</td></tr>';

    try {
      // Query both paused and deactivated agents
      const p1 = window.apiClient.getAgents({ status: 'paused', limit: 50 });
      const p2 = window.apiClient.getAgents({ status: 'deactivated', limit: 50 });
      const [resPaused, resDeactivated] = await Promise.all([p1, p2]);
      const combined = [...resPaused.data, ...resDeactivated.data];

      if (combined.length === 0) {
        container.innerHTML = `
          <tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">
            No inactive agents found. All agents are currently active in the simulation.
          </td></tr>
        `;
        return;
      }

      container.innerHTML = combined.map(agent => {
        const isPaused = agent.runtime_status === 'paused';
        return `
          <tr>
            <td>
              <div class="agent-cell">
                <span class="agent-avatar-icon">${agent.avatar || '👤'}</span>
                <div class="agent-meta">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span class="agent-name" style="font-weight:700;color:#fff;">${this.escapeHtml(agent.name)}</span>
                    <span class="badge" style="background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-weight:700;font-size:10.5px;padding:1px 6px;border-radius:4px;">
                      🎂 उम्र / Age: ${agent.age !== undefined ? agent.age : 30}
                    </span>
                  </div>
                  <span class="agent-occupation">${this.escapeHtml(agent.occupation)}</span>
                </div>
              </div>
            </td>
            <td>
              <span class="badge ${isPaused ? 'badge-paused' : 'badge-deactivated'}">
                ${agent.runtime_status.toUpperCase()}
              </span>
            </td>
            <td>${this.escapeHtml(agent.location)}</td>
            <td style="max-width:280px;font-size:12.5px;color:var(--text-muted);">
              ${this.escapeHtml(agent.last_decision_reason || 'Administrative status intervention.')}
            </td>
            <td>
              <span class="badge ${this.getBeliefBadgeClass(agent.belief_status)}">
                ${agent.belief_status || 'Belief not specified'}
              </span>
            </td>
            <td style="font-family:var(--font-mono);">${agent.reward_points.toFixed(1)} pts</td>
            <td>
              <div style="display:flex;gap:6px;">
                ${isPaused ? `
                  <button class="btn btn-sm btn-primary" onclick="app.resumeAgent(${agent.id})">Resume</button>
                ` : `
                  <button class="btn btn-sm btn-primary" onclick="app.reactivateAgent(${agent.id})">Reactivate</button>
                `}
                <button class="btn btn-sm btn-secondary" onclick="app.openAgentDetailModal(${agent.id})">Inspect</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<tr><td colspan="7" style="color:var(--danger-text);padding:20px;">Failed to load inactive agents: ${err.message}</td></tr>`;
    }
  }

  populateAgentsTable(agents, container) {
    if (agents.length === 0) {
      container.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">
          No human agents matched the search criteria.
        </td></tr>
      `;
      return;
    }

    container.innerHTML = agents.map(agent => {
      const isDeceased = agent.deceased_at || agent.runtime_status === 'deceased';
      const statusBadge = isDeceased ? '<span class="badge badge-deceased">DECEASED</span>' : this.getStatusBadge(agent.runtime_status);
      const activityBadge = isDeceased ? '<span class="badge badge-deceased">🕯️ AT REST</span>' : this.getActivityBadge(agent.activity);
      const beliefBadge = this.getBeliefBadgeClass(agent.belief_status);
      const portraitUrl = agent.photo_url || '/assets/portraits/evelyn.jpg';

      return `
        <tr>
          <td>
            <div class="agent-cell" style="display:flex;align-items:center;gap:12px;">
              <img src="${portraitUrl}" alt="${this.escapeHtml(agent.name)}" class="agent-portrait-thumb" onerror="this.onerror=null;this.src='/assets/portraits/evelyn.jpg'">
              <div class="agent-meta">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span class="agent-name" style="font-weight:700;font-size:14px;color:#fff;">
                    ${this.escapeHtml(agent.name)}
                    ${agent.generation && agent.generation > 1 ? `<span class="badge" style="background:rgba(168,85,247,0.2);color:#c084fc;font-size:10px;padding:1px 5px;margin-left:4px;">Gen ${agent.generation}</span>` : ''}
                    ${agent.parent_a_id ? `<span title="Born in town" style="font-size:11px;margin-left:2px;">👶</span>` : ''}
                  </span>
                  <span class="badge" style="background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-weight:700;font-size:11px;padding:2px 7px;border-radius:4px;">
                    🎂 उम्र / Age: ${agent.age !== undefined ? agent.age : 30}
                  </span>
                </div>
                <span class="agent-occupation" style="margin-top:3px;font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:6px;">
                  <span>${this.escapeHtml(agent.occupation)}</span>
                  <span class="badge badge-emotion">${this.escapeHtml(agent.emotion || 'Content')}</span>
                </span>
              </div>
            </div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex;flex-direction:column;gap:3px;">
              ${activityBadge}
              <span style="font-size:11px;color:var(--text-dim);">${this.escapeHtml(agent.location)}</span>
            </div>
          </td>
          <td>
            <div class="need-bar-container">
              <div class="need-label-val"><span>Health</span><span>${agent.health !== undefined ? agent.health.toFixed(0) : 100}%</span></div>
              <div class="need-track"><div class="need-fill" style="background:#10b981;width:${agent.health !== undefined ? agent.health : 100}%;"></div></div>
              <div class="need-label-val" style="margin-top:2px;"><span>Stress</span><span>${agent.stress !== undefined ? agent.stress.toFixed(0) : 10}%</span></div>
              <div class="need-track"><div class="need-fill" style="background:#ef4444;width:${agent.stress !== undefined ? agent.stress : 10}%;"></div></div>
            </div>
          </td>
          <td>
            <div style="font-family:var(--font-mono);font-size:13px;">
              <div>${agent.virtual_balance.toFixed(1)} <span style="font-size:11px;color:var(--text-dim);">Solis</span></div>
              <div style="color:var(--primary-400);">${agent.reward_points.toFixed(1)} <span style="font-size:11px;color:var(--text-dim);">pts</span></div>
            </div>
          </td>
          <td>
            <span class="badge ${beliefBadge}">
              ${agent.belief_status || 'Belief not specified'}
            </span>
          </td>
          <td style="max-width:220px;font-size:12px;color:var(--text-muted);" title="${this.escapeHtml(agent.last_decision_reason || '')}">
            ${this.escapeHtml((agent.last_decision_reason || 'Autonomously evaluating choices.').substring(0, 48))}...
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <button class="btn btn-sm btn-secondary" onclick="app.openAgentDetailModal(${agent.id})" title="Inspect Profile">
                Inspect
              </button>
              ${!isDeceased ? `
                ${agent.runtime_status === 'active' ? `
                  <button class="btn btn-sm btn-secondary" onclick="app.pauseAgent(${agent.id})" title="Pause Agent">⏸</button>
                  <button class="btn btn-sm btn-danger" onclick="app.confirmDeactivateAgent(${agent.id}, '${this.escapeHtml(agent.name)}')" title="Deactivate Agent">⏹</button>
                ` : (agent.runtime_status === 'paused' ? `
                  <button class="btn btn-sm btn-primary" onclick="app.resumeAgent(${agent.id})" title="Resume Agent">▶</button>
                  <button class="btn btn-sm btn-danger" onclick="app.confirmDeactivateAgent(${agent.id}, '${this.escapeHtml(agent.name)}')" title="Deactivate Agent">⏹</button>
                ` : `
                  <button class="btn btn-sm btn-primary" onclick="app.reactivateAgent(${agent.id})" title="Reactivate Agent">Reactivate</button>
                `)}
                <button class="btn btn-sm btn-secondary" onclick="app.openDeclareDeceasedModal(${agent.id}, '${this.escapeHtml(agent.name)}')" title="Record Citizen Passing">🕯️</button>
              ` : `
                <span style="font-size:11px;color:var(--text-dim);">Archived</span>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  getStatusBadge(status) {
    if (status === 'active') return '<span class="badge badge-active">ACTIVE</span>';
    if (status === 'sleeping') return '<span class="badge" style="background:rgba(192,132,252,0.2);color:#c084fc;border:1px solid rgba(192,132,252,0.4);">🌙 SLEEPING</span>';
    if (status === 'paused') return '<span class="badge badge-paused">PAUSED</span>';
    if (status === 'deceased') return '<span class="badge badge-deceased">🕯️ DECEASED</span>';
    return '<span class="badge badge-deactivated">DEACTIVATED</span>';
  }

  getActivityBadge(activity) {
    const cls = {
      working: 'badge-working',
      eating: 'badge-eating',
      walking: 'badge-walking',
      resting: 'badge-resting',
      socializing: 'badge-socializing',
      sleeping: 'badge-sleeping'
    }[activity] || 'badge-resting';

    const icon = {
      working: '💻',
      eating: '🥪',
      walking: '🚶',
      resting: '🧘',
      socializing: '💬',
      sleeping: '💤'
    }[activity] || '⚡';

    return `<span class="badge ${cls}">${icon} ${activity.toUpperCase()}</span>`;
  }

  getBeliefBadgeClass(status) {
    if (status === 'Trusts in God') return 'badge-belief-god';
    if (status === 'Does not trust in God') return 'badge-belief-no-god';
    if (status === 'Unsure or undecided') return 'badge-belief-unsure';
    return 'badge-belief-unspecified';
  }

  // ==========================================
  // AGENT ACTIONS
  // ==========================================
  async pauseAgent(id) {
    try {
      await window.apiClient.pauseAgent(id);
      this.showToast('Agent paused.', 'info');
      this.renderCurrentTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async resumeAgent(id) {
    try {
      await window.apiClient.resumeAgent(id);
      this.showToast('Agent resumed to active simulation.', 'success');
      this.renderCurrentTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  confirmDeactivateAgent(id, name) {
    this.showConfirmModal(
      'Confirm Agent Deactivation',
      `Are you sure you want to deactivate "${name}"? Deactivated agents are completely halted and will no longer participate in autonomous town life until reactivated.`,
      async () => {
        try {
          await window.apiClient.deactivateAgent(id);
          this.showToast(`Agent "${name}" deactivated.`, 'warning');
          this.renderCurrentTab();
          this.fetchSnapshot();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }
    );
  }

  async reactivateAgent(id) {
    try {
      await window.apiClient.reactivateAgent(id);
      this.showToast('Agent reactivated successfully.', 'success');
      this.renderCurrentTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async openAgentDetailModal(id) {
    this.selectedAgentId = id;
    try {
      const data = await window.apiClient.getAgentDetails(id);
      const a = data.agent;

      document.getElementById('modal-agent-name').textContent = `${a.name}`;
      document.getElementById('modal-agent-id').textContent = `ID #${a.id} • ${a.occupation}`;

      // Photographic Identity Header
      const photoEl = document.getElementById('modal-agent-photo');
      if (photoEl) {
        photoEl.src = a.photo_url || '/assets/portraits/evelyn.jpg';
        photoEl.onerror = () => { photoEl.src = '/assets/portraits/evelyn.jpg'; };
      }
      const fullNameEl = document.getElementById('modal-agent-full-name');
      if (fullNameEl) fullNameEl.textContent = a.name;

      const ageBadgeEl = document.getElementById('modal-agent-age-badge');
      if (ageBadgeEl) ageBadgeEl.textContent = `🎂 उम्र / Age: ${a.age !== undefined ? a.age : 30}`;

      const emotionBadgeEl = document.getElementById('modal-agent-emotion-badge');
      if (emotionBadgeEl) emotionBadgeEl.textContent = a.emotion || 'Content';

      const deceasedPillEl = document.getElementById('modal-agent-deceased-pill');
      if (deceasedPillEl) {
        if (a.deceased_at || a.runtime_status === 'deceased') {
          deceasedPillEl.innerHTML = `<span class="badge badge-deceased">🕯️ Deceased (${this.escapeHtml(a.cause_of_death || 'Natural')})</span>`;
        } else {
          deceasedPillEl.innerHTML = '';
        }
      }

      const dobEl = document.getElementById('modal-agent-dob-text');
      if (dobEl) dobEl.textContent = `Date of Birth: ${a.date_of_birth || 'Year 1'}`;

      const famEl = document.getElementById('modal-agent-family-text');
      if (famEl) famEl.textContent = `Family Background: ${a.family_background || 'Long-time town resident'}`;

      const finEl = document.getElementById('modal-agent-finance-text');
      if (finEl) finEl.textContent = `Financial Status: ${a.financial_status || 'Modest savings'}`;

      // Status badges
      document.getElementById('modal-agent-status-badge').innerHTML = `
        ${a.deceased_at ? '<span class="badge badge-deceased">DECEASED</span>' : this.getStatusBadge(a.runtime_status)}
        ${a.deceased_at ? '<span class="badge badge-deceased">🕯️ AT REST</span>' : this.getActivityBadge(a.activity)}
        <span class="badge ${this.getBeliefBadgeClass(a.belief_status)}">${a.belief_status || 'Belief not specified'}</span>
        ${a.generation ? `<span class="badge" style="background:rgba(168,85,247,0.2);color:#c084fc;">Gen ${a.generation}</span>` : ''}
        ${a.parent_a_id ? `<span class="badge" style="background:rgba(244,114,182,0.2);color:#f472b6;">👶 Born in Town (Parents: #${a.parent_a_id} & #${a.parent_b_id})</span>` : ''}
      `;

      // Overview values
      document.getElementById('modal-agent-location').textContent = a.location;
      document.getElementById('modal-agent-personality').textContent = a.personality;
      document.getElementById('modal-agent-goal').textContent = a.current_goal;
      document.getElementById('modal-agent-reason').textContent = a.last_decision_reason || 'None';
      document.getElementById('modal-agent-balance').textContent = `${a.virtual_balance.toFixed(1)} Solis`;
      document.getElementById('modal-agent-rewards').textContent = `${a.reward_points.toFixed(1)} pts`;

      const prefCityEl = document.getElementById('modal-agent-preferred-city');
      if (prefCityEl) prefCityEl.textContent = a.preferred_city || a.location || 'Smart Homes & Residences';
      const choiceReasonEl = document.getElementById('modal-agent-choice-reason');
      if (choiceReasonEl) choiceReasonEl.textContent = a.choice_reason || 'Chose this location according to their lifestyle, career goals, and personal affinity.';

      // Needs and Vitals meters
      const healthVal = a.health !== undefined ? a.health : 100;
      const stressVal = a.stress !== undefined ? a.stress : 10;
      const hValEl = document.getElementById('modal-health-val');
      if (hValEl) hValEl.textContent = `${healthVal.toFixed(0)}%`;
      const hBarEl = document.getElementById('modal-health-bar');
      if (hBarEl) hBarEl.style.width = `${healthVal}%`;

      const sValEl = document.getElementById('modal-stress-val');
      if (sValEl) sValEl.textContent = `${stressVal.toFixed(0)}%`;
      const sBarEl = document.getElementById('modal-stress-bar');
      if (sBarEl) sBarEl.style.width = `${stressVal}%`;

      document.getElementById('modal-energy-val').textContent = `${a.energy.toFixed(0)}%`;
      document.getElementById('modal-energy-bar').style.width = `${a.energy}%`;
      document.getElementById('modal-hunger-val').textContent = `${a.hunger.toFixed(0)}%`;
      document.getElementById('modal-hunger-bar').style.width = `${a.hunger}%`;
      document.getElementById('modal-happiness-val').textContent = `${a.happiness.toFixed(0)}%`;
      document.getElementById('modal-happiness-bar').style.width = `${a.happiness}%`;
      document.getElementById('modal-social-val').textContent = `${a.social_needs.toFixed(0)}%`;
      document.getElementById('modal-social-bar').style.width = `${a.social_needs}%`;

      // Form inputs for adjustment
      document.getElementById('edit-agent-energy').value = a.energy;
      document.getElementById('edit-agent-hunger').value = a.hunger;
      document.getElementById('edit-agent-happiness').value = a.happiness;
      document.getElementById('edit-agent-social').value = a.social_needs;
      document.getElementById('edit-agent-balance').value = a.virtual_balance;
      document.getElementById('edit-agent-goal').value = a.current_goal;

      // Life Events Milestones
      const lifeEventsList = document.getElementById('modal-agent-life-events');
      if (lifeEventsList) {
        const events = data.lifeEvents || [];
        lifeEventsList.innerHTML = events.length === 0 ? '<div style="color:var(--text-muted);padding:8px;">No major life events recorded yet.</div>' :
          events.map(ev => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12px;margin-bottom:6px;border-left:3px solid var(--primary-500);">
              <div style="display:flex;justify-content:space-between;color:var(--text-dim);font-size:10.5px;margin-bottom:2px;">
                <span style="font-weight:600;color:var(--primary-400);">${this.escapeHtml(ev.event_type)}</span>
                <span>${new Date(ev.timestamp).toLocaleDateString()}</span>
              </div>
              <div style="color:#e2e8f0;">${this.escapeHtml(ev.description)}</div>
            </div>
          `).join('');
      }

      // Prayers and Mannats log
      const prayersLog = document.getElementById('modal-agent-prayers-log');
      if (prayersLog) {
        const pList = data.prayers || [];
        prayersLog.innerHTML = pList.length === 0 ? '<div style="color:var(--text-muted);padding:8px;">No spiritual reflections recorded.</div>' :
          pList.map(pr => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12px;margin-bottom:6px;border-left:3px solid #fbbf24;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span class="badge ${pr.category === 'Mannat' ? 'badge-mannat' : 'badge-prayer'}" style="font-size:10px;">${this.escapeHtml(pr.category)}</span>
                <span style="font-size:10.5px;color:var(--text-dim);">${pr.timestamp ? new Date(pr.timestamp).toLocaleTimeString() : (pr.created_at ? new Date(pr.created_at).toLocaleTimeString() : '')}</span>
              </div>
              <div style="font-style:italic;color:#f1f5f9;margin:4px 0;line-height:1.5;white-space:pre-line;">"${this.escapeHtml(pr.original_text || pr.original_words || pr.summary || pr.request_summary || '')}"</div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
                <div style="font-size:11px;color:var(--text-muted);">Status: <strong style="color:${pr.status === 'fulfilled' ? '#34d399' : '#fbbf24'};">${(pr.status || 'pending').toUpperCase()}</strong></div>
                <button class="btn btn-sm btn-secondary" style="font-size:10px;padding:3px 8px;cursor:pointer;" onclick="app.openPrayerReviewModal(${pr.id})">🔍 Inspect Context</button>
              </div>
            </div>
          `).join('');
      }

      // Memories list
      const memList = document.getElementById('modal-agent-memories');
      if (memList) {
        memList.innerHTML = data.memories.length === 0 ? '<div style="color:var(--text-muted);">No memories recorded.</div>' :
          data.memories.map(m => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12.5px;margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;color:var(--text-dim);font-size:11px;margin-bottom:2px;">
                <span>${new Date(m.timestamp).toLocaleTimeString()}</span>
                <span>[${m.privacy_level.toUpperCase()}]</span>
              </div>
              <div>${this.escapeHtml(m.memory_text)}</div>
            </div>
          `).join('');
      }

      // Relationships list
      const relList = document.getElementById('modal-agent-relationships');
      if (relList) {
        relList.innerHTML = data.relationships.length === 0 ? '<div style="color:var(--text-muted);">No recorded relationships yet.</div>' :
          data.relationships.map(r => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12.5px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong>${r.peer_avatar} ${this.escapeHtml(r.peer_name)}</strong>
                <span style="color:var(--text-muted);font-size:11.5px;"> (${this.escapeHtml(r.relationship_type)})</span>
              </div>
              <div style="font-family:var(--font-mono);font-size:12px;color:var(--primary-400);">
                Affinity: ${r.affinity_score.toFixed(0)} | Trust: ${r.trust_score.toFixed(0)}
              </div>
            </div>
          `).join('');
      }

      // Conversations list
      const convList = document.getElementById('modal-agent-conversations');
      if (convList) {
        convList.innerHTML = data.conversations.length === 0 ? '<div style="color:var(--text-muted);">No recent dialogues.</div>' :
          data.conversations.map(c => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12.5px;margin-bottom:6px;">
              <div style="color:var(--text-dim);font-size:11px;">Topic: ${this.escapeHtml(c.topic)} • ${c.location}</div>
              <div style="color:#e2e8f0;margin-top:2px;">${this.escapeHtml(c.snippet)}</div>
            </div>
          `).join('');
      }

      // Reset memory privacy filter
      const privacySel = document.getElementById('modal-memory-privacy-select');
      if (privacySel) privacySel.value = 'all';

      this.showModal('modal-agent-inspect');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async filterAgentMemories(privacyLevel) {
    if (!this.selectedAgentId) return;
    try {
      const data = await window.apiClient.getAgentDetails(this.selectedAgentId, privacyLevel);
      const memList = document.getElementById('modal-agent-memories');
      if (memList) {
        memList.innerHTML = data.memories.length === 0 ? '<div style="color:var(--text-muted);padding:8px;">No memories recorded for this privacy level.</div>' :
          data.memories.map(m => `
            <div style="padding:8px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12.5px;margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;color:var(--text-dim);font-size:11px;margin-bottom:2px;">
                <span>${new Date(m.timestamp).toLocaleTimeString()}</span>
                <span class="badge ${m.privacy_level === 'public' ? 'badge-active' : 'badge-resting'}" style="font-size:9.5px;">${m.privacy_level.toUpperCase()}</span>
              </div>
              <div>${this.escapeHtml(m.memory_text)}</div>
            </div>
          `).join('');
      }
    } catch (e) {
      console.warn('Memory privacy filter error:', e);
    }
  }

  async saveAgentAttributes() {
    if (!this.selectedAgentId) return;
    const updates = {
      energy: parseFloat(document.getElementById('edit-agent-energy').value),
      hunger: parseFloat(document.getElementById('edit-agent-hunger').value),
      happiness: parseFloat(document.getElementById('edit-agent-happiness').value),
      social_needs: parseFloat(document.getElementById('edit-agent-social').value),
      virtual_balance: parseFloat(document.getElementById('edit-agent-balance').value),
      current_goal: document.getElementById('edit-agent-goal').value
    };

    try {
      await window.apiClient.updateAgentAttributes(this.selectedAgentId, updates);
      this.showToast('Agent attributes successfully saved.', 'success');
      this.hideModals();
      this.renderCurrentTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  locateAgentOnEarth() {
    if (!this.selectedAgentId) return;
    const agentId = this.selectedAgentId;
    this.hideModals();
    this.switchTab('sim-view');
    setTimeout(() => {
      if (this.worldCanvas) {
        this.worldCanvas.focusAgent(agentId);
      }
    }, 220);
  }

  // ==========================================
  // TAB: PRAYERS & MANNATS INBOX
  // ==========================================
  async renderPrayersTab() {
    const container = document.getElementById('prayers-container');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Loading spiritual requests...</div>';

    try {
      const res = await window.apiClient.getPrayers(this.prayerFilters);
      const data = res.data || [];
      const counts = res.counts || {};

      // Update KPI counters
      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt('prayers-kpi-total', counts.total || 0);
      setTxt('prayers-kpi-pending', counts.pending || 0);
      setTxt('prayers-kpi-fulfilled', counts.fulfilled || 0);
      setTxt('prayers-kpi-declined', counts.declined || 0);

      if (data.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:50px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:10px;">
            <div style="font-size:32px;margin-bottom:8px;">🕊️</div>
            <h4>No spiritual petitions found</h4>
            <p style="font-size:13px;color:var(--text-dim);max-width:400px;margin:8px auto 0;">
              No prayers or vows matched the selected category and status filters.
            </p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.map(item => {
        let catBadgeCls = 'badge-prayer';
        if (item.category === 'Mannat') catBadgeCls = 'badge-mannat';
        else if (item.category === 'Gratitude') catBadgeCls = 'badge-gratitude';
        else if (item.category === 'Reflection') catBadgeCls = 'badge-reflection';
        else if (item.category === 'Needs Review') catBadgeCls = 'badge-review';

        let statusColor = '#fbbf24';
        if (item.status === 'fulfilled') statusColor = '#34d399';
        else if (item.status === 'declined') statusColor = '#f87171';
        else if (item.status === 'postponed') statusColor = '#94a3b8';
        else if (item.status === 'resolved') statusColor = '#38bdf8';

        const portraitUrl = item.photo_url || '/assets/portraits/evelyn.jpg';

        return `
          <div class="prayer-card">
            <div class="prayer-card-header">
              <div class="prayer-card-citizen">
                <img src="${portraitUrl}" alt="${this.escapeHtml(item.agent_name || 'Citizen')}" class="agent-portrait-thumb" onerror="this.onerror=null;this.src='/assets/portraits/evelyn.jpg'">
                <div>
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong style="color:#fff;font-size:14.5px;">${this.escapeHtml(item.agent_name || 'Unknown')}</strong>
                    <span class="badge" style="background:rgba(59,130,246,0.22);border:1px solid rgba(59,130,246,0.55);color:#93c5fd;font-weight:700;font-size:11.5px;padding:2px 7px;border-radius:4px;">
                      🎂 उम्र / Age: ${item.age || item.agent_age || 30}
                    </span>
                    <span class="badge ${catBadgeCls}">${this.escapeHtml(item.category)}</span>
                  </div>
                  <div style="font-size:11.5px;color:var(--text-dim);margin-top:2px;">
                    Request ID: <code>#${item.id}</code> • ${item.simulated_time || new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div style="text-align:right;">
                <span class="badge" style="border:1px solid ${statusColor};color:${statusColor};text-transform:uppercase;font-weight:700;">
                  ${item.status}
                </span>
                <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">
                  Emotional State: <span style="color:#d8b4fe;">${this.escapeHtml(item.emotion_state || 'Hopeful')}</span>
                </div>
              </div>
            </div>

            <!-- Original Words -->
            ${item.original_text ? `
              <div class="prayer-quote-box" style="white-space:pre-line;line-height:1.6;">
                "${this.escapeHtml(item.original_text)}"
              </div>
            ` : ''}

            <!-- Summary & Desired Outcome -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0;">
              <div style="font-size:13px;color:#e2e8f0;line-height:1.5;">
                <strong style="color:var(--text-muted);font-size:11px;display:block;">PLAIN SUMMARY</strong>
                ${this.escapeHtml(item.summary)}
              </div>
              <div style="font-size:13px;color:#38bdf8;line-height:1.5;">
                <strong style="color:var(--text-muted);font-size:11px;display:block;">DESIRED OUTCOME</strong>
                ${this.escapeHtml(item.desired_outcome || 'General well-being and relief')}
              </div>
            </div>

            <!-- Explicit Vow / Mannat -->
            ${item.explicit_vow ? `
              <div class="prayer-vow-box" style="white-space:pre-line;line-height:1.5;">
                <span>🙏</span>
                <div>
                  <strong>EXPLICIT CITIZEN VOW / MANNAT:</strong>
                  <span>"${this.escapeHtml(item.explicit_vow)}"</span>
                </div>
              </div>
            ` : ''}

            <!-- Context Trigger -->
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">
              <strong>Trigger Context:</strong> ${this.escapeHtml(item.context_trigger || 'Spiritual reflection')}
            </div>

            <!-- Decision History / Notes -->
            ${item.decision_notes ? `
              <div style="font-size:12px;color:var(--text-dim);margin-top:6px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:4px;">
                <strong>Admin Decision Note:</strong> ${this.escapeHtml(item.decision_notes)}
              </div>
            ` : ''}

            <!-- Actions Bar -->
            <div class="prayer-action-bar">
              <button class="btn btn-sm btn-secondary" onclick="app.openPrayerReviewModal(${item.id})">
                Inspect Context &amp; Full Details
              </button>
              ${item.status === 'pending' || item.status === 'postponed' ? `
                <button class="btn btn-sm btn-primary" onclick="app.fulfillDirectPrayer(${item.id})">
                  ✨ Fulfill Request
                </button>
                <button class="btn btn-sm btn-danger" onclick="app.declineDirectPrayer(${item.id})">
                  Do Not Fulfill
                </button>
                <button class="btn btn-sm btn-secondary" onclick="app.postponeDirectPrayer(${item.id})">
                  Postpone
                </button>
              ` : `
                <button class="btn btn-sm btn-secondary" onclick="app.resolveDirectPrayer(${item.id})">
                  Mark Resolved
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');

      this.renderPagination('prayers-pagination', res.pagination, (newPage) => {
        this.prayerFilters.page = newPage;
        this.renderPrayersTab();
      });
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger-text);padding:20px;">Failed to load spiritual petitions: ${err.message}</div>`;
    }
  }

  async openPrayerReviewModal(id) {
    try {
      const res = await window.apiClient.getPrayerDetails(id);
      const pr = res.prayer || res.data || res;
      if (!pr || !pr.id) {
        throw new Error('Could not find prayer or mannat details.');
      }
      this.currentReviewPrayer = pr;

      const setTxt = (elId, val) => {
        const el = document.getElementById(elId);
        if (el) el.textContent = val;
      };

      setTxt('modal-prayer-id-badge', `Petition #${pr.id}`);
      setTxt('modal-prayer-citizen-name', pr.agent_name || 'Citizen');
      setTxt('modal-prayer-citizen-age', `🎂 उम्र / Age: ${pr.age || pr.agent_age || 30}`);
      setTxt('modal-prayer-emotion', pr.agent_emotion || pr.emotion_state || 'Reflective');
      setTxt('modal-prayer-needs-summary', `Needs status stable`);
      
      const originalText = pr.original_text || pr.original_words || 'No verbatim transcript recorded.';
      const origEl = document.getElementById('modal-prayer-original-text');
      if (origEl) {
        origEl.textContent = `"${originalText}"`;
        origEl.style.whiteSpace = 'pre-line';
        origEl.style.lineHeight = '1.6';
      }

      setTxt('modal-prayer-summary-text', pr.summary || pr.request_summary || '-');
      setTxt('modal-prayer-desired-outcome', pr.desired_outcome || 'General peace and well-being');
      setTxt('modal-prayer-context', pr.context_trigger || pr.trigger_context || 'Personal reflection');
      setTxt('modal-prayer-status-display', pr.status || 'pending');
      setTxt('modal-prayer-timestamp', pr.simulated_time || (pr.timestamp ? new Date(pr.timestamp).toLocaleString() : (pr.created_at ? new Date(pr.created_at).toLocaleString() : 'Recent')));

      const photoEl = document.getElementById('modal-prayer-citizen-photo');
      if (photoEl) {
        photoEl.src = pr.agent_photo_url || pr.photo_url || '/assets/portraits/evelyn.jpg';
        photoEl.onerror = () => { photoEl.src = '/assets/portraits/evelyn.jpg'; };
      }

      const catBadge = document.getElementById('modal-prayer-category-badge');
      if (catBadge) {
        catBadge.textContent = pr.category;
        catBadge.className = `badge ${pr.category === 'Mannat' ? 'badge-mannat' : (pr.category === 'Gratitude' ? 'badge-gratitude' : 'badge-prayer')}`;
      }

      const vowBox = document.getElementById('modal-prayer-vow-container');
      const vowTxt = document.getElementById('modal-prayer-vow-text');
      const vow = pr.explicit_vow || pr.explicit_promise;
      if (vowBox && vowTxt) {
        if (vow && vow !== 'None' && vow !== 'null') {
          vowBox.style.display = 'block';
          vowTxt.textContent = `"${vow}"`;
          vowTxt.style.whiteSpace = 'pre-line';
          vowTxt.style.lineHeight = '1.5';
        } else {
          vowBox.style.display = 'none';
        }
      }

      const decisionNotes = document.getElementById('modal-prayer-decision-notes');
      if (decisionNotes) {
        decisionNotes.textContent = pr.decision_notes ? `Notes: ${pr.decision_notes}` : '';
      }

      this.showModal('modal-prayer-review');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async fulfillCurrentPrayer() {
    if (!this.currentReviewPrayer) return;
    const notesEl = document.getElementById('modal-prayer-admin-notes');
    const notes = notesEl ? notesEl.value : '';
    try {
      await window.apiClient.fulfillPrayer(this.currentReviewPrayer.id, { notes });
      this.showToast(`Request #${this.currentReviewPrayer.id} fulfilled. World event executed!`, 'success');
      this.hideModals();
      this.renderPrayersTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async fulfillDirectPrayer(id) {
    this.showConfirmModal(
      'Fulfill Spiritual Petition',
      `Fulfilling this petition will execute a tangible positive world event for this citizen, update their life history and vitals, and allow them to respond according to their beliefs. Confirm?`,
      async () => {
        try {
          await window.apiClient.fulfillPrayer(id, { notes: 'Approved via Admin Panel Desk' });
          this.showToast(`Petition #${id} fulfilled!`, 'success');
          this.renderPrayersTab();
          this.fetchSnapshot();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }
    );
  }

  async declineCurrentPrayer() {
    if (!this.currentReviewPrayer) return;
    const notesEl = document.getElementById('modal-prayer-admin-notes');
    const notes = notesEl ? notesEl.value : '';
    try {
      await window.apiClient.declinePrayer(this.currentReviewPrayer.id, { notes });
      this.showToast(`Request #${this.currentReviewPrayer.id} declined. Normal simulation rules proceed.`, 'info');
      this.hideModals();
      this.renderPrayersTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async declineDirectPrayer(id) {
    this.showConfirmModal(
      'Decline Petition Intervention',
      `Are you sure you do not want to intervene? The simulation will let ordinary natural rules continue without divine event assistance.`,
      async () => {
        try {
          await window.apiClient.declinePrayer(id, { notes: 'Declined intervention; natural world progression.' });
          this.showToast(`Petition #${id} marked as declined.`, 'info');
          this.renderPrayersTab();
          this.fetchSnapshot();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }
    );
  }

  async postponeCurrentPrayer() {
    if (!this.currentReviewPrayer) return;
    try {
      await window.apiClient.postponePrayer(this.currentReviewPrayer.id, { notes: 'Postponed for later review' });
      this.showToast(`Petition #${this.currentReviewPrayer.id} postponed.`, 'info');
      this.hideModals();
      this.renderPrayersTab();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async postponeDirectPrayer(id) {
    try {
      await window.apiClient.postponePrayer(id, { notes: 'Postponed for later evaluation' });
      this.showToast(`Petition #${id} postponed.`, 'info');
      this.renderPrayersTab();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async resolveDirectPrayer(id) {
    try {
      await window.apiClient.resolvePrayer(id, { notes: 'Marked resolved' });
      this.showToast(`Petition #${id} resolved.`, 'success');
      this.renderPrayersTab();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // TAB: LIFE CYCLE, AGING & DEATH SYSTEM
  // ==========================================
  async renderLifecyclesTab() {
    const container = document.getElementById('memorial-grid-container');
    if (!container) return;

    try {
      // Query all agents including deceased
      const res = await window.apiClient.getAgents({ limit: 100 });
      const agents = res.data || [];
      const living = agents.filter(a => !a.deceased_at && a.runtime_status !== 'deceased');
      const deceased = agents.filter(a => a.deceased_at || a.runtime_status === 'deceased');

      const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setTxt('life-stats-living', living.length);
      setTxt('life-stats-deceased', deceased.length);

      // Load settings if available
      if (this.snapshot && this.snapshot.settings) {
        const s = this.snapshot.settings;
        const agingEl = document.getElementById('lifecycle-aging-speed');
        if (agingEl && s.aging_speed !== undefined) {
          agingEl.value = s.aging_speed;
          document.getElementById('lifecycle-aging-val').textContent = `${s.aging_speed}x`;
        }
        const mortEl = document.getElementById('lifecycle-mortality-rate');
        if (mortEl && s.mortality_rate !== undefined) {
          mortEl.value = s.mortality_rate;
          document.getElementById('lifecycle-mortality-val').textContent = `${s.mortality_rate}x`;
        }
        const maxAgeEl = document.getElementById('lifecycle-max-age');
        if (maxAgeEl && s.max_natural_age !== undefined) maxAgeEl.value = s.max_natural_age;

        const natEl = document.getElementById('lifecycle-death-natural');
        if (natEl && s.enable_natural_death !== undefined) natEl.checked = !!s.enable_natural_death;
        const illEl = document.getElementById('lifecycle-death-illness');
        if (illEl && s.enable_illness_death !== undefined) illEl.checked = !!s.enable_illness_death;
        const accEl = document.getElementById('lifecycle-death-accidental');
        if (accEl && s.enable_accidental_death !== undefined) accEl.checked = !!s.enable_accidental_death;
      }

      if (deceased.length === 0) {
        container.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:10px;">
            <div style="font-size:32px;margin-bottom:8px;">🌿</div>
            <h4>No deceased citizens in memorial archives</h4>
            <p style="font-size:13px;color:var(--text-dim);max-width:420px;margin:8px auto 0;">
              All citizens are currently alive and active in the simulation. As time and simulated aging progress, deceased records and estates will be commemorated here.
            </p>
          </div>
        `;
        return;
      }

      container.innerHTML = deceased.map(dec => {
        const portraitUrl = dec.photo_url || '/assets/portraits/evelyn.jpg';
        return `
          <div class="memorial-card">
            <div class="memorial-header">
              <img src="${portraitUrl}" alt="${this.escapeHtml(dec.name)}" class="agent-portrait-thumb" style="width:52px;height:52px;" onerror="this.onerror=null;this.src='/assets/portraits/evelyn.jpg'">
              <div>
                <h4 style="margin:0;font-size:16px;color:#fff;">${this.escapeHtml(dec.name)}</h4>
                <div style="font-size:12px;color:var(--text-muted);">
                  Age at Passing: <strong>${dec.age || 75}</strong> • ${this.escapeHtml(dec.occupation)}
                </div>
              </div>
            </div>
            <div style="font-size:12px;color:#cbd5e1;">
              <strong>Cause of Death:</strong> ${this.escapeHtml(dec.cause_of_death || 'Natural Old Age')}
            </div>
            <div style="font-size:11.5px;color:var(--text-dim);">
              Passing Date: ${dec.deceased_at ? new Date(dec.deceased_at).toLocaleDateString() : 'Recorded in Town Records'}
            </div>
            <div class="memorial-epitaph">
              "${this.escapeHtml(dec.life_history || 'A respected citizen of the autonomous simulation whose legacy continues in the community.')}"
            </div>
            <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border-subtle);font-size:11.5px;color:var(--text-dim);">
              <span>Estate Solis: <strong>${dec.virtual_balance.toFixed(0)} Solis</strong></span>
              <button class="btn btn-sm btn-secondary" onclick="app.openAgentDetailModal(${dec.id})">
                Life Archive
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div style="color:var(--danger-text);padding:20px;">Failed to load memorial records: ${err.message}</div>`;
    }
  }

  async renderOverviewDeceased(container) {
    try {
      const res = await window.apiClient.getAgents({ status: 'deceased', limit: 20 });
      const deceased = res.data || [];
      if (deceased.length === 0) {
        container.innerHTML = `
          <div style="text-align:center;padding:24px;color:var(--text-muted);background:var(--bg-surface-elevated);border-radius:8px;">
            <span style="font-size:24px;display:block;margin-bottom:6px;">🌿</span>
            <div style="font-size:13.5px;color:#e2e8f0;font-weight:600;">कोई मृत्यु दर्ज नहीं (All Citizens Alive &amp; Healthy)</div>
            <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">सभी नागरिक जीवित हैं। उम्र बढ़ने या बीमारी पर प्राकृतिक मृत्यु यहाँ दर्ज होगी।</div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;">
          ${deceased.map(d => `
            <div style="background:var(--bg-surface-elevated);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:12px;display:flex;gap:12px;align-items:center;">
              <img src="${d.photo_url || '/assets/portraits/evelyn.jpg'}" alt="${this.escapeHtml(d.name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid #ef4444;" onerror="this.onerror=null;this.src='/assets/portraits/evelyn.jpg'">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="color:#fff;font-size:14px;">${this.escapeHtml(d.name)}</strong>
                  <span class="badge badge-deceased" style="font-size:9.5px;">मृत्यु (Deceased)</span>
                </div>
                <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;">
                  उम्र: <strong>${d.age || 75}</strong> • ${this.escapeHtml(d.occupation)}
                </div>
                <div style="font-size:11px;color:#fca5a5;margin-top:2px;">
                  कारण: ${this.escapeHtml(d.cause_of_death || 'Natural Causes')}
                </div>
                <div style="font-size:10.5px;color:var(--text-dim);margin-top:2px;">
                  तिथि: ${d.deceased_at ? new Date(d.deceased_at).toLocaleDateString() : 'Recorded in archives'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div style="color:var(--text-dim);font-size:12px;">Failed to load deceased list.</div>`;
    }
  }

  async setTimeOfDay(timeOfDay, hour = null) {
    try {
      const res = await window.apiClient.setTimeOfDay(timeOfDay, hour);
      const isNight = res.isNight;
      const msg = isNight 
        ? `🌙 Night Mode Active (${res.timeStr})! All living citizens have retired to Residential Complex for sleep and rest.`
        : `☀️ Morning Mode Active (${res.timeStr})! All living citizens have awakened and resumed daytime activities.`;
      this.showToast(msg, 'success');

      const clockEl = document.getElementById('world-clock-text');
      if (clockEl) clockEl.textContent = res.timeStr;

      // Update state immediately
      await this.fetchSnapshot();
      if (this.currentTab === 'agents') {
        this.renderAgentsTab();
      } else if (this.currentTab === 'overview') {
        this.renderOverviewTab();
      }
    } catch (err) {
      this.showToast(`Failed to set time: ${err.message}`, 'error');
    }
  }

  async saveLifecycleSettings() {
    const payload = {
      aging_speed: parseFloat(document.getElementById('lifecycle-aging-speed').value),
      mortality_rate: parseFloat(document.getElementById('lifecycle-mortality-rate').value),
      max_natural_age: parseInt(document.getElementById('lifecycle-max-age').value, 10),
      enable_natural_death: document.getElementById('lifecycle-death-natural').checked ? 1 : 0,
      enable_illness_death: document.getElementById('lifecycle-death-illness').checked ? 1 : 0,
      enable_accidental_death: document.getElementById('lifecycle-death-accidental').checked ? 1 : 0
    };

    try {
      await window.apiClient.updateSettings(payload);
      this.showToast('Lifespan & Mortality parameters updated successfully.', 'success');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openDeclareDeceasedModal(id, name) {
    document.getElementById('deceased-agent-id').value = id;
    document.getElementById('deceased-agent-name').textContent = name;
    this.showModal('modal-declare-deceased');
  }

  async submitDeclareDeceased() {
    const id = document.getElementById('deceased-agent-id').value;
    const cause = document.getElementById('deceased-cause-select').value;
    if (!id) return;

    try {
      await window.apiClient.declareAgentDeceased(id, cause);
      this.showToast('Citizen passing recorded and archived. Town notifications generated.', 'warning');
      this.hideModals();
      this.renderCurrentTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // SPEED & MORTALITY SYSTEM QUICK ACTIONS
  // ==========================================
  async setTimeSpeed(multiplier) {
    const mul = parseFloat(multiplier);
    if (isNaN(mul) || mul < 0.1 || mul > 10.0) return;
    try {
      this.userAdjustedSpeedManually = true;
      const res = await window.apiClient.setTimeSpeed(mul);
      if (this.worldCanvas) {
        this.worldCanvas.setSolarSpeed(mul);
      }
      const speedEls = document.querySelectorAll('.sim-speed-val, .solar-speed-display');
      speedEls.forEach(el => {
        el.textContent = `${mul.toFixed(1)}x`;
      });
      const speedSlider = document.getElementById('solar-speed-slider');
      if (speedSlider) speedSlider.value = mul;

      const fastNotice = mul >= 2.0 
        ? ` (⚡ तीव्र गति: उम्र बढ़ना और देहावसान चक्र ${mul} गुना तेजी से होगा)`
        : '';
      this.showToast(`सिमुलेशन व सौरमंडल गति ${mul.toFixed(1)}x पर सेट हुई!${fastNotice}`, 'success');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(`गति बदलने में त्रुटि: ${err.message}`, 'error');
    }
  }

  changeTimeSpeed(delta) {
    const current = (this.snapshot && this.snapshot.timeSpeedMultiplier) 
      ? parseFloat(this.snapshot.timeSpeedMultiplier)
      : (this.worldCanvas ? this.worldCanvas.solarSpeedMultiplier : 1.0);
    const next = Math.round((current + delta) * 10) / 10;
    const clamped = Math.max(0.2, Math.min(10.0, next));
    this.setTimeSpeed(clamped);
  }

  async triggerInstantMortality(cause = null) {
    try {
      const res = await window.apiClient.triggerMortality(cause);
      const name = res.agent ? res.agent.name : 'नागरिक';
      const c = res.cause || 'स्वाभाविक देहावसान';
      this.showToast(`🕯️ देहावसान घटना दर्ज: ${name} का निधन हुआ (${c})। कुल मौतें: ${res.deceasedCount}`, 'warning');
      this.fetchSnapshot();
      if (this.currentTab === 'lifecycles') {
        this.renderLifecyclesTab();
      }
    } catch (err) {
      this.showToast(`देहावसान दर्ज करने में त्रुटि: ${err.message}`, 'error');
    }
  }

  async toggleMortalitySystem() {
    try {
      const res = await window.apiClient.toggleMortality();
      const statusText = res.enableNaturalDeath ? 'सक्रिय (Active)' : 'रोक दिया गया (Paused)';
      this.showToast(`💀 मृत्यु प्रणाली (Death System) ${statusText}`, 'info');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(`त्रुटि: ${err.message}`, 'error');
    }
  }

  openMortalityModal() {
    this.showModal('modal-mortality-system');
  }

  // ==========================================
  // TAB: BELIEF PROFILE MANAGEMENT
  // ==========================================
  async renderBeliefsTab() {
    try {
      const stats = await window.apiClient.getBeliefStats();
      const dist = stats.distribution;
      const total = stats.totalAgents || 1;

      // Update distribution numbers and progress bars
      const updateBeliefBar = (id, count, color) => {
        const pct = ((count / total) * 100).toFixed(1);
        const countEl = document.getElementById(`belief-count-${id}`);
        const pctEl = document.getElementById(`belief-pct-${id}`);
        const barEl = document.getElementById(`belief-bar-${id}`);
        if (countEl) countEl.textContent = `${count} agents`;
        if (pctEl) pctEl.textContent = `${pct}%`;
        if (barEl) barEl.style.width = `${pct}%`;
      };

      updateBeliefBar('god', dist['Trusts in God'] || 0);
      updateBeliefBar('nogod', dist['Does not trust in God'] || 0);
      updateBeliefBar('unsure', dist['Unsure or undecided'] || 0);
      updateBeliefBar('unspec', dist['Belief not specified'] || 0);

      // Declared sources breakdown
      const sourcesContainer = document.getElementById('belief-sources-list');
      if (sourcesContainer) {
        sourcesContainer.innerHTML = stats.sources.map(s => `
          <div style="display:flex;justify-content:space-between;padding:10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:13px;margin-bottom:6px;">
            <span>${this.escapeHtml(s.declared_source)}</span>
            <strong style="font-family:var(--font-mono);color:var(--primary-400);">${s.count}</strong>
          </div>
        `).join('');
      }

      // Recent updates log
      const updatesContainer = document.getElementById('belief-recent-log');
      if (updatesContainer) {
        updatesContainer.innerHTML = stats.recentUpdates.map(u => `
          <div style="padding:10px;background:var(--bg-surface-elevated);border-radius:6px;font-size:12.5px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <strong>${u.avatar} ${this.escapeHtml(u.name)}</strong>
              <span class="badge ${this.getBeliefBadgeClass(u.belief_status)}">${u.belief_status}</span>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);">Source: ${this.escapeHtml(u.declared_source)}</div>
            <div style="font-size:10.5px;color:var(--text-dim);margin-top:2px;">${new Date(u.updated_at).toLocaleString()}</div>
          </div>
        `).join('');
      }

      // Populate agent dropdown for manual belief update modal
      this.populateAgentSelect('belief-update-agent-select');

      // Populate filterable agent belief registry table
      await this.renderBeliefAgentsTable();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async renderBeliefAgentsTable() {
    const container = document.getElementById('belief-agents-table-body');
    if (!container) return;
    const filter = document.getElementById('belief-table-filter') ? document.getElementById('belief-table-filter').value : '';

    container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Loading belief profiles...</td></tr>';
    try {
      const res = await window.apiClient.getAgents({ belief: filter, limit: 100 });
      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:25px;color:var(--text-muted);">No agents match the selected belief category.</td></tr>';
        return;
      }

      container.innerHTML = res.data.map(a => `
        <tr>
          <td>
            <div class="agent-cell">
              <span>${a.avatar || '👤'}</span>
              <div class="agent-meta">
                <span class="agent-name">${this.escapeHtml(a.name)}</span>
                <span class="agent-occupation">${this.escapeHtml(a.occupation)}</span>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${this.getBeliefBadgeClass(a.belief_status)}">
              ${a.belief_status || 'Belief not specified'}
            </span>
          </td>
          <td style="font-size:12px;color:#e2e8f0;max-width:260px;">
            ${this.escapeHtml(a.declared_source || 'Initial Simulation Registration')}
          </td>
          <td style="font-size:11.5px;color:var(--text-muted);">
            Recorded in simulation timeline
          </td>
          <td style="font-size:11.5px;color:var(--text-dim);font-family:var(--font-mono);">
            ${a.belief_updated_at ? new Date(a.belief_updated_at).toLocaleString() : 'System Seed'}
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="app.openBeliefOverrideForAgent(${a.id}, '${this.escapeHtml(a.belief_status || 'Belief not specified')}', '${this.escapeHtml(a.declared_source || '')}')">
              Override
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      container.innerHTML = `<tr><td colspan="6" style="color:var(--danger-text);padding:15px;">${err.message}</td></tr>`;
    }
  }

  openBeliefOverrideForAgent(agentId, currentBelief, currentSource) {
    const sel = document.getElementById('belief-update-agent-select');
    if (sel) sel.value = String(agentId);
    const stat = document.getElementById('belief-update-status');
    if (stat) stat.value = currentBelief;
    const src = document.getElementById('belief-update-source');
    if (src) src.value = currentSource || 'Administrator Explicit Research Override';
    this.showModal('modal-belief-update');
  }

  async submitBeliefUpdate() {
    const agentId = document.getElementById('belief-update-agent-select').value;
    const belief = document.getElementById('belief-update-status').value;
    const source = document.getElementById('belief-update-source').value;
    const notes = document.getElementById('belief-update-notes').value;

    if (!agentId || !belief) {
      this.showToast('Please select an agent and a belief profile.', 'error');
      return;
    }

    try {
      await window.apiClient.updateBeliefProfile(agentId, {
        belief_status: belief,
        declared_source: source,
        notes
      });
      this.showToast('Belief profile updated successfully.', 'success');
      this.hideModals();
      this.renderBeliefsTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // TAB: REWARD CENTER
  // ==========================================
  async renderRewardsTab() {
    await this.renderRewardRules();
    await this.renderRewardTransactions();
    this.populateAgentSelect('manual-reward-agent-select');
  }

  async renderRewardRules() {
    const container = document.getElementById('reward-rules-table-body');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Loading reward rules...</td></tr>';

    try {
      const res = await window.apiClient.getRewardRules();
      if (res.rules.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">No rules defined yet.</td></tr>';
        return;
      }

      container.innerHTML = res.rules.map(r => {
        let condText = 'Default triggers';
        let isBeliefRule = false;
        try {
          const parsed = JSON.parse(r.conditions_json);
          const parts = [];
          if (parsed.activity) parts.push(`Activity: ${parsed.activity}`);
          if (parsed.location) parts.push(`Loc: ${parsed.location}`);
          if (parsed.min_energy) parts.push(`Min Energy: ${parsed.min_energy}%`);
          if (parsed.belief_status) {
            parts.push(`Belief: "${parsed.belief_status}"`);
            isBeliefRule = true;
          }
          if (parts.length > 0) condText = parts.join(', ');
        } catch (e) {}

        return `
          <tr>
            <td>
              <div>
                <strong style="color:#fff;">${this.escapeHtml(r.name)}</strong>
                ${isBeliefRule ? '<span class="badge badge-paused" style="font-size:10px;margin-left:6px;">⚠️ BELIEF EXPERIMENT</span>' : ''}
                <div style="font-size:11.5px;color:var(--text-muted);">${this.escapeHtml(r.description || '')}</div>
              </div>
            </td>
            <td><strong style="color:var(--primary-400);font-family:var(--font-mono);">${r.amount}</strong> ${r.point_type}</td>
            <td><span class="badge badge-resting">${this.escapeHtml(r.trigger_event)}</span></td>
            <td style="font-size:12px;color:var(--text-muted);max-width:240px;">${this.escapeHtml(condText)}</td>
            <td>
              <span class="badge ${r.is_active ? 'badge-active' : 'badge-deactivated'}">
                ${r.is_active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${r.is_active ? `
                  <button class="btn btn-sm btn-primary" onclick="app.applyRuleBulk(${r.id}, '${this.escapeHtml(r.name)}')">⚡ Apply Bulk</button>
                ` : ''}
                <button class="btn btn-sm btn-secondary" onclick="app.toggleRule(${r.id})">${r.is_active ? 'Disable' : 'Enable'}</button>
                <button class="btn btn-sm btn-secondary" onclick="app.editRuleModal(${r.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="app.deleteRule(${r.id}, '${this.escapeHtml(r.name)}')">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<tr><td colspan="7" style="color:var(--danger-text);padding:20px;">${err.message}</td></tr>`;
    }
  }

  async toggleRule(id) {
    try {
      await window.apiClient.toggleRewardRule(id);
      this.showToast('Reward rule status updated.', 'info');
      this.renderRewardRules();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  deleteRule(id, name) {
    this.showConfirmModal(
      'Delete Reward Rule',
      `Are you sure you want to delete rule "${name}"? Existing issued rewards will remain in the transaction history.`,
      async () => {
        try {
          await window.apiClient.deleteRewardRule(id);
          this.showToast('Rule deleted.', 'success');
          this.renderRewardRules();
        } catch (err) {
          this.showToast(err.message, 'error');
        }
      }
    );
  }

  openNewRuleModal() {
    const titleEl = document.getElementById('rule-modal-title');
    if (titleEl) titleEl.textContent = 'Create Reward Rule';
    document.getElementById('rule-edit-id').value = '';
    document.getElementById('rule-form-name').value = '';
    document.getElementById('rule-form-desc').value = '';
    document.getElementById('rule-form-point-type').value = 'Merit Tokens';
    document.getElementById('rule-form-amount').value = '20';
    document.getElementById('rule-form-trigger').value = 'work_achievement';
    document.getElementById('rule-form-min-limit').value = '1';
    document.getElementById('rule-form-max-limit').value = '500';
    document.getElementById('rule-form-cooldown').value = '60';
    document.getElementById('rule-cond-activity').value = '';
    document.getElementById('rule-cond-location').value = '';
    document.getElementById('rule-cond-min-energy').value = '';
    document.getElementById('rule-cond-belief').value = '';
    document.getElementById('rule-preview-results').innerHTML = '';
    this.showModal('modal-rule-form');
  }

  async editRuleModal(ruleId) {
    try {
      const res = await window.apiClient.getRewardRules();
      const r = res.rules.find(x => x.id === ruleId);
      if (!r) {
        this.showToast('Rule not found.', 'error');
        return;
      }

      const titleEl = document.getElementById('rule-modal-title');
      if (titleEl) titleEl.textContent = 'Edit Reward Rule';
      document.getElementById('rule-edit-id').value = r.id;
      document.getElementById('rule-form-name').value = r.name;
      document.getElementById('rule-form-desc').value = r.description || '';
      document.getElementById('rule-form-point-type').value = r.point_type;
      document.getElementById('rule-form-amount').value = r.amount;
      document.getElementById('rule-form-trigger').value = r.trigger_event;
      document.getElementById('rule-form-min-limit').value = r.min_limit;
      document.getElementById('rule-form-max-limit').value = r.max_limit;
      document.getElementById('rule-form-cooldown').value = r.cooldown_seconds;

      let conds = {};
      try { conds = JSON.parse(r.conditions_json); } catch (e) {}
      document.getElementById('rule-cond-activity').value = conds.activity || '';
      document.getElementById('rule-cond-location').value = conds.location || '';
      document.getElementById('rule-cond-min-energy').value = conds.min_energy !== undefined ? conds.min_energy : '';
      document.getElementById('rule-cond-belief').value = conds.belief_status || '';

      document.getElementById('rule-preview-results').innerHTML = '';
      this.showModal('modal-rule-form');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async applyRuleBulk(ruleId, ruleName) {
    try {
      const resRules = await window.apiClient.getRewardRules();
      const r = resRules.rules.find(x => x.id === ruleId);
      if (!r) return;

      const previewRes = await window.apiClient.previewRewardRule(r.conditions_json);
      const count = previewRes.matchingCount;
      const amount = r.amount;
      const pointType = r.point_type;

      let msg = `Apply rule "${ruleName}" in bulk? This will grant ${amount} ${pointType} to ${count} currently matching active agent(s).`;
      if (previewRes.hasBeliefCondition) {
        msg += ` Note: This rule evaluates characters based on their declared belief profile.`;
      }

      this.showConfirmModal(
        'Confirm Bulk Reward Application',
        msg,
        async () => {
          try {
            const result = await window.apiClient.applyRewardRuleBulk(ruleId);
            this.showToast(result.message, 'success');
            this.renderRewardRules();
            this.renderRewardTransactions();
            this.fetchSnapshot();
          } catch (err) {
            this.showToast(err.message, 'error');
          }
        }
      );
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async previewRuleConditions() {
    const conditions = this.gatherRuleModalConditions();
    const previewContainer = document.getElementById('rule-preview-results');
    previewContainer.innerHTML = '<div style="color:var(--text-muted);">Evaluating active agents...</div>';

    try {
      const res = await window.apiClient.previewRewardRule(conditions);
      let warningHtml = '';
      if (res.warning) {
        warningHtml = `
          <div class="warning-banner" style="margin-top:8px;">
            <span class="warning-icon">⚠️</span>
            <div>${this.escapeHtml(res.warning)}</div>
          </div>
        `;
      }

      if (res.matchingCount === 0) {
        previewContainer.innerHTML = `
          ${warningHtml}
          <div style="color:var(--text-muted);padding:8px 0;">0 active agents currently match these criteria.</div>
        `;
      } else {
        previewContainer.innerHTML = `
          ${warningHtml}
          <div style="font-weight:600;color:var(--success-text);margin-bottom:6px;">
            ${res.matchingCount} agent(s) currently match this rule:
          </div>
          <div style="max-height:140px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;">
            ${res.matchingAgents.map(a => `
              <div style="font-size:12px;padding:5px 8px;background:var(--bg-surface-elevated);border-radius:4px;display:flex;justify-content:space-between;">
                <span><strong>${this.escapeHtml(a.name)}</strong> (${a.occupation})</span>
                <span style="color:var(--text-muted);">${a.activity} @ ${a.location}</span>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      previewContainer.innerHTML = `<div style="color:var(--danger-text);">${err.message}</div>`;
    }
  }

  gatherRuleModalConditions() {
    const act = document.getElementById('rule-cond-activity').value;
    const loc = document.getElementById('rule-cond-location').value;
    const minEnergy = document.getElementById('rule-cond-min-energy').value;
    const belief = document.getElementById('rule-cond-belief').value;

    const conditions = {};
    if (act) conditions.activity = act;
    if (loc) conditions.location = loc;
    if (minEnergy) conditions.min_energy = parseFloat(minEnergy);
    if (belief) conditions.belief_status = belief;

    return conditions;
  }

  async saveRewardRule() {
    const id = document.getElementById('rule-edit-id').value;
    const name = document.getElementById('rule-form-name').value;
    const desc = document.getElementById('rule-form-desc').value;
    const pointType = document.getElementById('rule-form-point-type').value;
    const amount = parseFloat(document.getElementById('rule-form-amount').value);
    const trigger = document.getElementById('rule-form-trigger').value;
    const minLimit = parseFloat(document.getElementById('rule-form-min-limit').value);
    const maxLimit = parseFloat(document.getElementById('rule-form-max-limit').value);
    const cooldown = parseInt(document.getElementById('rule-form-cooldown').value, 10);
    const conditions = this.gatherRuleModalConditions();

    if (!name || isNaN(amount) || amount <= 0) {
      this.showToast('Please fill all required rule fields.', 'error');
      return;
    }

    try {
      if (id) {
        await window.apiClient.updateRewardRule(id, {
          name, description: desc, point_type: pointType, amount, trigger_event: trigger,
          conditions, min_limit: minLimit, max_limit: maxLimit, cooldown_seconds: cooldown
        });
        this.showToast('Reward rule updated.', 'success');
      } else {
        await window.apiClient.createRewardRule({
          name, description: desc, point_type: pointType, amount, trigger_event: trigger,
          conditions, min_limit: minLimit, max_limit: maxLimit, cooldown_seconds: cooldown,
          is_active: 1
        });
        this.showToast('Reward rule created.', 'success');
      }
      this.hideModals();
      this.renderRewardRules();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async submitManualGrant() {
    const agentId = document.getElementById('manual-reward-agent-select').value;
    const amount = parseFloat(document.getElementById('manual-reward-amount').value);
    const pointType = document.getElementById('manual-reward-point-type').value;
    const reason = document.getElementById('manual-reward-reason').value;

    if (!agentId || isNaN(amount) || amount <= 0 || !reason) {
      this.showToast('Agent, positive amount, and reason are required.', 'error');
      return;
    }

    try {
      const res = await window.apiClient.grantManualReward({
        agentId, amount, point_type: pointType, reason
      });
      this.showToast(`Granted ${res.transaction.amount} ${res.transaction.pointType} to ${res.transaction.agentName}!`, 'success');
      this.hideModals();
      this.renderRewardsTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async renderRewardTransactions() {
    const container = document.getElementById('reward-transactions-table-body');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;">Loading transactions...</td></tr>';

    try {
      const res = await window.apiClient.getRewardTransactions(this.rewardFilters);
      
      // Update summary cards
      const s = res.summary;
      document.getElementById('reward-summary-issued').textContent = `${s.totalIssued.toFixed(0)} pts`;
      document.getElementById('reward-summary-reversed').textContent = `${s.totalReversed.toFixed(0)} pts`;
      document.getElementById('reward-summary-net').textContent = `${s.netPoints.toFixed(0)} pts`;

      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">No reward transactions recorded.</td></tr>';
        return;
      }

      container.innerHTML = res.data.map(tx => {
        const isRev = tx.is_reversal === 1;
        const canReverse = !isRev && tx.status !== 'reversed';

        return `
          <tr>
            <td style="font-family:var(--font-mono);font-size:12px;">${this.escapeHtml(tx.transaction_ref)}</td>
            <td>
              <div class="agent-cell">
                <span>${tx.agent_avatar || '👤'}</span>
                <span>${this.escapeHtml(tx.agent_name)}</span>
              </div>
            </td>
            <td style="font-family:var(--font-mono);font-weight:600;color:${isRev ? 'var(--danger-text)' : 'var(--success-text)'};">
              ${isRev ? '' : '+'}${tx.amount.toFixed(1)} ${tx.point_type}
            </td>
            <td>
              <span class="badge ${isRev ? 'badge-deactivated' : (tx.status === 'reversed' ? 'badge-paused' : 'badge-active')}">
                ${isRev ? 'REVERSAL' : tx.status.toUpperCase()}
              </span>
            </td>
            <td style="font-size:12.5px;max-width:240px;color:var(--text-muted);">${this.escapeHtml(tx.reason)}</td>
            <td style="font-size:11.5px;color:var(--text-dim);">${new Date(tx.created_at).toLocaleString()}</td>
            <td>
              ${canReverse ? `
                <button class="btn btn-sm btn-danger" onclick="app.openReversalModal(${tx.id}, '${this.escapeHtml(tx.transaction_ref)}')">Reverse</button>
              ` : '<span style="font-size:11px;color:var(--text-dim);">&mdash;</span>'}
            </td>
          </tr>
        `;
      }).join('');

      this.renderPagination('reward-pagination', res.pagination, (newPage) => {
        this.rewardFilters.page = newPage;
        this.renderRewardTransactions();
      });
    } catch (err) {
      container.innerHTML = `<tr><td colspan="7" style="color:var(--danger-text);padding:20px;">${err.message}</td></tr>`;
    }
  }

  openReversalModal(txId, ref) {
    document.getElementById('reversal-tx-id').value = txId;
    document.getElementById('reversal-ref-display').textContent = ref;
    document.getElementById('reversal-reason-input').value = '';
    this.showModal('modal-reversal');
  }

  async submitReversal() {
    const txId = document.getElementById('reversal-tx-id').value;
    const reason = document.getElementById('reversal-reason-input').value;

    if (!reason.trim()) {
      this.showToast('Please provide a reason for this reversal.', 'error');
      return;
    }

    try {
      await window.apiClient.reverseRewardTransaction(txId, reason.trim());
      this.showToast('Transaction reversed successfully with offsetting ledger entry.', 'success');
      this.hideModals();
      this.renderRewardsTab();
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // TAB: SIMULATION SETTINGS
  // ==========================================
  async renderSettingsTab() {
    try {
      const data = await window.apiClient.getSettings();
      const s = data.settings;

      document.getElementById('setting-tick-rate').value = s.tick_rate_ms;
      document.getElementById('setting-tick-rate-val').textContent = `${s.tick_rate_ms} ms`;
      document.getElementById('setting-weather').value = s.weather;
      document.getElementById('setting-gemini-toggle').checked = s.gemini_enabled === 1;

      const reproToggle = document.getElementById('setting-reproduction-toggle');
      if (reproToggle) reproToggle.checked = s.reproduction_enabled !== 0;

      const maxPopEl = document.getElementById('setting-max-population');
      if (maxPopEl) maxPopEl.value = s.max_population || 25;

      // Gemini API Key Status indicator
      const geminiStatus = document.getElementById('gemini-key-status');
      if (geminiStatus) {
        if (data.hasGeminiKey) {
          geminiStatus.innerHTML = '<span style="color:var(--success-text);">● Backend GEMINI_API_KEY Configured (Isolated server-side & active)</span>';
        } else {
          geminiStatus.innerHTML = '<span style="color:var(--warning-text);">○ No GEMINI_API_KEY set in .env (Operating in Autonomous Heuristic Mode)</span>';
        }
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async saveSettings() {
    const tickRate = parseInt(document.getElementById('setting-tick-rate').value, 10);
    const weather = document.getElementById('setting-weather').value;
    const gemini = document.getElementById('setting-gemini-toggle').checked;
    const reproToggle = document.getElementById('setting-reproduction-toggle');
    const reproduction = reproToggle ? reproToggle.checked : true;
    const maxPopEl = document.getElementById('setting-max-population');
    const maxPopulation = maxPopEl ? parseInt(maxPopEl.value, 10) : 25;

    try {
      await window.apiClient.updateSettings({
        tick_rate_ms: tickRate,
        weather,
        gemini_enabled: gemini,
        reproduction_enabled: reproduction,
        max_population: maxPopulation
      });
      this.showToast('Settings saved successfully.', 'success');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async triggerManualTick() {
    try {
      await window.apiClient.manualTick();
      this.showToast('Manual simulation tick executed.', 'success');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async toggleSimulationEngine() {
    if (!this.snapshot) return;
    const newState = !this.snapshot.isRunning;
    try {
      await window.apiClient.toggleEngine(newState);
      this.showToast(`Simulation engine ${newState ? 'started' : 'paused'}.`, 'info');
      this.fetchSnapshot();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // ==========================================
  // TAB: AUDIT LOGS
  // ==========================================
  async renderAuditTab() {
    const container = document.getElementById('audit-table-body');
    if (!container) return;
    container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:25px;">Loading audit trail...</td></tr>';

    try {
      const res = await window.apiClient.getAuditLogs(this.auditFilters);

      // Populate filter dropdowns if not populated
      const typeSelect = document.getElementById('audit-type-filter');
      if (typeSelect && typeSelect.options.length <= 1) {
        res.availableTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t; opt.textContent = t;
          typeSelect.appendChild(opt);
        });
      }

      if (res.data.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">No audit records found.</td></tr>';
        return;
      }

      container.innerHTML = res.data.map(log => `
        <tr>
          <td style="font-family:var(--font-mono);font-size:11.5px;color:var(--text-dim);">
            ${new Date(log.timestamp).toLocaleString()}
          </td>
          <td><strong style="color:var(--primary-400);">${this.escapeHtml(log.actor)}</strong></td>
          <td><span class="badge badge-resting">${this.escapeHtml(log.action)}</span></td>
          <td>
            <span style="font-size:12px;color:var(--text-muted);">${this.escapeHtml(log.target_type)}</span>
            ${log.target_name ? `<div style="font-weight:500;color:#fff;">${this.escapeHtml(log.target_name)}</div>` : ''}
          </td>
          <td style="font-size:12px;color:var(--text-muted);max-width:320px;font-family:var(--font-mono);">
            ${this.escapeHtml(log.details || '&mdash;')}
          </td>
          <td style="font-size:11px;color:var(--text-dim);">${this.escapeHtml(log.ip_address || 'local')}</td>
        </tr>
      `).join('');

      this.renderPagination('audit-pagination', res.pagination, (newPage) => {
        this.auditFilters.page = newPage;
        this.renderAuditTab();
      });
    } catch (err) {
      container.innerHTML = `<tr><td colspan="6" style="color:var(--danger-text);padding:20px;">${err.message}</td></tr>`;
    }
  }

  // ==========================================
  // HELPERS & MODALS
  // ==========================================
  async populateAgentSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    try {
      const res = await window.apiClient.getAgents({ limit: 100 });
      sel.innerHTML = '<option value="">-- Choose Agent --</option>' + res.data.map(a => `
        <option value="${a.id}">${a.avatar || '👤'} ${a.name} (${a.occupation})</option>
      `).join('');
    } catch (e) {}
  }

  showModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('open');
  }

  hideModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  showLoginModal() {
    this.hideModals();
    this.showModal('modal-login');
  }

  showSetupModal() {
    this.hideModals();
    this.showModal('modal-setup');
  }

  showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;

    const confirmBtn = document.getElementById('confirm-modal-btn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
      this.hideModals();
      onConfirm();
    });

    this.showModal('modal-confirm');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span style="font-size:16px;">${type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ')}</span>
      <div style="flex:1;">${this.escapeHtml(message)}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  renderPagination(containerId, pagination, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || !pagination) return;

    const { page, totalPages, total } = pagination;
    const maxPage = Math.max(1, totalPages || 1);
    const currentPage = Math.max(1, Math.min(page || 1, maxPage));

    container.innerHTML = `
      <span>Showing page <strong>${currentPage}</strong> of <strong>${maxPage}</strong> (${total || 0} total records)</span>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" class="btn btn-sm btn-secondary btn-pag-prev" ${currentPage <= 1 ? 'disabled' : ''} style="cursor:${currentPage <= 1 ? 'not-allowed' : 'pointer'};">Prev</button>
        <span style="font-size:12px;color:var(--text-muted);padding:0 4px;font-family:var(--font-mono);font-weight:600;">${currentPage} / ${maxPage}</span>
        <button type="button" class="btn btn-sm btn-secondary btn-pag-next" ${currentPage >= maxPage ? 'disabled' : ''} style="cursor:${currentPage >= maxPage ? 'not-allowed' : 'pointer'};">Next</button>
      </div>
    `;

    const prevBtn = container.querySelector('.btn-pag-prev');
    const nextBtn = container.querySelector('.btn-pag-next');

    if (prevBtn && currentPage > 1) {
      prevBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onPageChange === 'function') {
          onPageChange(currentPage - 1);
        }
      };
    }

    if (nextBtn && currentPage < maxPage) {
      nextBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof onPageChange === 'function') {
          onPageChange(currentPage + 1);
        }
      };
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AdminApp();
});
