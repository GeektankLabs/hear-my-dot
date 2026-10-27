(() => {
  const controller = createHearMyDotMediaController({
    media: () => document.querySelectorAll('audio, video'),
    page: () => location.href,
    label: 'Podverse',
    requireMedia: true,
    warn: message => console.warn('Hear My Dot:', message)
  });
  let lastHandled;
  function notify() {
    const { handled } = controller.status();
    if (handled === lastHandled) return;
    lastHandled = handled;
    // Wake the worker when a late player appears or pause control fails.
    chrome.runtime.sendMessage({ type: 'hear-my-dot-podverse-ready' }).catch(() => {});
  }
  function cancel() { controller.cancel(); notify(); }
  for (const type of ['pointerdown', 'keydown']) {
    document.addEventListener(type, event => { if (event.isTrusted) cancel(); }, true);
  }
  for (const type of ['play', 'playing', 'seeking', 'ratechange', 'volumechange', 'emptied', 'loadedmetadata', 'ended']) {
    document.addEventListener(type, event => {
      if (!(event.target instanceof HTMLMediaElement)) return;
      controller.mediaChanged(event.target, type);
      notify();
    }, true);
  }
  for (const type of ['popstate', 'hashchange']) window.addEventListener(type, cancel);
  new MutationObserver(() => { controller.refresh(); notify(); }).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src']
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'hear-my-dot-podverse') return;
    respond(controller.sync(message));
    notify();
  });
  notify();
})();
