// Original shared controller for our isolated site adapters; no site code is used.
function createHearMyDotMediaController({ media, page, warn, label = 'YouTube', requireMedia = false }) {
  let active = false;
  let cycle = null;
  let cancelled = false;
  let failed = false;
  const owned = new Map();

  function cancel() {
    owned.clear();
    if (active) cancelled = true;
  }

  function valid(element, record) {
    return element.isConnected && element.currentSrc === record.source && page() === record.page;
  }

  function refresh() {
    if (!active || cancelled || failed) return;
    // A replacement/source/navigation change forfeits ownership for this cycle.
    for (const [element, record] of owned) {
      if (!valid(element, record) || !element.paused || element.ended) {
        cancel();
        return;
      }
    }
    for (const element of media()) {
      if (owned.has(element) || element.paused || element.ended || !element.currentSrc) continue;
      const record = { source: element.currentSrc, page: page() };
      owned.set(element, record);
      try {
        element.pause();
        if (!element.paused) throw new Error('Media did not pause');
      } catch {
        owned.delete(element);
        failed = true;
        warn(`${label} could not be paused; using the mute fallback.`);
        return;
      }
    }
  }

  function sync(next) {
    if (next.active) {
      if (!active || cycle !== next.cycle) {
        // Retain pauses across a worker's recovered/new cycle; never invent ownership.
        active = true;
        cycle = next.cycle;
        cancelled = false;
        failed = false;
      }
      refresh();
      return status();
    }
    active = false;
    cancelled = false;
    const resume = [...owned];
    owned.clear(); // Each owned pause gets at most one play attempt.
    for (const [element, record] of resume) {
      if (!valid(element, record) || !element.paused || element.ended) continue;
      try {
        Promise.resolve(element.play()).catch(() => {
          warn(`${label} blocked automatic playback. Resume the media manually.`);
        });
      } catch {
        warn(`${label} blocked automatic playback. Resume the media manually.`);
      }
    }
    failed = false;
    return status();
  }

  function mediaChanged(element, type) {
    if (owned.has(element)) {
      // pause is deliberately not observed: pause() itself emits that event.
      if (['play', 'playing', 'seeking', 'ratechange', 'volumechange', 'emptied', 'loadedmetadata', 'ended'].includes(type)) cancel();
    }
    refresh();
  }

  function status() {
    // A manual/source-change cancellation is an override, not a reason to mute.
    const elements = [...media()];
    const accessible = elements.length > 0 && elements.every(element =>
      element.isConnected && (element.paused || element.ended || Boolean(element.currentSrc)));
    return { handled: !failed && (!requireMedia || cancelled || accessible) };
  }

  return { sync, refresh, cancel, mediaChanged, status };
}
