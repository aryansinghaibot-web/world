const fs = require('fs');
const path = require('path');

const SEED_PORTRAITS = {
  'Dr. Evelyn Reed': '/assets/portraits/evelyn.jpg',
  'Marcus Vance': '/assets/portraits/marcus.jpg',
  'Aria Thorne': '/assets/portraits/aria.jpg',
  'Kaito Tanaka': '/assets/portraits/kaito.jpg',
  'Elena Rostova': '/assets/portraits/elena.jpg',
  'Julian Hayes': '/assets/portraits/julian.jpg',
  'Sora Williams': '/assets/portraits/sora.jpg',
  'Tariq Al-Mansoor': '/assets/portraits/tariq.jpg',
  'Nadia Chen': '/assets/portraits/nadia.jpg'
};

const DIVERSE_PORTRAITS = [
  '/assets/portraits/child.jpg',
  '/assets/portraits/evelyn.jpg',
  '/assets/portraits/marcus.jpg',
  '/assets/portraits/aria.jpg',
  '/assets/portraits/kaito.jpg',
  '/assets/portraits/elena.jpg',
  '/assets/portraits/julian.jpg',
  '/assets/portraits/sora.jpg',
  '/assets/portraits/tariq.jpg',
  '/assets/portraits/nadia.jpg'
];

/**
 * Get or assign realistic photographic portrait URL for an agent.
 */
function getPortraitUrl(agent) {
  if (agent.photo_url) return agent.photo_url;
  if (SEED_PORTRAITS[agent.name]) return SEED_PORTRAITS[agent.name];
  
  if (agent.age !== undefined && agent.age < 15) {
    return '/assets/portraits/child.jpg';
  }

  // Consistent hash based on agent name or ID
  const seed = (agent.name || 'Agent').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return DIVERSE_PORTRAITS[seed % DIVERSE_PORTRAITS.length];
}

module.exports = {
  SEED_PORTRAITS,
  getPortraitUrl
};
