// Controller settings, persisted to localStorage.

export const DEFAULT_SETTINGS = { rotSens: 1.0, deadzone: 0.25, trigThresh: 0.10 };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem('moonLanderSettings'));
    if (saved) return saved;
  } catch (e) {}
  return {};
}

export const settings = { ...DEFAULT_SETTINGS, ...load() };

export function saveSettings() {
  try { localStorage.setItem('moonLanderSettings', JSON.stringify(settings)); } catch (e) {}
}

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
  saveSettings();
}
