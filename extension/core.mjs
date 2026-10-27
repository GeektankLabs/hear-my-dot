export const initial = () => ({ active: false, quietSince: null, owned: {}, exempt: {} });
export const delaySeconds = value => Math.min(20, Math.max(10, Number(value) || 10));
export function preferred(tab) {
  try { return new URL(tab.url).hostname === 'chatgpt.com'; } catch { return false; }
}
export function youtube(tab) {
  try {
    const url = new URL(tab.url);
    return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname);
  } catch { return false; }
}
export function podverse(tab) {
  try {
    const url = new URL(tab.url);
    return url.protocol === 'https:' && url.hostname === 'podverse.fm';
  } catch { return false; }
}
export function sounds(tab) {
  return preferred(tab) && tab.audible && !tab.discarded && !tab.frozen && !tab.mutedInfo?.muted;
}
export const ours = (tab, id) => tab.mutedInfo?.muted && tab.mutedInfo.extensionId === id;

// Called serially; persist intent before each browser mutation for worker recovery.
export async function reconcile(api, state, settings, now) {
  const tabs = await api.tabs.query({});
  const live = new Set(tabs.map(t => String(t.id)));
  for (const key of Object.keys(state.owned)) if (!live.has(key)) delete state.owned[key];
  for (const key of Object.keys(state.exempt)) if (!live.has(key)) delete state.exempt[key];
  const sounding = settings.enabled !== false && tabs.some(sounds);
  if (sounding) {
    if (!state.active) state.youtubeCycle = (state.youtubeCycle || 0) + 1;
    state.active = true;
    state.quietSince = null;
  } else if (state.active && state.quietSince === null) state.quietSince = now;
  const due = state.quietSince === null ? null : state.quietSince + delaySeconds(settings.quietSeconds) * 1000;
  const release = settings.enabled === false || (due !== null && now >= due);
  if (release) state.active = false;
  const save = () => api.storage.session.set({ focusState: state });
  for (const snapshot of tabs) {
    const key = String(snapshot.id);
    // Refetch immediately before acting: navigation/close/user mute may race the query.
    let tab;
    try { tab = await api.tabs.get(snapshot.id); } catch { delete state.owned[key]; continue; }
    let mediaHandled = false;
    const adapter = youtube(tab) ? 'youtube' : podverse(tab) ? 'podverse' : null;
    if (adapter) {
      try {
        const response = await api.tabs.sendMessage(tab.id, {
          type: `hear-my-dot-${adapter}`, active: state.active, cycle: state.youtubeCycle || 0
        }, { frameId: 0 });
        mediaHandled = response?.handled === true;
      } catch { /* Until the page is refreshed/accessible, use the existing mute fallback. */ }
    }
    // Recover an extension-owned mute after storage loss or browser restart.
    if (ours(tab, api.runtime.id)) state.owned[key] = true;
    if (key in state.owned && !ours(tab, api.runtime.id)) {
      delete state.owned[key]; state.exempt[key] = true;
    }
    if (key in state.owned && (!state.active || preferred(tab) || mediaHandled)) {
      if (ours(tab, api.runtime.id)) {
        try { await api.tabs.update(tab.id, { muted: false }); }
        catch { continue; } // Keep ownership for a later retry.
      }
      delete state.owned[key];
    } else if (state.active && !mediaHandled && !preferred(tab) && !tab.mutedInfo?.muted && !state.exempt[key]) {
      state.owned[key] = true;
      await save();
      try { await api.tabs.update(tab.id, { muted: true }); }
      catch { delete state.owned[key]; }
    }
  }
  if (!state.active) { state.quietSince = null; state.exempt = {}; }
  await save();
  if (!state.active && Object.keys(state.owned).length) return now + 10000;
  return state.active && due !== null ? due : null;
}
