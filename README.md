# Hear My Dot

A small, independently written Chrome Manifest V3 prototype: when an unmuted tab on **chatgpt.com** reports audio activity, playing YouTube videos and Podverse media in the same Chrome profile are paused and other tabs are muted. All ChatGPT tabs are exempt, regardless of their URL path. After **10 seconds of silence**, configurable from 10 to 20 seconds, the extension resumes only videos it paused itself and restores only its own mute changes. Saved custom quiet-period values are preserved when updating. Tabs that were already muted stay muted; manual changes take priority.

## Status and scope

A local proof of concept with isolated baseline tests. It has **not yet been installed or functionally tested in Chrome**. Repository: https://github.com/geco91/hear-my-dot — public source code under the MIT License, with publication explicitly authorized. There is no Chrome Web Store release, CI, Native Helper, microphone detection, audio recording, or cross-profile control. Pause/resume support is limited to YouTube and Podverse.

`extension/` contains the loadable extension; `tests/` contains the small test suite. No package installation is required. From the repository root, run the baseline and media-adapter/controller/integration tests with Node.js:

```sh
node --test tests/*.test.mjs
```

## YouTube pause/resume

Supported top-level pages are `https://youtube.com/*`, `https://www.youtube.com/*`, and `https://m.youtube.com/*`. The extension pauses currently playing HTML video elements, including videos that start during the focus period. Already paused or ended videos are never automatically started. Other sites, YouTube embeds on other sites, and YouTube Music keep the existing mute/restore behavior.

Only the same still-paused video element, media source, and page can be resumed. Manual playback, seeking, volume/rate changes, navigation, or replacing the video cancels automatic restoration. As a conservative safeguard, any direct click/touch or keypress on the YouTube page cancels pause ownership and further automatic pauses for the current focus period. A cancelled video may therefore remain paused; resume it manually. Site-generated playback/media changes can also cancel restoration.

A rejected `play()` call is caught and logged as a warning in the YouTube page's console. There is no automatic retry; resume manually if Chrome blocks playback. Pause ownership lives in the page's isolated content script and survives service-worker restarts, but not a page or extension reload. After a reload, a paused video is never assumed to belong to the extension. YouTube ads, live streams, Shorts, player changes, and browser suspension still need real-browser testing.

## Podverse pause/resume

Version 0.3.0 adds a small, independently written adapter for top-level `https://podverse.fm/*` pages. It uses standard HTML `audio` and `video` elements and the same ownership safeguards as the YouTube adapter. Only media that was playing and successfully paused by this extension can be resumed. Previously paused media stays paused. Direct page interactions, seeking, media changes, episode/source replacement, and navigation forfeit automatic resume for the current focus period. A rejected `play()` is caught and reported in the page console without retrying.

If the content script is unavailable, no accessible media element is found, or pausing fails, the existing tab mute/restore behavior is used. When a player appears later, the adapter wakes the worker to reassess the fallback. Manual/source-change cancellation is respected as an override; it does not trigger fallback muting of the user's new playback. This adapter does not control cross-origin frames, closed shadow roots, detached players, Web Audio-only playback, subdomains, or other profiles.

