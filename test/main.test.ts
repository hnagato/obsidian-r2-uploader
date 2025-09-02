import { beforeEach, describe, expect, it, vi } from 'vitest';
import R2UploaderPlugin from '../main.ts';
import type { R2UploaderSettings } from '../types';
import { createValidSettings } from './utils/test-helpers';

vi.mock('../r2-uploader', () => ({
  generateUniqueFileName: vi.fn().mockReturnValue('test-file-123.png'),
  uploadFile: vi.fn().mockResolvedValue({
    success: true,
    data: {
      url: 'test-url',
      fileName: 'test-file-123.png',
      timestamp: Date.now(),
    },
  }),
}));

vi.mock('../settings-tab', () => ({
  createSettingsTab: vi.fn().mockReturnValue({
    display: vi.fn(),
  }),
}));
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(global, 'document', {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
});

describe('R2UploaderPlugin', () => {
  let plugin: InstanceType<typeof R2UploaderPlugin>;
  let mockLoadData: ReturnType<typeof vi.spyOn>;
  let mockSaveData: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();

    const mockApp = {} as ConstructorParameters<typeof R2UploaderPlugin>[0];
    const mockManifest = {} as ConstructorParameters<typeof R2UploaderPlugin>[1];
    plugin = new R2UploaderPlugin(mockApp, mockManifest);

    mockLoadData = vi.spyOn(plugin, 'loadData');
    mockSaveData = vi.spyOn(plugin, 'saveData');
    vi.spyOn(plugin, 'addSettingTab').mockImplementation(vi.fn());
    vi.spyOn(plugin, 'registerEvent').mockImplementation(vi.fn());
  });

  describe('onload', () => {
    it('should complete basic initialization', async () => {
      const testSettings = createValidSettings();
      mockLoadData.mockResolvedValue(testSettings);

      await plugin.onload();

      expect(mockLoadData).toHaveBeenCalledOnce();
      expect(plugin.addSettingTab).toHaveBeenCalledOnce();
      expect(plugin.registerEvent).toHaveBeenCalledOnce();
    });

    it('should handle initialization failure', async () => {
      mockLoadData.mockRejectedValue(new Error('Load failed'));

      await expect(plugin.onload()).rejects.toThrow('Load failed');
    });
  });

  describe('onunload', () => {
    beforeEach(async () => {
      mockLoadData.mockResolvedValue({});
      await plugin.onload();
    });

    it('should cleanup event listeners', () => {
      plugin.onunload();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('drop', expect.any(Function), {
        capture: true,
      });
      expect(mockRemoveEventListener).toHaveBeenCalledWith('dragover', expect.any(Function), {
        capture: true,
      });
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        plugin.onunload();
        plugin.onunload();
      }).not.toThrow();
    });
  });

  describe('settings lifecycle', () => {
    it('should merge partial settings with defaults', async () => {
      const partialSettings: Partial<R2UploaderSettings> = {
        bucketName: 'custom-bucket',
        pathPrefix: 'custom-prefix/',
      };
      mockLoadData.mockResolvedValue(partialSettings);

      await plugin.onload();

      expect(plugin.addSettingTab).toHaveBeenCalledOnce();
      expect(mockAddEventListener).toHaveBeenCalledTimes(2);
    });

    it('should fallback to defaults when no saved data exists', async () => {
      mockLoadData.mockResolvedValue(null);

      await plugin.onload();

      expect(plugin.addSettingTab).toHaveBeenCalledOnce();
      expect(plugin.registerEvent).toHaveBeenCalledOnce();
    });

    it('should save settings successfully', async () => {
      mockLoadData.mockResolvedValue({});
      await plugin.onload();

      const newSettings = createValidSettings({ bucketName: 'new-bucket' });
      mockSaveData.mockResolvedValue(undefined);

      await (
        plugin as unknown as { saveSettings: (s: R2UploaderSettings) => Promise<void> }
      ).saveSettings(newSettings);

      expect(mockSaveData).toHaveBeenCalledWith(newSettings);
    });

    it('should propagate save failures', async () => {
      mockLoadData.mockResolvedValue({});
      await plugin.onload();

      const newSettings = createValidSettings();
      mockSaveData.mockRejectedValue(new Error('Save failed'));

      await expect(
        (
          plugin as unknown as { saveSettings: (s: R2UploaderSettings) => Promise<void> }
        ).saveSettings(newSettings)
      ).rejects.toThrow('Save failed');
    });
  });

  describe('load/unload cycles', () => {
    it('should handle repeated load/unload cycles', async () => {
      mockLoadData.mockResolvedValue({});

      await plugin.onload();
      plugin.onunload();

      await plugin.onload();
      plugin.onunload();
      expect(mockAddEventListener).toHaveBeenCalled();
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });
  });
});
