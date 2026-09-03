const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROFILES_DIR = path.join(__dirname, '..', 'profiles');

const EMPTY_WORKSPACE = {
  workType: null,
  usersCount: null,
  sittingStanding: null,
  deskWidth: null,
  deskDepth: null,
  monitors: null,
  laptop: null,
  storageRequired: null,
  cableManagement: null,
  budgetEur: null,
};

function createProfile(id) {
  const now = new Date().toISOString();

  return {
    id: id ?? crypto.randomUUID(),
    workspace: { ...EMPTY_WORKSPACE },
    preferences: {},
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

function updateProfile(profile, updates) {
  const changedAt = new Date().toISOString();
  const workspace = { ...profile.workspace };
  const history = profile.history.map((entry) => ({ ...entry }));

  for (const [field, newValue] of Object.entries(updates)) {
    const oldValue = workspace[field];
    if (oldValue === newValue) {
      continue;
    }

    history.push({
      field,
      oldValue,
      newValue,
      changedAt,
    });
    workspace[field] = newValue;
  }

  return {
    ...profile,
    workspace,
    preferences: { ...profile.preferences },
    history,
    updatedAt: changedAt,
  };
}

function saveProfile(profile) {
  fs.mkdirSync(PROFILES_DIR, { recursive: true });
  const filePath = path.join(PROFILES_DIR, `${profile.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf8');
  console.log('Profile ' + profile.id + ' saved');
}

function loadProfile(id) {
  const filePath = path.join(PROFILES_DIR, `${id}.json`);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    console.log('Profile ' + id + ' loaded');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Profile ' + id + ' not found');
      return null;
    }
    throw error;
  }
}

function printDemo() {
  const created = createProfile();
  console.log('Created profile with id ' + created.id);

  const updated = updateProfile(created, { monitors: 2 });
  console.log('Updated monitors: ' + updated.workspace.monitors);

  saveProfile(updated);

  const loaded = loadProfile(updated.id);
  console.log('Loaded profile id ' + loaded.id);
  console.log('history:', JSON.stringify(loaded.history, null, 2));
}

module.exports = {
  createProfile,
  updateProfile,
  saveProfile,
  loadProfile,
};

if (require.main === module) {
  printDemo();
}