Official sources reviewed: [Podverse's web-app description](https://github.com/podverse/podverse-web) documents audio, video and livestream playback; [Podverse About](https://podverse.fm/about) describes the service. The repository identifies its own license as AGPL-3.0. No Podverse implementation code or assets were copied or bundled; this extension's original adapter uses standard browser media APIs. The deployed player DOM and end-to-end playback have **not** been verified in Chrome. A deeper source-tree API inspection was unavailable in this environment, so this is a guarded adapter with a mute fallback, not a claim of complete Podverse compatibility.

## Updating to 0.3.0

1. Before reloading an older version, disable focus through the extension's options and wait for its changes to be restored.
2. Run `git pull --ff-only` in your local repository to update the files, then reload the unpacked extension in `chrome://extensions`. Review any Chrome permission prompt yourself. Version 0.3.0 adds access to **podverse.fm** for its pause/resume content script. Version 0.2.0 already added **youtube.com, www.youtube.com, and m.youtube.com**. These permissions identify the supported tabs and allow their media elements to be controlled. It does not add the `scripting` or broad `tabs` permission.
3. Refresh existing YouTube and Podverse tabs to load the new content scripts. Until a script can respond, the extension uses the original mute/restore fallback for that tab.
4. Re-enable focus in the options. The default is now ten seconds when no value has been saved; an explicitly saved value such as twenty seconds remains unchanged. You can change it in the options.

The local unpacked extension does not update automatically. No browser installation or permission acceptance has been performed on your behalf.

## Architecture and limitations

- `tabs.onUpdated` and a fresh tab query detect audio activity. Chrome's `audible` flag indicates recently produced sound; it is **not speech recognition** and does not guarantee physically audible speaker output. An open call or granted microphone permission alone does not trigger muting. Any type of audio on chatgpt.com can trigger it; Chrome's own short trailing delay adds to the configured quiet period.
- The service worker serializes state changes. Each tab is read again before any mutation. State in `storage.session` survives worker restarts; `mutedInfo.extensionId` limits restoration to the extension's own changes and allows recovery after state loss. Closed tabs are removed from tracking, and discarded or frozen ChatGPT tabs do not count as active audio sources. Navigating to ChatGPT releases a mute applied by this extension.
- A timer and an alarm support restoration. **10–20 seconds is a target, not a real-time guarantee**: worker suspension, browser or device sleep, and alarm throttling can delay restoration. Chrome does not support an atomic combination of a tab query and a mute update; near-simultaneous manual changes remain a case for practical testing.
- Permissions: `storage`, `alarms`, and URL visibility for `https://chatgpt.com/*`. YouTube and Podverse host access and top-frame content scripts are also declared for the hosts listed above. No broad `tabs` read permission or extension-initiated network requests. Incognito mode is disabled. Settings are stored locally; audio and browsing history are not stored, and tab/media URLs are not persisted. Each media controller retains the current page and media source in memory only while it owns a pause.
- The original cross-profile idea has been deferred. It would require investigating coordinated extension instances and possibly a local Native Messaging broker. A helper alone does not gain access to Chrome tabs across profiles. That is beyond the scope of this proof of concept.

## Future manual test — only after approval

In a separate test profile, load `extension/` as an unpacked extension. Open two ChatGPT tabs and two other audio tabs; mute one of the other tabs beforehand. An open but silent call must not change anything. When ChatGPT produces audio, other tabs outside the supported media adapters must be muted while both ChatGPT tabs remain exempt. Short pauses must not trigger restoration; after the quiet period, only the previously audible tab should be unmuted. Then test manual mute/unmute, new tabs, navigation, closing the audio source tab, worker restarts, and sleep/wake behavior. Also test YouTube: a playing video should pause and resume after the quiet period, while a previously paused video stays paused. During focus, try manual play/pause, seeking, keyboard/media controls, navigation to another video, replacing the player, and switching away and back. Verify cancellation, a blocked autoplay attempt, repeated ChatGPT audio, saved custom delays, and the mute fallback before refreshing an existing YouTube tab. For Podverse, repeat these checks with a playing episode and an already-paused episode, episode/source changes, player replacement, a late-loading player, playback denial, and a missing/uncontrollable player using mute fallback. Before removing the extension, turn it off through its options and wait for restoration: a removed or browser-disabled extension can no longer run restoration code.

## Origin and license

Original, independently written code under the MIT License; see [LICENSE](LICENSE). Functional inspiration comes from [FrancisGregori/audio-tab-finder](https://github.com/FrancisGregori/audio-tab-finder). This is not a fork, and no code or assets were copied from that project. Its license was not used as a basis for reuse.

## Technical references

- [Chrome Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs): audio indicator, `MutedInfo`, and tab events.
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage): session state for service workers.
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms): delayed execution and device sleep.
- [Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging): possible future coordination, not implemented here.

- [Chrome Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts): isolated execution and static content-script declarations.
