# Hear My Dot

A small, independently written Chrome Manifest V3 prototype: when an unmuted tab on **chatgpt.com** reports audio activity, other tabs in the same Chrome profile are muted. All ChatGPT tabs are exempt, regardless of their URL path. After **20 seconds of silence**, configurable from 10 to 20 seconds, the extension restores only mute changes it made itself. Tabs that were already muted stay muted; manual changes take priority.

## Status and scope

A local proof of concept with isolated baseline tests. It has **not yet been installed or functionally tested in Chrome**. Repository: https://github.com/geco91/hear-my-dot — public source code under the MIT License, with publication explicitly authorized. There is no Chrome Web Store release, CI, Native Helper, microphone detection, pause/play control, audio recording, or cross-profile control.

`extension/` contains the loadable extension; `tests/` contains the small test suite. No package installation is required. From the repository root, run the eight baseline tests with Node.js:

```sh
node --test tests/core.test.mjs
```

## Architecture and limitations

- `tabs.onUpdated` and a fresh tab query detect audio activity. Chrome's `audible` flag indicates recently produced sound; it is **not speech recognition** and does not guarantee physically audible speaker output. An open call or granted microphone permission alone does not trigger muting. Any type of audio on chatgpt.com can trigger it; Chrome's own short trailing delay adds to the configured quiet period.
- The service worker serializes state changes. Each tab is read again before any mutation. State in `storage.session` survives worker restarts; `mutedInfo.extensionId` limits restoration to the extension's own changes and allows recovery after state loss. Closed tabs are removed from tracking, and discarded or frozen ChatGPT tabs do not count as active audio sources. Navigating to ChatGPT releases a mute applied by this extension.
- A timer and an alarm support restoration. **10–20 seconds is a target, not a real-time guarantee**: worker suspension, browser or device sleep, and alarm throttling can delay restoration. Chrome does not support an atomic combination of a tab query and a mute update; near-simultaneous manual changes remain a case for practical testing.
- Permissions: `storage`, `alarms`, and URL visibility only for `https://chatgpt.com/*`. No broad `tabs` read permission, content scripts, or network requests. Incognito mode is disabled. Settings are stored locally; audio, browsing history, and tab URLs are not stored.
- The original cross-profile idea has been deferred. It would require investigating coordinated extension instances and possibly a local Native Messaging broker. A helper alone does not gain access to Chrome tabs across profiles. That is beyond the scope of this proof of concept.

## Future manual test — only after approval

In a separate test profile, load `extension/` as an unpacked extension. Open two ChatGPT tabs and two other audio tabs; mute one of the other tabs beforehand. An open but silent call must not change anything. When ChatGPT produces audio, other tabs must be muted while both ChatGPT tabs remain exempt. Short pauses must not trigger restoration; after the quiet period, only the previously audible tab should be unmuted. Then test manual mute/unmute, new tabs, navigation, closing the audio source tab, worker restarts, and sleep/wake behavior. Before removing the extension, turn it off through its options and wait for restoration: a removed or browser-disabled extension can no longer run restoration code.

## Origin and license

Original, independently written code under the MIT License; see [LICENSE](LICENSE). Functional inspiration comes from [FrancisGregori/audio-tab-finder](https://github.com/FrancisGregori/audio-tab-finder). This is not a fork, and no code or assets were copied from that project. Its license was not used as a basis for reuse.

## Technical references

- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs): audio indicator, `MutedInfo`, and tab events.
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage): session state for service workers.
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms): delayed execution and device sleep.
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging): possible future coordination, not implemented here.
