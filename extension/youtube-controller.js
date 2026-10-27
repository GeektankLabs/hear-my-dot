// Runs only in the extension's isolated YouTube content-script world.
function createHearMyDotYouTubeController({ videos, page, warn }) {
  let active = false;
  let cycle = null;
  let cancelled = false;
  const owned = new Map();

  function cancel() {
    owned.clear();
    if (active) cancelled = true;
  }

  function valid(video, record) {
    return video.isConnected && video.currentSrc === record.source && page() === record.page;
  }

  function refresh() {
    if (!active || cancelled) return;
    // A replacement/source/navigation change forfeits ownership for this cycle.
    for (const [video, record] of owned) {
      if (!valid(video, record) || !video.paused || video.ended) {
        cancel();
        return;
      }
    }
    for (const video of videos()) {
      if (owned.has(video) || video.paused || video.ended || !video.currentSrc) continue;
      const record = { source: video.currentSrc, page: page() };
      owned.set(video, record);
      try {
        video.pause();
        if (!video.paused) throw new Error('Video did not pause');
      } catch {
        cancel();
        warn('YouTube could not be paused; no automatic resume will be attempted.');
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
      }
      refresh();
      return;
    }
    active = false;
    cancelled = false;
    const resume = [...owned];
    owned.clear(); // Each owned pause gets at most one play attempt.
    for (const [video, record] of resume) {
      if (!valid(video, record) || !video.paused || video.ended) continue;
      try {
        Promise.resolve(video.play()).catch(() => {
          warn('YouTube blocked automatic playback. Resume the video manually.');
        });
      } catch {
        warn('YouTube blocked automatic playback. Resume the video manually.');
      }
    }
  }

  function mediaChanged(video, type) {
    if (owned.has(video)) {
      // pause is deliberately not observed: pause() itself emits that event.
      if (['play', 'playing', 'seeking', 'ratechange', 'volumechange', 'emptied', 'loadedmetadata', 'ended'].includes(type)) cancel();
    }
    refresh();
  }

  return { sync, refresh, cancel, mediaChanged };
}
