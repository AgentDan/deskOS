const { parseIntent } = require('../dialog/intentLayer');
const { getNextQuestion, processMessage } = require('../dialog/scenario');
const { createProfile, updateProfile } = require('../profile/customerProfile');

describe('intent layer and dialog scenario', () => {
  it('recognizes two monitors', () => {
    const intent = parseIntent('хочу два монитора');

    expect(intent.intent).toBe('configure_workspace');
    expect(intent.updates.monitors).toBe(2);
  });

  it('recognizes a standing desk', () => {
    const intent = parseIntent('хочу работать стоя');

    expect(intent.updates.sittingStanding).toBe(true);
  });

  it('asks about sittingStanding after monitors are known', () => {
    const profile = updateProfile(createProfile(), { monitors: 2 });

    expect(getNextQuestion(profile)).toBe(
      'Нужен стол с подъёмной рамой — работать стоя?'
    );
  });

  it('returns null when the scenario is complete', () => {
    const profile = updateProfile(createProfile(), {
      workType: 'office',
      usersCount: 1,
      sittingStanding: true,
      deskWidth: 1600,
      deskDepth: 800,
      monitors: 2,
      laptop: true,
      storageRequired: false,
      cableManagement: true,
      budgetEur: 1200,
    });

    expect(getNextQuestion(profile)).toBeNull();
  });

  it('processes a message, updates the profile and asks the next question', () => {
    const profile = createProfile();
    const result = processMessage('хочу ноутбук и два монитора', profile);

    expect(result.updatedProfile.workspace.monitors).toBe(2);
    expect(result.updatedProfile.workspace.laptop).toBe(true);
    expect(profile.workspace.monitors).toBeNull();
    expect(profile.workspace.laptop).toBeNull();
    expect(result.nextQuestion).toBe(
      'Нужен стол с подъёмной рамой — работать стоя?'
    );
  });
});
