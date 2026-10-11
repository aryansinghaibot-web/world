/**
 * Secure Admin API Client with CSRF token management and error handling
 */

class AdminApiClient {
  constructor() {
    this.csrfToken = null;
    this.currentAdmin = null;
    this.onAuthRequired = null;
  }

  setCsrfToken(token) {
    this.csrfToken = token;
  }

  setAdmin(admin) {
    this.currentAdmin = admin;
  }

  async request(endpoint, options = {}) {
    const headers = options.headers || {};
    headers['Content-Type'] = 'application/json';

    // State-changing requests attach CSRF token
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && this.csrfToken) {
      headers['x-csrf-token'] = this.csrfToken;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);

      if (response.status === 401) {
        this.currentAdmin = null;
        if (this.onAuthRequired) {
          this.onAuthRequired();
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Unauthorized access. Please log in.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      throw err;
    }
  }

  // Auth Endpoints
  async checkSetupStatus() {
    return this.request('/api/admin/auth/setup-status');
  }

  async initialSetup(username, password) {
    const res = await this.request('/api/admin/auth/initial-setup', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.csrfToken = res.csrfToken;
    this.currentAdmin = res.admin;
    return res;
  }

  async login(username, password) {
    const res = await this.request('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.csrfToken = res.csrfToken;
    this.currentAdmin = res.admin;
    return res;
  }

  async logout() {
    const res = await this.request('/api/admin/auth/logout', { method: 'POST' });
    this.csrfToken = null;
    this.currentAdmin = null;
    return res;
  }

  async getCurrentSession() {
    try {
      const res = await this.request('/api/admin/auth/me');
      this.currentAdmin = res.admin;
      this.csrfToken = res.csrfToken;
      return res;
    } catch (e) {
      this.currentAdmin = null;
      return null;
    }
  }

  // World Simulation Endpoints
  async getWorldSnapshot() {
    return this.request('/api/world/snapshot');
  }

  // Agent Management Endpoints
  async getAgents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/agents${query ? '?' + query : ''}`);
  }

  async getAgentDetails(id, privacy = 'all') {
    return this.request(`/api/admin/agents/${id}?privacy=${privacy}`);
  }

  async pauseAgent(id) {
    return this.request(`/api/admin/agents/${id}/pause`, { method: 'POST' });
  }

  async resumeAgent(id) {
    return this.request(`/api/admin/agents/${id}/resume`, { method: 'POST' });
  }

  async deactivateAgent(id) {
    return this.request(`/api/admin/agents/${id}/deactivate`, { method: 'POST' });
  }

  async reactivateAgent(id) {
    return this.request(`/api/admin/agents/${id}/reactivate`, { method: 'POST' });
  }

  async updateAgentAttributes(id, attributes) {
    return this.request(`/api/admin/agents/${id}/attributes`, {
      method: 'PATCH',
      body: JSON.stringify(attributes)
    });
  }

  // Belief Profile Endpoints
  async getBeliefStats() {
    return this.request('/api/admin/beliefs/stats');
  }

  async updateBeliefProfile(agentId, data) {
    return this.request(`/api/admin/beliefs/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // Reward Engine Endpoints
  async getRewardRules() {
    return this.request('/api/admin/rewards/rules');
  }

  async createRewardRule(rule) {
    return this.request('/api/admin/rewards/rules', {
      method: 'POST',
      body: JSON.stringify(rule)
    });
  }

  async updateRewardRule(id, rule) {
    return this.request(`/api/admin/rewards/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rule)
    });
  }

  async toggleRewardRule(id) {
    return this.request(`/api/admin/rewards/rules/${id}/toggle`, { method: 'PATCH' });
  }

  async deleteRewardRule(id) {
    return this.request(`/api/admin/rewards/rules/${id}`, { method: 'DELETE' });
  }

  async applyRewardRuleBulk(id, bypassCooldown = false) {
    return this.request(`/api/admin/rewards/rules/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ bypassCooldown })
    });
  }

  async previewRewardRule(conditions) {
    return this.request('/api/admin/rewards/preview', {
      method: 'POST',
      body: JSON.stringify({ conditions })
    });
  }

  async grantManualReward(data) {
    return this.request('/api/admin/rewards/grant', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getRewardTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/rewards/transactions${query ? '?' + query : ''}`);
  }

  async reverseRewardTransaction(id, reason) {
    return this.request(`/api/admin/rewards/transactions/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Settings Endpoints
  async getSettings() {
    return this.request('/api/admin/settings');
  }

  async updateSettings(settings) {
    return this.request('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }

  async toggleEngine(running) {
    return this.request('/api/admin/settings/toggle-engine', {
      method: 'POST',
      body: JSON.stringify({ running })
    });
  }

  async manualTick() {
    return this.request('/api/admin/settings/manual-tick', { method: 'POST' });
  }

  async setTimeSpeed(multiplier) {
    return this.request('/api/admin/settings/time-speed', {
      method: 'POST',
      body: JSON.stringify({ multiplier })
    });
  }

  async setTimeOfDay(timeOfDay, hour = null) {
    return this.request('/api/admin/settings/time-of-day', {
      method: 'POST',
      body: JSON.stringify({ timeOfDay, hour })
    });
  }

  async declareAgentDeceased(id, cause = 'Natural Causes') {
    return this.request(`/api/admin/agents/${id}/declare-deceased`, {
      method: 'POST',
      body: JSON.stringify({ cause })
    });
  }

  async triggerMortality(cause = null) {
    return this.request('/api/admin/settings/trigger-mortality', {
      method: 'POST',
      body: JSON.stringify({ cause })
    });
  }

  async toggleMortality(enabled = undefined) {
    return this.request('/api/admin/settings/toggle-mortality', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  }

  // Prayers & Mannats Endpoints
  async getPrayers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/prayers${query ? '?' + query : ''}`);
  }

  async getPrayerDetails(id) {
    return this.request(`/api/admin/prayers/${id}`);
  }

  async fulfillPrayer(id, data = {}) {
    const payload = typeof data === 'string' ? { notes: data } : (data || {});
    return this.request(`/api/admin/prayers/${id}/fulfill`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async declinePrayer(id, data = {}) {
    const payload = typeof data === 'string' ? { notes: data } : (data || {});
    return this.request(`/api/admin/prayers/${id}/decline`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async postponePrayer(id, data = {}) {
    const payload = typeof data === 'string' ? { notes: data } : (data || {});
    return this.request(`/api/admin/prayers/${id}/postpone`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async resolvePrayer(id, data = {}) {
    const payload = typeof data === 'string' ? { notes: data } : (data || {});
    return this.request(`/api/admin/prayers/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Audit Logs Endpoints
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/audit${query ? '?' + query : ''}`);
  }
}

window.apiClient = new AdminApiClient();
