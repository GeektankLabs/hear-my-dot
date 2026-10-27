import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { initial, reconcile, delaySeconds, youtube } from '../extension/core.mjs';
const create = vm.runInNewContext(readFileSync(new URL('../extension/youtube-controller.js', import.meta.url), 'utf8') + '\ncreateHearMyDotYouTubeController;');
function fixture({ paused = false, reject = false } = {}) {
  const warnings = [];
  const video = {
    paused, ended: false, isConnected: true, currentSrc: 'blob:first', pauses: 0, plays: 0,
    pause() { this.paused = true; this.pauses++; },
    play() { this.plays++; if (reject) return Promise.reject(new Error('NotAllowedError')); this.paused = false; return Promise.resolve(); }
  };
  const env = { list: [video], url: 'https://www.youtube.com/watch?v=first' };
  const controller = create({ videos: () => env.list, page: () => env.url, warn: message => warnings.push(message) });
  const focus = () => controller.sync({ active: true, cycle: 1 });
  const release = () => controller.sync({ active: false, cycle: 1 });
  return { video, env, controller, warnings, focus, release };
}
test('pause running video once and resume owned playback once', () => {
  const f = fixture(); f.focus(); f.focus();
  assert.equal(f.video.pauses, 1); assert.equal(f.video.paused, true);
  f.release(); f.release(); assert.equal(f.video.plays, 1);
});
test('pre-paused and ended videos are never resumed', () => {
  for (const ended of [false, true]) {
    const f = fixture({ paused: !ended }); f.video.ended = ended;
    f.focus(); f.release(); assert.equal(f.video.pauses, 0); assert.equal(f.video.plays, 0);
  }
});
test('manual interaction cancels ownership and suppresses repeated pause for the cycle', () => {
  const f = fixture(); f.focus(); f.controller.cancel();
  f.video.paused = false; f.focus(); f.release();
  assert.equal(f.video.pauses, 1); assert.equal(f.video.plays, 0);
  f.controller.sync({ active: true, cycle: 2 }); assert.equal(f.video.pauses, 2);
});
test('manual playback, seek and media changes cancel automatic resume', () => {
  for (const type of ['play', 'playing', 'seeking', 'ratechange', 'volumechange', 'emptied', 'loadedmetadata', 'ended']) {
    const f = fixture(); f.focus(); f.controller.mediaChanged(f.video, type); f.focus(); f.release();
    assert.equal(f.video.plays, 0, type);
  }
});
test('navigation, source changes and removed video cannot resume stale playback', () => {
  for (const change of [f => { f.env.url += '2'; }, f => { f.video.currentSrc = 'blob:second'; }, f => { f.video.isConnected = false; }]) {
    const f = fixture(); f.focus(); change(f); f.release(); assert.equal(f.video.plays, 0);
  }
});
test('replacement during focus cancels the cycle rather than controlling the next video', () => {
  const f = fixture(); f.focus(); f.video.isConnected = false;
  const replacement = fixture().video; f.env.list = [replacement];
  f.controller.refresh(); f.focus(); f.release();
  assert.equal(replacement.pauses, 0); assert.equal(f.video.plays, 0);
});
test('navigation away and back remains cancelled', () => {
  const f = fixture(); f.focus(); f.controller.cancel(); f.focus(); f.release();
  assert.equal(f.video.plays, 0);
});
test('play rejection is caught, reported and never retried', async () => {
  const f = fixture({ reject: true }); f.focus(); f.release();
  await new Promise(resolve => setImmediate(resolve)); f.release();
  assert.equal(f.video.plays, 1); assert.equal(f.video.paused, true); assert.equal(f.warnings.length, 1);
});
test('synchronous play failure and pause failure are handled without ownership leaks', () => {
  const f = fixture(); f.focus(); f.video.play = () => { throw Error('blocked'); }; f.release();
  assert.equal(f.warnings.length, 1);
  const g = fixture(); g.video.pause = () => { throw Error('failed'); }; g.focus(); g.release();
  assert.equal(g.warnings.length, 1); assert.equal(g.video.plays, 0);
});
test('newly started video is paused during focus; repeated inactive sync does not play it', () => {
  const f = fixture({ paused: true }); f.focus(); f.video.paused = false;
  f.controller.mediaChanged(f.video, 'play'); assert.equal(f.video.pauses, 1);
  f.release(); f.release(); assert.equal(f.video.plays, 1);
});
test('pause ownership survives worker re-sync but is not invented after content reload', () => {
  const f = fixture(); f.focus(); f.controller.sync({ active: true, cycle: 2 }); f.release();
  assert.equal(f.video.plays, 1);
  const g = fixture({ paused: true }); g.release(); assert.equal(g.video.plays, 0);
});
test('YouTube host scope is exact and ten-second default preserves custom values', () => {
  assert.equal(delaySeconds(undefined), 10); assert.equal(delaySeconds(17), 17); assert.equal(delaySeconds(20), 20);
  for (const host of ['youtube.com', 'www.youtube.com', 'm.youtube.com']) assert.equal(youtube({ url: `https://${host}/watch?v=x` }), true);
  for (const url of ['https://youtube.com.evil.example/', 'https://music.youtube.com/', 'https://youtu.be/x', 'http://www.youtube.com/']) assert.equal(youtube({ url }), false);
});
function browserFixture({ available = true, settings = {} } = {}) {
  const f = fixture();
  const tabs = new Map([
    [1, { id: 1, url: 'https://chatgpt.com/', audible: true, mutedInfo: { muted: false } }],
    [2, { id: 2, url: 'https://www.youtube.com/watch?v=first', mutedInfo: { muted: false } }],
    [3, { id: 3, url: 'https://example.com/', mutedInfo: { muted: false } }]
  ]);
  const api = { runtime: { id: 'self' }, storage: { session: { set: async () => {} } }, tabs: {
    query: async () => [...tabs.values()], get: async id => tabs.get(id),
    update: async (id, { muted }) => { tabs.get(id).mutedInfo = { muted, extensionId: 'self' }; },
    sendMessage: async (_id, message) => { if (!available) throw Error('no receiver'); f.controller.sync(message); return { handled: true }; }
  } };
  const state = initial();
  return { ...f, tabs, state, run: now => reconcile(api, state, settings, now), settings };
}
test('integration: YouTube pauses, other sites mute, renewed audio cancels release', async () => {
  const f = browserFixture(); await f.run(0);
  assert.equal(f.video.paused, true); assert.equal(f.tabs.get(2).mutedInfo.muted, false); assert.equal(f.tabs.get(3).mutedInfo.muted, true);
  f.tabs.get(1).audible = false; assert.equal(await f.run(100), 10100);
  await f.run(10099); assert.equal(f.video.plays, 0);
  f.tabs.get(1).audible = true; await f.run(10100); assert.equal(f.video.plays, 0);
  f.tabs.get(1).audible = false; await f.run(10200); await f.run(20200);
  assert.equal(f.video.plays, 1); assert.equal(f.tabs.get(3).mutedInfo.muted, false);
});
test('integration: disabling releases owned pause immediately and keeps saved delay', async () => {
  const f = browserFixture({ settings: { quietSeconds: 17 } }); await f.run(0);
  f.tabs.get(1).audible = false; assert.equal(await f.run(100), 17100);
  f.settings.enabled = false; await f.run(101); assert.equal(f.video.plays, 1); assert.equal(f.settings.quietSeconds, 17);
});
test('integration: missing YouTube content script uses existing mute/restore fallback', async () => {
  const f = browserFixture({ available: false }); await f.run(0);
  assert.equal(f.tabs.get(2).mutedInfo.muted, true); assert.equal(f.video.pauses, 0);
  f.settings.enabled = false; await f.run(1); assert.equal(f.tabs.get(2).mutedInfo.muted, false);
});
