import type { App, TFolder } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { createSettingsTab } from '../settings-tab';
import { createValidSettings } from './utils/test-helpers';

describe('settings-tab', () => {
  describe('createSettingsTab', () => {
    it('should return display function', () => {
      const mockApp = {
        vault: {
          getAllFolders: (): TFolder[] => [],
        },
      };
      const mockGetSettings = () => createValidSettings();
      const mockSave = async (): Promise<void> => {};

      const tab = createSettingsTab(mockApp as App, mockGetSettings, mockSave);

      expect(typeof tab.display).toBe('function');
    });
  });
});
