const { parseIntent } = require('../dialog/intentLayer');
const { getNextQuestion, processMessage } = require('../dialog/scenario');
const { createProfile, updateProfile } = require('../profile/customerProfile');

describe('intent layer and dialog scenario', () => {
  it('recognizes two monitors', () => {
    const intent = parseIntent('хочу два монитора');

    expect(intent.intent).toBe('configure_workspace');
    expect(intent.updates.monitors).toBe(2);
  });

  it('asks about monitors on an empty profile', () => {
    const profile = createProfile();

    expect(getNextQuestion(profile)).toBe('Сколько мониторов планируете?');
  });

  it('returns null when monitors are known', () => {
    const profile = updateProfile(createProfile(), { monitors: 2 });

    expect(getNextQuestion(profile)).toBeNull();
  });

  it('processes a message, updates the profile and finishes the scenario', () => {
    const profile = createProfile();
    const result = processMessage('хочу два монитора', profile);

    expect(result.updatedProfile.workspace.monitors).toBe(2);
    expect(profile.workspace.monitors).toBeNull();
    expect(result.nextQuestion).toBeNull();
  });
});
