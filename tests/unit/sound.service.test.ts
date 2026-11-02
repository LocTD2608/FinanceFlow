import { soundService } from '../../src/services/soundService';
import { useSettingsStore } from '../../src/store/useSettingsStore';

describe('Sound Service and Settings Store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ soundEnabled: true, toastEnabled: true });
  });

  it('toggles soundEnabled setting', async () => {
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
    await useSettingsStore.getState().setSoundEnabled(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('toggles toastEnabled setting', async () => {
    expect(useSettingsStore.getState().toastEnabled).toBe(true);
    await useSettingsStore.getState().setToastEnabled(false);
    expect(useSettingsStore.getState().toastEnabled).toBe(false);
  });

  it('soundService exposes playChime without throwing', () => {
    expect(() => soundService.playChime('in')).not.toThrow();
    expect(() => soundService.playChime('out')).not.toThrow();
  });
});
