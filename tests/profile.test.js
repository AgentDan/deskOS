const fs = require('fs');
const path = require('path');
const {
  createProfile,
  updateProfile,
  saveProfile,
  loadProfile,
} = require('../profile/customerProfile');

const PROFILES_DIR = path.join(__dirname, '..', 'profiles');

function removeProfileFile(id) {
  const filePath = path.join(PROFILES_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

describe('customerProfile', () => {
  const savedIds = [];

  afterEach(() => {
    while (savedIds.length > 0) {
      removeProfileFile(savedIds.pop());
    }
  });

  it('creates a profile with null workspace fields and valid dates', () => {
    const profile = createProfile();

    expect(typeof profile.id).toBe('string');
    expect(profile.id.length).toBeGreaterThan(0);
    expect(profile.workspace).toEqual({
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
    });
    expect(profile.history).toEqual([]);
    expect(Number.isNaN(Date.parse(profile.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(profile.updatedAt))).toBe(false);
  });

  it('updates workspace fields and records history without mutating the original', () => {
    const profile = createProfile();
    const updated = updateProfile(profile, {
      monitors: 2,
      sittingStanding: true,
    });

    expect(updated.workspace.monitors).toBe(2);
    expect(updated.workspace.sittingStanding).toBe(true);
    expect(updated.history).toHaveLength(2);
    expect(profile.workspace.monitors).toBeNull();
    expect(profile.history).toHaveLength(0);

    for (const entry of updated.history) {
      expect(entry).toEqual(
        expect.objectContaining({
          field: expect.any(String),
          changedAt: expect.any(String),
        })
      );
      expect(Object.prototype.hasOwnProperty.call(entry, 'oldValue')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(entry, 'newValue')).toBe(true);
      expect(Number.isNaN(Date.parse(entry.changedAt))).toBe(false);
    }
  });

  it('keeps both history records after a second monitors update', () => {
    const profile = createProfile();
    const first = updateProfile(profile, { monitors: 1 });
    const second = updateProfile(first, { monitors: 3 });

    expect(second.workspace.monitors).toBe(3);
    expect(second.history).toHaveLength(2);
    expect(second.history[0]).toEqual(
      expect.objectContaining({
        field: 'monitors',
        oldValue: null,
        newValue: 1,
      })
    );
    expect(second.history[1]).toEqual(
      expect.objectContaining({
        field: 'monitors',
        oldValue: 1,
        newValue: 3,
      })
    );
  });

  it('saves a profile and loads the same data back', () => {
    const created = createProfile();
    const saved = updateProfile(created, { monitors: 2 });
    savedIds.push(saved.id);

    saveProfile(saved);
    const loaded = loadProfile(saved.id);

    expect(loaded).toEqual(saved);
    expect(loaded.id).toBe(saved.id);
  });

  it('returns null for a missing profile without throwing', () => {
    let loaded;

    expect(() => {
      loaded = loadProfile('несуществующий-id');
    }).not.toThrow();
    expect(loaded).toBeNull();
  });
});
