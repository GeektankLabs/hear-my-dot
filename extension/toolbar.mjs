import { delaySeconds } from './core.mjs';

export function toolbarState(state, settings) {
  const restoring = !state.active && Object.keys(state.owned || {}).length > 0;
  if (restoring) return {
    icon: 'active', badge: 'WAIT',
    title: 'Hear My Dot — restoration pending; retrying our own mute changes.'
  };
  if (settings.enabled === false) return {
    icon: 'disabled', badge: 'OFF', title: 'Hear My Dot — disabled. Click to open options.'
  };
  if (state.active) return state.quietSince !== null ? {
    icon: 'active', badge: 'WAIT',
    title: `Hear My Dot — prioritization active during the quiet period (${delaySeconds(settings.quietSeconds)}s target). Waiting to restore our own changes.`
  } : {
    icon: 'active', badge: 'ON',
    title: 'Hear My Dot — prioritization active. Applies to eligible tabs; manual overrides take priority.'
  };
  return { icon: 'ready', badge: '', title: 'Hear My Dot — ready. Waiting for ChatGPT audio. Click to open options.' };
}

export async function updateToolbar(action, state, settings) {
  const view = toolbarState(state, settings);
  await Promise.all([
    action.setIcon({ path: Object.fromEntries([16, 24, 32].map(size => [size, `icons/${view.icon}-${size}.png`])) }),
    action.setTitle({ title: view.title }),
    action.setBadgeText({ text: view.badge }),
    action.setBadgeBackgroundColor({ color: '#10283f' }),
    action.setBadgeTextColor({ color: '#ffffff' })
  ]);
}
