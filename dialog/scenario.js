const { parseIntent } = require('./intentLayer');
const { updateProfile } = require('../profile/customerProfile');

const QUESTIONS = [
  { field: 'monitors', text: 'Сколько мониторов планируете?' },
];

function getNextQuestion(profile) {
  const question = QUESTIONS.find((item) => profile.workspace[item.field] == null);
  return question ? question.text : null;
}

const BOOLEAN_FIELDS = ['sittingStanding', 'laptop', 'storageRequired', 'cableManagement'];

function applyYesNo(text, profile, updates) {
  const pending = QUESTIONS.find((item) => profile.workspace[item.field] == null);
  if (!pending || !BOOLEAN_FIELDS.includes(pending.field)) {
    return;
  }
  if (Object.prototype.hasOwnProperty.call(updates, pending.field)) {
    return;
  }

  const source = String(text ?? '').trim().toLowerCase();
  if (source.startsWith('да') || source.startsWith('yes')) {
    updates[pending.field] = true;
  } else if (source.startsWith('нет') || source.startsWith('no')) {
    updates[pending.field] = false;
  }
}

function processMessage(text, profile) {
  const intent = parseIntent(text, profile);
  applyYesNo(text, profile, intent.updates);
  const updatedProfile = updateProfile(profile, intent.updates);
  const nextQuestion = getNextQuestion(updatedProfile);

  console.log('[dialog] updates=', intent.updates, 'nextQuestion=', nextQuestion);

  return {
    updatedProfile,
    intent,
    nextQuestion,
  };
}

module.exports = {
  QUESTIONS,
  getNextQuestion,
  processMessage,
};
