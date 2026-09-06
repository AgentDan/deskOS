const path = require('path');
const fs = require('fs');
const { loadGraph } = require('../catalog/graph');
const compatibility = require('../core/compatibility');
const solver = require('../core/solver');
const bom = require('../core/bom');
const { createProfile, saveProfile, loadProfile } = require('../profile/customerProfile');
const { getNextQuestion, processMessage } = require('../dialog/scenario');
const { buildItemsFromProfile } = require('../dialog/profileToItems');

const DEFAULT_ITEMS = [
  'desk_frame',
  'desk_top',
  'monitor_arm',
  'monitor',
  'keyboard',
  'mouse',
];

function loadManifest() {
  const manifestPath = path.join(__dirname, '..', 'manifest', 'workspace.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function parseItems(queryItems) {
  if (!queryItems || String(queryItems).trim() === '') {
    return DEFAULT_ITEMS;
  }

  return String(queryItems)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function runConfiguration(items, profile, options) {
  // Здесь определяется, является ли конфигурация завершённой. 
  // Если в объекте options установлен флаг isComplete,
  //  то isComplete будет true, иначе false.
  const isComplete = Boolean(options && options.isComplete);
  const graph = loadGraph();
  const manifest = loadManifest();
  const profileId = profile && profile.id ? profile.id : 'none';

  const compatibilityResult = compatibility.assertCompatible(items, graph);
  console.log(`[pipeline] profileId=${profileId} compatible=${compatibilityResult.valid}`);

  if (!compatibilityResult.valid) {
    return {
      status: isComplete ? 'conflict' : 'partial',
      compatibilityResult,
      sceneSolution: null,
      bom: null,
      graph,
    };
  }

  const sceneSolution = solver.solve(items, graph, manifest);
  console.log(`[pipeline] profileId=${profileId} solve=${sceneSolution.status}`);

  if (sceneSolution.status !== 'solved') {
    return {
      status: isComplete ? 'unsolvable' : 'partial',
      compatibilityResult,
      sceneSolution,
      bom: null,
      graph,
    };
  }

  const calculatedBom = bom.calculateBOM(items, graph, manifest, profile);
  return {
    status: isComplete ? 'complete' : 'partial',
    compatibilityResult,
    sceneSolution,
    bom: calculatedBom,
    graph,
  };
}

function attachRoutes(app) {
  app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  });

  app.get('/api/scene', (req, res) => {
    const items = parseItems(req.query.items);
    const result = runConfiguration(items, null, { isComplete: true });
    res.status(200).json(result);
  });

  app.post('/api/session/start', (_req, res) => {
    const profile = createProfile();
    saveProfile(profile);
    const nextQuestion = getNextQuestion(profile);
    console.log(`[session] start profileId=${profile.id}`);
    res.status(200).json({
      profileId: profile.id,
      nextQuestion,
    });
  });

  app.post('/api/session/message', (req, res) => {
    const { profileId, text } = req.body || {};
    const profile = loadProfile(profileId);
    if (!profile) {
      return res.status(200).json({
        error: 'Profile ' + profileId + ' not found',
        compatibilityResult: { valid: false, conflicts: [], suggestedSkus: [] },
      });
    }

    const processed = processMessage(String(text ?? ''), profile);
    saveProfile(processed.updatedProfile);

    const graph = loadGraph();
    const items = buildItemsFromProfile(processed.updatedProfile, graph);
    const isComplete = processed.nextQuestion === null;
    const result = runConfiguration(items, processed.updatedProfile, { isComplete });

    return res.status(200).json({
      profileId,
      nextQuestion: processed.nextQuestion,
      updatedProfile: processed.updatedProfile,
      status: result.status,
      compatibilityResult: result.compatibilityResult,
      sceneSolution: result.sceneSolution,
      bom: result.bom,
      graph: result.graph,
    });
  });

  app.post('/api/session/update', (req, res) => {
    const { profileId, items } = req.body || {};
    console.log(`[session] update profileId=${profileId}`);

    const profile = loadProfile(profileId);
    if (!profile) {
      return res.status(200).json({
        error: 'Profile ' + profileId + ' not found',
        compatibilityResult: { valid: false, conflicts: [], suggestedSkus: [] },
        sceneSolution: null,
        bom: null,
      });
    }

    const result = runConfiguration(items ?? [], profile, { isComplete: true });
    res.status(200).json({
      profileId,
      status: result.status,
      compatibilityResult: result.compatibilityResult,
      sceneSolution: result.sceneSolution,
      bom: result.bom,
      graph: result.graph,
    });
  });
}

module.exports = { attachRoutes, runConfiguration };
