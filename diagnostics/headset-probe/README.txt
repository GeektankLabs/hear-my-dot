LOCAL HEADSET COMMAND PROBE — 0.0.1

Separate diagnostic extension, not a Hear My Dot feature release.
No permissions, host permissions, content scripts, default shortcuts, global shortcuts,
media control, microphone access, network requests, or persistent storage.

Manual test (not performed by the agent):
1. Open chrome://extensions, enable Developer mode if desired, and Load unpacked
   with this folder. This is an opt-in local install; do not replace Hear My Dot.
2. Click the probe's extension action to open its diagnostic page.
3. Verify that all four commands are UNBOUND initially.
4. Open chrome://extensions/shortcuts. Manually assign one intended media key
   to the matching probe command, if Chrome accepts it. Keep scope In Chrome.
   The probe never changes bindings. A binding may consume the normal player key.
5. Refresh actual bindings on the probe page. Empty does not distinguish deliberate
   unbinding from conflicts. No other application's bindings are inspected.
6. With Chrome focused, try one press, a double press, and a long press on the
   actual headset. Leave several seconds between tests; note the physical gesture.
   Record received commands, their count/gaps, and any normal player reaction.
7. Optionally repeat with a media tab playing and paused, then with Chrome not
   focused, explicitly recording that the scope remains In Chrome. No receipt
   is not proof of unsupported hardware. Do not turn on global scope for this test.
8. Remove all probe bindings, remove the diagnostic extension, and verify normal
   player controls return. No system-wide helper is required.

API boundary: commands.onCommand yields a command name (and sometimes a tab),
not raw keydown/keyup, press duration, or headset identity. Receipt timestamps
cannot prove a physical double/long press. Supported key names are MediaPlayPause,
MediaNextTrack, MediaPrevTrack, MediaStop; modifiers are not supported with media keys.

Open diagnostic pages retain their own 100-event display until closed. Worker
history is volatile and can reset when suspended; this is not permanent logging.

Official sources checked:
https://developer.chrome.com/docs/extensions/reference/api/commands
https://developer.chrome.com/docs/extensions/reference/api/tabs

Published as a separate opt-in diagnostic. No real Chrome/headset test has been performed by the agent.
