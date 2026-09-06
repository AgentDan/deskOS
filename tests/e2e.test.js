const fs = require('fs');
const http = require('http');
const path = require('path');
const { createApp } = require('../api/server');
const { loadProfile } = require('../profile/customerProfile');
const solver = require('../core/solver');
const bom = require('../core/bom');

const QUESTIONS = {
  monitors: 'Сколько мониторов планируете?',
};

function expectVat(bomResult) {
  expect(bomResult.vatEur).toBe(bomResult.subtotalEur * 0.2);
  expect(bomResult.totalEur).toBe(bomResult.subtotalEur + bomResult.vatEur);
  expect(bomResult.totalEur).not.toBe(bomResult.subtotalEur);
}

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

describe('end-to-end session', () => {
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
    const profilesDir = path.join(__dirname, '..', 'profiles');
    while (createdIds.length > 0) {
      const id = createdIds.pop();
      const filePath = path.join(profilesDir, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  async function post(urlPath, body) {
    return request(port, 'POST', urlPath, body);
  }

  it('runs the full dialog through to a priced 3D scene', async () => {
    const started = await post('/api/session/start');
    expect(started.status).toBe(200);
    expect(started.json.nextQuestion).toBe(QUESTIONS.monitors);
    const profileId = started.json.profileId;
    createdIds.push(profileId);

    const finished = await post('/api/session/message', {
      profileId,
      text: 'два монитора',
    });

    expect(finished.status).toBe(200);
    expect(finished.json.nextQuestion).toBeNull();
    expect(finished.json.sceneSolution.status).toBe('solved');
    expect(finished.json.bom.totalEur).toBeGreaterThan(0);
    expectVat(finished.json.bom);
  });

  it('keeps the hot path free of LLM inputs', () => {
    const files = [
      'dialog/intentLayer.js',
      'dialog/scenario.js',
      'dialog/profileToItems.js',
      'core/compatibility.js',
      'core/solver.js',
      'core/bom.js',
      'api/routes.js',
    ].map((relative) =>
      fs.readFileSync(path.join(__dirname, '..', relative), 'utf8')
    );

    for (const source of files) {
      expect(source).not.toMatch(/openai|anthropic|chatgpt|\bLLM\b|gpt-4/i);
      expect(source).not.toMatch(/fetch\(\s*['"]https:\/\/api\./);
    }

    const processMessage = require('../dialog/scenario').processMessage;
    const parseIntent = require('../dialog/intentLayer').parseIntent;
    const buildItemsFromProfile = require('../dialog/profileToItems').buildItemsFromProfile;

    expect(processMessage.length).toBe(2);
    expect(parseIntent.length).toBeGreaterThanOrEqual(1);
    expect(buildItemsFromProfile.length).toBeGreaterThanOrEqual(1);
  });

  it('returns 200 with conflicts for a physically impossible update', async () => {
    const started = await post('/api/session/start');
    const profileId = started.json.profileId;
    createdIds.push(profileId);

    const solveSpy = jest.spyOn(solver, 'solve');
    const bomSpy = jest.spyOn(bom, 'calculateBOM');

    const updated = await post('/api/session/update', {
      profileId,
      items: ['monitor'],
    });

    expect(updated.status).toBe(200);
    expect(updated.json.compatibilityResult.valid).toBe(false);
    expect(
      updated.json.sceneSolution == null ||
        updated.json.sceneSolution.status === 'unsolvable'
    ).toBe(true);
    expect(solveSpy).not.toHaveBeenCalled();
    expect(bomSpy).not.toHaveBeenCalled();

    solveSpy.mockRestore();
    bomSpy.mockRestore();
  });

  it('persists profile history after the full scenario', async () => {
    const started = await post('/api/session/start');
    const profileId = started.json.profileId;
    createdIds.push(profileId);

    const finished = await post('/api/session/message', {
      profileId,
      text: 'два монитора',
    });
    expectVat(finished.json.bom);

    const stored = loadProfile(profileId);
    expect(stored.history.length).toBeGreaterThan(0);
    expect(Date.parse(stored.updatedAt)).toBeGreaterThan(Date.parse(stored.createdAt));
  });

  it('reads coordinates only from sceneSolution.placements', () => {
    const rendererSrc = fs.readFileSync(
      path.join(__dirname, '..', 'renderer', 'scene3d.js'),
      'utf8'
    );

    expect(rendererSrc).toMatch(/placement\.position/);
    expect(rendererSrc).not.toMatch(/assertCompatible/);
    expect(rendererSrc).not.toMatch(/\bsolve\s*\(/);
    expect(rendererSrc).not.toMatch(/calculateBOM/);
  });
});
