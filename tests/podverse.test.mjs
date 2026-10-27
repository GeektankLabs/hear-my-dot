import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { initial, podverse, reconcile } from '../extension/core.mjs';

// Execute the actual isolated-world adapter against a small DOM/API double.
function fixture({ paused = false, missing = false, pauseFails = false, playFails = false } = {}) {
  class Media {
    paused = paused; ended = false; isConnected = true; currentSrc = 'https://media.example/episode.mp3';
    pauses = 0; plays = 0;
    pause() { this.pauses++; if (pauseFails) throw Error('pause unavailable'); this.paused = true; }
    play() { this.plays++; if (playFails) return Promise.reject(Error('autoplay denied')); this.paused = false; return Promise.resolve(); }
  }
  const audio = new Media();
  const page = { href: 'https://podverse.fm/episode/first' };
  const elements = missing ? [] : [audio];
  const listeners = new Map(); const warnings = []; const notifications = [];
  let receive; let mutation;
  const context = vm.createContext({
    HTMLMediaElement: Media, location: page, console: { warn: (...args) => warnings.push(args) },
    document: {
      querySelectorAll: selector => { assert.equal(selector, 'audio, video'); return elements; },
      addEventListener: (type, fn) => listeners.set(type, fn)
    },
    window: { addEventListener: (type, fn) => listeners.set(type, fn) },
    MutationObserver: class { constructor(fn) { mutation = fn; } observe() {} },
    chrome: { runtime: {
      onMessage: { addListener: fn => { receive = fn; } },
      sendMessage: async message => { notifications.push(message); }
    } }
  });
  for (const file of ['media-controller.js', 'podverse.js']) vm.runInContext(readFileSync(new URL(`../extension/${file}`, import.meta.url), 'utf8'), context);
  function message(active, cycle = 1) {
    let response;
    receive({ type: 'hear-my-dot-podverse', active, cycle }, {}, value => { response = value; });
    return response;
  }
  return { audio, page, elements, warnings, notifications, message, mutation: () => mutation(),
    event: (type, extra = {}) => listeners.get(type)?.({ target: audio, isTrusted: true, ...extra }) };
}
test('Podverse adapter pauses/resumes running audio once and never starts pre-paused audio', () => {
  const f = fixture(); assert.equal(f.message(true).handled, true); f.message(true);
  assert.equal(f.audio.pauses, 1); f.message(false); f.message(false); assert.equal(f.audio.plays, 1);
  const g = fixture({ paused: true }); g.message(true); g.message(false); assert.equal(g.audio.plays, 0);
});
test('Podverse trusted controls cancel ownership; synthetic pointer events do not', () => {
  for (const type of ['pointerdown', 'keydown', 'seeking', 'volumechange', 'ratechange', 'play', 'playing']) {
    const f = fixture(); f.message(true); f.event(type); f.message(true); f.message(false);
    assert.equal(f.audio.plays, 0, type);
  }
  const f = fixture(); f.message(true); f.event('pointerdown', { isTrusted: false }); f.message(false);
  assert.equal(f.audio.plays, 1);
});
test('Podverse source/episode change, removal and history navigation forfeit resume', () => {
  for (const change of [
    f => { f.audio.currentSrc = 'https://media.example/next.mp3'; },
    f => { f.page.href = 'https://podverse.fm/episode/next'; },
    f => { f.audio.isConnected = false; },
    f => { f.event('popstate'); },
    f => { f.event('emptied'); }
  ]) {
    const f = fixture(); f.message(true); change(f); f.mutation(); f.message(false);
    assert.equal(f.audio.plays, 0);
  }
});
test('Podverse absent/unsupported media and pause failure request mute fallback', () => {
  const absent = fixture({ missing: true }); assert.equal(absent.message(true).handled, false);
  const unknown = fixture(); unknown.audio.currentSrc = ''; assert.equal(unknown.message(true).handled, false);
  const failed = fixture({ pauseFails: true }); assert.equal(failed.message(true).handled, false);
  assert.equal(failed.message(true).handled, false); failed.message(false);
  assert.equal(failed.audio.plays, 0); assert.equal(failed.warnings.length, 1);
});
test('Podverse late player wakes worker and pauses before fallback mute is removed', () => {
  const f = fixture({ missing: true }); f.message(true); const before = f.notifications.length;
  f.elements.push(f.audio); f.mutation();
  assert.equal(f.audio.paused, true); assert.equal(f.notifications.length, before + 1);
  assert.equal(f.message(true).handled, true); f.message(false); assert.equal(f.audio.plays, 1);
});
test('Podverse rejected play is reported once without unhandled rejection or retry', async () => {
  const f = fixture({ playFails: true }); f.message(true); f.message(false);
  await new Promise(resolve => setImmediate(resolve)); f.message(false);
  assert.equal(f.audio.plays, 1); assert.equal(f.audio.paused, true); assert.equal(f.warnings.length, 1);
});
test('Podverse host permissions do not extend to other protocols, subdomains or lookalikes', () => {
  assert.equal(podverse({ url: 'https://podverse.fm/episode/x' }), true);
  for (const url of ['http://podverse.fm/', 'https://podverse.fm.evil.example/', 'https://api.podverse.fm/', 'https://www.podverse.fm/']) assert.equal(podverse({ url }), false);
});
test('Podverse integration preserves output-audio trigger, quiet delay and unrelated mute behavior', async () => {
  const f = fixture();
  const tabs = new Map([
    [1, { id: 1, url: 'https://chatgpt.com/c/a', audible: true, mutedInfo: { muted: false } }],
    [2, { id: 2, url: f.page.href, mutedInfo: { muted: false } }],
    [3, { id: 3, url: 'https://example.com/', mutedInfo: { muted: false } }]
  ]);
  const api = { runtime: { id: 'self' }, storage: { session: { set: async () => {} } }, tabs: {
    query: async () => [...tabs.values()], get: async id => tabs.get(id),
    sendMessage: async (_id, message, options) => {
      assert.equal(message.type, 'hear-my-dot-podverse'); assert.equal(options.frameId, 0);
      return f.message(message.active, message.cycle);
    },
    update: async (id, { muted }) => { tabs.get(id).mutedInfo = { muted, extensionId: 'self' }; }
  } };
  const state = initial();
  await reconcile(api, state, {}, 0);
  assert.equal(f.audio.paused, true); assert.equal(tabs.get(2).mutedInfo.muted, false); assert.equal(tabs.get(3).mutedInfo.muted, true);
  tabs.get(1).audible = false;
  assert.equal(await reconcile(api, state, {}, 100), 10100);
  await reconcile(api, state, {}, 10099); assert.equal(f.audio.plays, 0);
  await reconcile(api, state, {}, 10100); assert.equal(f.audio.plays, 1); assert.equal(tabs.get(3).mutedInfo.muted, false);
});
test('Podverse integration mutes on adapter refusal and restores only its own mute', async () => {
  const tabs = [{ id: 1, url: 'https://chatgpt.com/', audible: true, mutedInfo: { muted: false } },
    { id: 2, url: 'https://podverse.fm/', mutedInfo: { muted: false } }];
  const api = { runtime: { id: 'self' }, storage: { session: { set: async () => {} } }, tabs: {
    query: async () => tabs, get: async id => tabs[id - 1], sendMessage: async () => ({ handled: false }),
    update: async (id, { muted }) => { tabs[id - 1].mutedInfo = { muted, extensionId: 'self' }; }
  } };
  const state = initial(); await reconcile(api, state, {}, 0); assert.equal(tabs[1].mutedInfo.muted, true);
  await reconcile(api, state, { enabled: false }, 1); assert.equal(tabs[1].mutedInfo.muted, false);
});
test('partial pause failure retains ownership of media already paused successfully', () => {
  const f = fixture();
  const failing = Object.assign(Object.create(Object.getPrototypeOf(f.audio)), {
    paused: false, ended: false, isConnected: true, currentSrc: 'https://media.example/other.mp3',
    pause() { throw Error('failed'); }
  });
  f.elements.push(failing);
  assert.equal(f.message(true).handled, false); assert.equal(f.audio.paused, true);
  f.message(false); assert.equal(f.audio.plays, 1);
});
