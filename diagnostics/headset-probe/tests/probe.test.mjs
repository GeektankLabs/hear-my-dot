import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root)));
function fixture() {
  let commandHandler, messageHandler, clickHandler;
  const notifications = [], opened = [];
  const chrome = {
    runtime: { id: 'probe', getURL: path => 'chrome-extension://probe/' + path,
      sendMessage: async message => { notifications.push(message); },
      onMessage: { addListener: fn => { messageHandler = fn; } } },
    commands: { onCommand: { addListener: fn => { commandHandler = fn; } } },
    action: { onClicked: { addListener: fn => { clickHandler = fn; } } },
    tabs: { create: async args => { opened.push(args); } }
  };
  vm.runInNewContext(fs.readFileSync(new URL('background.js', root), 'utf8'), {
    chrome, crypto: { randomUUID: () => 'test-session' }, Date, console
  });
  return { notifications, opened, command: name => commandHandler(name), click: () => clickHandler(),
    message: (type, id = 'probe') => { let result; messageHandler({type}, {id}, value => {result = value;}); return result; } };
}
test('probe is opt-in, unbound and has no permission, host, content-script or global access', () => {
  assert.equal(manifest.permissions, undefined); assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined); assert.equal(manifest.externally_connectable, undefined);
  assert.equal(Object.keys(manifest.commands).length, 4);
  for (const command of Object.values(manifest.commands)) {
    assert.equal(command.suggested_key, undefined); assert.equal(command.global, undefined);
  }
});
test('action opens only the diagnostic page', () => {
  const f = fixture(); f.click();
  assert.equal(f.opened.length, 1); assert.equal(f.opened[0].url, 'chrome-extension://probe/index.html');
});
test('each supported command is logged without any media API calls', () => {
  const f = fixture();
  for (const name of Object.keys(manifest.commands)) f.command(name);
  assert.equal(f.notifications.length, 4);
  assert.deepEqual(f.notifications.map(x => x.entry.command), Object.keys(manifest.commands));
  assert.equal(new Set(f.notifications.map(x => x.entry.id)).size, 4);
  assert.ok(f.notifications.every(x => Number.isFinite(x.entry.receivedAt)));
  f.command('unrelated'); assert.equal(f.notifications.length, 4);
});
test('history is bounded, clearable and accessible only to this extension', () => {
  const f = fixture();
  for (let i = 0; i < 110; i++) f.command('probe-play-pause');
  assert.equal(f.message('probe-snapshot').entries.length, 100);
  assert.equal(f.message('probe-clear', 'other'), undefined);
  assert.equal(f.message('probe-snapshot').entries.length, 100);
  assert.equal(f.message('probe-clear').cleared, true);
  assert.equal(f.message('probe-snapshot').entries.length, 0);
});
