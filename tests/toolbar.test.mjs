import test from 'node:test';
import assert from 'node:assert/strict';
import { toolbarState, updateToolbar } from '../extension/toolbar.mjs';
import { initial } from '../extension/core.mjs';
test('disabled, ready, active and quiet states have distinct accessible labels', () => {
  const state = initial();
  assert.equal(toolbarState(state, {enabled:false}).badge, 'OFF');
  assert.equal(toolbarState(state, {}).icon, 'ready');
  state.active = true; assert.equal(toolbarState(state, {}).badge, 'ON');
  state.quietSince = 100;
  const quiet = toolbarState(state, {quietSeconds:17});
  assert.equal(quiet.badge, 'WAIT'); assert.match(quiet.title, /17s target/);
  assert.doesNotMatch(quiet.title, /speaking|talking/);
});
test('pending restoration is visible even after focus was disabled', () => {
  const state = initial(); state.owned[2] = true;
  const view = toolbarState(state, {enabled:false});
  assert.equal(view.badge, 'WAIT'); assert.match(view.title, /restoration pending/);
});
test('toolbar uses static PNG paths and explicit high-contrast badge colors', async () => {
  const calls = {};
  const action = Object.fromEntries(['setIcon','setTitle','setBadgeText','setBadgeBackgroundColor','setBadgeTextColor'].map(name => [name, async args => { calls[name] = args; }]));
  await updateToolbar(action, initial(), {});
  assert.equal(calls.setIcon.path[16], 'icons/ready-16.png');
  assert.equal(calls.setBadgeText.text, '');
  assert.equal(calls.setBadgeTextColor.color, '#ffffff');
  assert.equal(calls.setBadgeBackgroundColor.color, '#10283f');
});
