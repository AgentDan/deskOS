const WORKSPACE_FIELDS = [
  'workType',
  'usersCount',
  'sittingStanding',
  'deskWidth',
  'deskDepth',
  'monitors',
  'laptop',
  'storageRequired',
  'cableManagement',
  'budgetEur',
];

function parseMonitors(text) {
  if (!text.includes('монитор') && !text.includes('monitor')) {
    return undefined;
  }

  const counted = text.match(/(\d+)\s*(?:монитор|monitor)/);
  if (counted) {
    return Number(counted[1]);
  }

  if (text.includes('два') || text.includes('two')) {
    return 2;
  }

  return 1;
}

function parseDeskWidth(text) {
  if (!text.includes('стол') && !text.includes('ширина')) {
    return undefined;
  }

  const match = text.match(/(\d+)\s*(мм|mm|см|cm)/);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  const unit = match[2];
  return unit === 'см' || unit === 'cm' ? value * 10 : value;
}

function parseBudget(text) {
  if (!text.includes('бюджет')) {
    return undefined;
  }

  const match = text.match(/бюджет[^\d]*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function isNegated(text) {
  return (
    text.includes('нет') ||
    text.includes('без') ||
    text.includes('не нужен') ||
    text.includes('не буду')
  );
}

function parseIntent(text, profile) {
  const source = String(text ?? '').toLowerCase();
  const updates = {};

  const monitors = parseMonitors(source);
  if (monitors !== undefined) {
    updates.monitors = monitors;
  }

  if (
    source.includes('подъёмн') ||
    source.includes('подъемн') ||
    source.includes('стоя') ||
    source.includes('standing')
  ) {
    updates.sittingStanding = true;
  }

  if (source.includes('ноутбук') || source.includes('laptop')) {
    updates.laptop = !isNegated(source);
  }

  if (
    source.includes('ящик') ||
    source.includes('drawer') ||
    source.includes('хранение') ||
    source.includes('storage')
  ) {
    updates.storageRequired = !isNegated(source);
  }

  if (source.includes('кабел') || source.includes('cable')) {
    updates.cableManagement = !isNegated(source);
  }

  const deskWidth = parseDeskWidth(source);
  if (deskWidth !== undefined) {
    updates.deskWidth = deskWidth;
  }

  const budgetEur = parseBudget(source);
  if (budgetEur !== undefined) {
    updates.budgetEur = budgetEur;
  }

  const workspace = profile && profile.workspace ? profile.workspace : {};
  const missing = WORKSPACE_FIELDS.filter((field) => {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      return false;
    }
    return workspace[field] == null;
  });

  return {
    intent: 'configure_workspace',
    updates,
    missing,
  };
}

module.exports = { parseIntent };
