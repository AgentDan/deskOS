const fs = require('fs');
const http = require('http');
const path = require('path');
const { createApp } = require('../api/server');
const { runConfiguration } = require('../api/routes');
const compatibility = require('../core/compatibility');
const solver = require('../core/solver');
const bom = require('../core/bom');

const QUESTIONS = {
  sittingStanding: 'Нужен стол с подъёмной рамой — работать стоя?',
};

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch (error) {
            json = { raw };
          }
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

describe('api routes incremental pipeline', () => {
  let server;
  let port;
  const createdIds = [];

  beforeAll((done) => {
    server = createApp().listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const profilesDir = path.join(__dirname, '..', 'profiles');
    while (createdIds.length > 0) {
      const id = createdIds.pop();
      const filePath = path.join(profilesDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  function get(urlPath) {
    return request(port, 'GET', urlPath);
  }

  function post(urlPath, body) {
    return request(port, 'POST', urlPath, body);
  }

  async function startSession() {
    const started = await post('/api/session/start');
    expect(started.status).toBe(200);
    createdIds.push(started.json.profileId);
    return started.json.profileId;
  }

  it('returns nextQuestion and a partial scene after the first answer', async () => {
    const profileId = await startSession();
    const compatibilitySpy = jest.spyOn(compatibility, 'assertCompatible');

    const step = await post('/api/session/message', {
      profileId,
      text: 'два монитора',
    });

    expect(step.status).toBe(200);
    expect(step.json.nextQuestion).toBe(QUESTIONS.sittingStanding);
    expect(step.json.nextQuestion).not.toBeNull();
    expect(step.json.status).toBe('partial');
    expect(step.json.compatibilityResult).toBeDefined();
    expect(compatibilitySpy).toHaveBeenCalledTimes(1);

    if (step.json.compatibilityResult.valid) {
      expect(step.json.sceneSolution).not.toBeNull();
      expect(step.json.sceneSolution.status).toBe('solved');
      expect(step.json.bom).not.toBeNull();
    }
  });

  it('keeps a missing-requires set as partial without failing the request', async () => {
    const profileId = await startSession();
    jest.spyOn(compatibility, 'assertCompatible').mockReturnValue({
      valid: false,
      conflicts: [
        {
          element: 'monitor',
          reason: 'requires missing monitor_arm',
          missingId: 'monitor_arm',
        },
      ],
      suggestedSkus: ['monitor_arm'],
    });
    const solveSpy = jest.spyOn(solver, 'solve');
    const bomSpy = jest.spyOn(bom, 'calculateBOM');

    const step = await post('/api/session/message', {
      profileId,
      text: 'два монитора',
    });

    expect(step.status).toBe(200);
    expect(step.json.status).toBe('partial');
    expect(step.json.nextQuestion).not.toBeNull();
    expect(step.json.compatibilityResult.valid).toBe(false);
    expect(step.json.sceneSolution).toBeNull();
    expect(step.json.bom).toBeNull();
    expect(solveSpy).not.toHaveBeenCalled();
    expect(bomSpy).not.toHaveBeenCalled();
  });

  it('marks the last answer as complete with a solved scene and BOM', async () => {
    const profileId = await startSession();

    await post('/api/session/message', { profileId, text: 'два монитора' });
    await post('/api/session/message', { profileId, text: 'да, работаю стоя' });
    await post('/api/session/message', { profileId, text: 'стол 1600мм' });
    await post('/api/session/message', { profileId, text: 'нет ноутбука' });
    await post('/api/session/message', { profileId, text: 'нужен ящик' });
    await post('/api/session/message', { profileId, text: 'да кабель-канал' });

    const finished = await post('/api/session/message', {
      profileId,
      text: 'бюджет 1500 евро',
    });

    expect(finished.status).toBe(200);
    expect(finished.json.nextQuestion).toBeNull();
    expect(finished.json.status).toBe('complete');
    expect(finished.json.sceneSolution).not.toBeNull();
    expect(finished.json.sceneSolution.status).toBe('solved');
    expect(finished.json.bom).not.toBeNull();
  });

  it('surfaces incompatibleWith conflicts during the dialog as partial', async () => {
    const profileId = await startSession();
    const conflicts = [
      {
        element: 'desk_frame',
        reason: 'incompatible with drawer',
      },
    ];
    jest.spyOn(compatibility, 'assertCompatible').mockReturnValue({
      valid: false,
      conflicts,
      suggestedSkus: [],
    });

    const step = await post('/api/session/message', {
      profileId,
      text: 'два монитора',
    });

    expect(step.status).toBe(200);
    expect(step.json.status).toBe('partial');
    expect(step.json.nextQuestion).not.toBeNull();
    expect(step.json.sceneSolution).toBeNull();
    expect(step.json.bom).toBeNull();
    expect(step.json.compatibilityResult.valid).toBe(false);
    expect(step.json.compatibilityResult.conflicts).toEqual(conflicts);
    expect(step.json.compatibilityResult.suggestedSkus).toEqual([]);
  });

  it('treats /api/scene as a complete request and never returns partial', async () => {
    const ok = await get('/api/scene');
    expect(ok.status).toBe(200);
    expect(ok.json.status).toBe('complete');
    expect(ok.json.status).not.toBe('partial');
    expect(ok.json.sceneSolution.status).toBe('solved');
    expect(ok.json.bom).not.toBeNull();

    const conflict = await get('/api/scene?items=monitor');
    expect(conflict.status).toBe(200);
    expect(conflict.json.status).toBe('conflict');
    expect(conflict.json.status).not.toBe('partial');
    expect(conflict.json.compatibilityResult.valid).toBe(false);
    expect(conflict.json.sceneSolution).toBeNull();
    expect(conflict.json.bom).toBeNull();

    const unsolvable = await get(
      '/api/scene?items=desk_frame,desk_top,drawer,drawer'
    );
    expect(unsolvable.status).toBe(200);
    expect(unsolvable.json.status).toBe('unsolvable');
    expect(unsolvable.json.status).not.toBe('partial');
    expect(unsolvable.json.sceneSolution.status).toBe('unsolvable');
    expect(unsolvable.json.bom).toBeNull();
  });

  it('treats /api/session/update as a complete request and never returns partial', async () => {
    const profileId = await startSession();

    const ok = await post('/api/session/update', {
      profileId,
      items: ['desk_frame', 'desk_top', 'monitor_arm', 'monitor'],
    });
    expect(ok.status).toBe(200);
    expect(ok.json.status).toBe('complete');
    expect(ok.json.status).not.toBe('partial');
    expect(ok.json.sceneSolution.status).toBe('solved');
    expect(ok.json.bom).not.toBeNull();

    const conflict = await post('/api/session/update', {
      profileId,
      items: ['monitor'],
    });
    expect(conflict.status).toBe(200);
    expect(conflict.json.status).toBe('conflict');
    expect(conflict.json.status).not.toBe('partial');
    expect(conflict.json.compatibilityResult.valid).toBe(false);
    expect(conflict.json.sceneSolution).toBeNull();
    expect(conflict.json.bom).toBeNull();
  });
});

describe('runConfiguration status wrapper', () => {
  const emptyProfile = {
    id: 'test-profile',
    workspace: {},
  };

  it('uses conflict for an incomplete-looking set only when isComplete is true', () => {
    const incomplete = runConfiguration(['monitor'], emptyProfile, { isComplete: false });
    expect(incomplete.status).toBe('partial');
    expect(incomplete.compatibilityResult.valid).toBe(false);
    expect(incomplete.sceneSolution).toBeNull();
    expect(incomplete.bom).toBeNull();

    const complete = runConfiguration(['monitor'], emptyProfile, { isComplete: true });
    expect(complete.status).toBe('conflict');
    expect(complete.compatibilityResult.valid).toBe(false);
    expect(complete.sceneSolution).toBeNull();
    expect(complete.bom).toBeNull();
  });

  it('uses unsolvable only when isComplete is true', () => {
    const items = ['desk_frame', 'desk_top', 'drawer', 'drawer'];
    const incomplete = runConfiguration(items, emptyProfile, { isComplete: false });
    expect(incomplete.compatibilityResult.valid).toBe(true);
    expect(incomplete.sceneSolution.status).toBe('unsolvable');
    expect(incomplete.status).toBe('partial');
    expect(incomplete.bom).toBeNull();

    const complete = runConfiguration(items, emptyProfile, { isComplete: true });
    expect(complete.status).toBe('unsolvable');
    expect(complete.sceneSolution.status).toBe('unsolvable');
    expect(complete.bom).toBeNull();
  });

  it('uses complete only when the profile is finished and the scene is solved', () => {
    const items = ['desk_frame', 'desk_top', 'monitor_arm', 'monitor'];
    const incomplete = runConfiguration(items, emptyProfile, { isComplete: false });
    expect(incomplete.status).toBe('partial');
    expect(incomplete.sceneSolution.status).toBe('solved');
    expect(incomplete.bom).not.toBeNull();

    const complete = runConfiguration(items, emptyProfile, { isComplete: true });
    expect(complete.status).toBe('complete');
    expect(complete.sceneSolution.status).toBe('solved');
    expect(complete.bom).not.toBeNull();
  });
});
