(() => {
  const controller = createHearMyDotMediaController({
    media: () => document.querySelectorAll('video'),
    page: () => location.href,
    warn: message => console.warn('Hear My Dot:', message)
  });
  // Conservatively give any direct interaction priority for the whole focus cycle.
  for (const type of ['pointerdown', 'keydown']) {
    document.addEventListener(type, event => {
      if (event.isTrusted) controller.cancel();
    }, true);
  }
  for (const type of ['play', 'playing', 'seeking', 'ratechange', 'volumechange', 'emptied', 'loadedmetadata', 'ended']) {
    document.addEventListener(type, event => {
      if (event.target instanceof HTMLVideoElement) controller.mediaChanged(event.target, type);
    }, true);
  }
  for (const type of ['yt-navigate-start', 'yt-navigate-finish']) document.addEventListener(type, controller.cancel, true);
  for (const type of ['popstate', 'hashchange']) window.addEventListener(type, controller.cancel);
  new MutationObserver(controller.refresh).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'hear-my-dot-youtube') return;
    respond(controller.sync(message));
  });
  chrome.runtime.sendMessage({ type: 'hear-my-dot-youtube-ready' }).catch(() => {});
})();
