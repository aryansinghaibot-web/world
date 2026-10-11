#!/usr/bin/env node

/**
 * Secure Initial Administrator Provisioning CLI Tool
 *
 * Usage:
 *   node scripts/create-admin.js --username <admin_username> --password <strong_password>
 * Or run without arguments for interactive secure prompts.
 */

const readline = require('readline');
const { getDatabase } = require('../src/db/database');
const { createAdminUser, updateAdminPassword } = require('../src/security/auth');
const { logAuditEvent } = require('../src/security/middleware');

// Parse flags if passed
const args = process.argv.slice(2);
let cliUsername = null;
let cliPassword = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--username' || args[i] === '-u') {
    cliUsername = args[i + 1];
    i++;
  } else if (args[i] === '--password' || args[i] === '-p') {
    cliPassword = args[i + 1];
    i++;
  }
}

async function main() {
  console.log('====================================================');
  console.log(' Autonomous AI Simulation - Administrator Setup CLI');
  console.log('====================================================');

  const db = getDatabase();

  let username = cliUsername;
  let password = cliPassword;

  if (!username || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise(resolve => rl.question(query, resolve));

    if (!username) {
      username = await question('Enter administrator username (min 3 chars): ');
    }
    if (!password) {
      password = await question('Enter administrator password (min 8 chars): ');
    }
    rl.close();
  }

  try {
    const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username.trim().toLowerCase());
    let admin = null;
    let action = 'ADMIN_CREATED_CLI';

    if (existing) {
      if (args.includes('--reset') || args.includes('-r')) {
        admin = updateAdminPassword(username, password);
        action = 'ADMIN_PASSWORD_RESET_CLI';
        console.log(`\n[SUCCESS] Administrator password for "${admin.username}" updated successfully!`);
      } else {
        throw new Error(`Administrator "${username}" already exists. Pass --reset flag to update their password.`);
      }
    } else {
      admin = createAdminUser(username, password, 'superadmin');
      console.log('\n[SUCCESS] Administrator account provisioned successfully!');
    }

    console.log(`- ID: ${admin.id}`);
    console.log(`- Username: ${admin.username}`);
    console.log(`- Role: ${admin.role}`);
    console.log('\nYou can now log in to the Admin Control Panel at http://localhost:3000');

    logAuditEvent({
      actor: `CLI Tool`,
      action,
      targetType: 'AdminAuth',
      targetId: admin.id,
      targetName: admin.username,
      details: { role: admin.role, method: 'cli' }
    });

    process.exit(0);
  } catch (err) {
    console.error(`\n[ERROR] Setup failed: ${err.message}`);
    process.exit(1);
  }
}

main();
