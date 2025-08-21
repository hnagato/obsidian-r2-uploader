import { describe, expect, it } from 'vitest';
import type { R2UploaderSettings } from '../types';

describe('settings-tab', () => {
  describe('updateSettings', () => {
    const updateSettings = (
      currentSettings: R2UploaderSettings,
      key: keyof R2UploaderSettings,
      value: string | boolean | readonly string[]
    ): R2UploaderSettings => ({
      ...currentSettings,
      [key]: value,
    });

    const baseSettings: R2UploaderSettings = {
      endpoint: 'https://test.r2.cloudflarestorage.com',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      bucketName: 'test-bucket',
      region: 'auto',
      customDomain: '',
      pathPrefix: 'images/',
      useYearSubdirectory: true,
      enabledFolders: [],
    };

    it('should update string settings correctly', () => {
      const result = updateSettings(baseSettings, 'endpoint', 'https://new.endpoint.com');

      expect(result.endpoint).toBe('https://new.endpoint.com');
      expect(result.accessKeyId).toBe(baseSettings.accessKeyId);
      expect(result).not.toBe(baseSettings);
    });

    it('should update boolean settings correctly', () => {
      const result = updateSettings(baseSettings, 'useYearSubdirectory', false);

      expect(result.useYearSubdirectory).toBe(false);
      expect(result.endpoint).toBe(baseSettings.endpoint);
      expect(result).not.toBe(baseSettings);
    });

    it('should update array settings correctly', () => {
      const newFolders = ['folder1', 'folder2'];
      const result = updateSettings(baseSettings, 'enabledFolders', newFolders);

      expect(result.enabledFolders).toEqual(newFolders);
      expect(result.enabledFolders).not.toBe(baseSettings.enabledFolders);
      expect(result.endpoint).toBe(baseSettings.endpoint);
    });

    it('should update all different field types', () => {
      const tests = [
        { key: 'endpoint' as const, value: 'https://new-endpoint.com' },
        { key: 'accessKeyId' as const, value: 'new-key-id' },
        { key: 'secretAccessKey' as const, value: 'new-secret' },
        { key: 'bucketName' as const, value: 'new-bucket' },
        { key: 'region' as const, value: 'us-east-1' },
        { key: 'customDomain' as const, value: 'https://cdn.example.com' },
        { key: 'pathPrefix' as const, value: 'uploads/' },
        { key: 'useYearSubdirectory' as const, value: false },
        { key: 'enabledFolders' as const, value: ['test1', 'test2'] },
      ];

      tests.forEach(({ key, value }) => {
        const result = updateSettings(baseSettings, key, value);
        expect(result[key]).toEqual(value);
        expect(result).not.toBe(baseSettings);
      });
    });

    it('should preserve readonly array immutability', () => {
      const folders = ['folder1', 'folder2'] as const;
      const result = updateSettings(baseSettings, 'enabledFolders', folders);

      expect(result.enabledFolders).toEqual(['folder1', 'folder2']);
      expect(result.enabledFolders).toBe(folders);
    });
  });

  describe('createSettingFields', () => {
    type SettingFieldConfig = {
      readonly name: string;
      readonly desc: string;
      readonly placeholder: string;
      readonly key: keyof R2UploaderSettings;
      readonly isPassword?: boolean;
      readonly isToggle?: boolean;
      readonly isArray?: boolean;
    };

    const createSettingFields = (): readonly SettingFieldConfig[] =>
      [
        {
          name: 'R2 Endpoint',
          desc: 'Cloudflare R2 endpoint URL',
          placeholder: 'https://xxxxxxxxx.r2.cloudflarestorage.com',
          key: 'endpoint',
        },
        {
          name: 'Access Key ID',
          desc: 'R2 access key ID',
          placeholder: 'Access Key ID',
          key: 'accessKeyId',
        },
        {
          name: 'Secret Access Key',
          desc: 'R2 secret access key',
          placeholder: 'Secret Access Key',
          key: 'secretAccessKey',
          isPassword: true,
        },
        {
          name: 'Bucket Name',
          desc: 'R2 bucket name',
          placeholder: 'my-bucket',
          key: 'bucketName',
        },
        {
          name: 'Region',
          desc: 'R2 region (usually "auto" for Cloudflare R2)',
          placeholder: 'auto',
          key: 'region',
        },
        {
          name: 'Custom Domain',
          desc: 'Custom domain for accessing uploaded images (optional)',
          placeholder: 'https://images.example.com',
          key: 'customDomain',
        },
        {
          name: 'Path Prefix',
          desc: 'Path prefix for uploaded images',
          placeholder: 'images/',
          key: 'pathPrefix',
        },
        {
          name: 'Use Year Subdirectory',
          desc: 'Organize uploads by year (e.g., images/2025/)',
          placeholder: '',
          key: 'useYearSubdirectory',
          isToggle: true,
        },
        {
          name: 'Enabled Folders',
          desc: 'Folders where R2 upload is enabled (empty = all folders)',
          placeholder: 'folder/subfolder',
          key: 'enabledFolders',
          isArray: true,
        },
      ] as const;

    it('should return all required setting fields', () => {
      const fields = createSettingFields();

      expect(fields).toHaveLength(9);

      const fieldKeys = fields.map(f => f.key);
      expect(fieldKeys).toContain('endpoint');
      expect(fieldKeys).toContain('accessKeyId');
      expect(fieldKeys).toContain('secretAccessKey');
      expect(fieldKeys).toContain('bucketName');
      expect(fieldKeys).toContain('region');
      expect(fieldKeys).toContain('customDomain');
      expect(fieldKeys).toContain('pathPrefix');
      expect(fieldKeys).toContain('useYearSubdirectory');
      expect(fieldKeys).toContain('enabledFolders');
    });

    it('should mark secret access key as password field', () => {
      const fields = createSettingFields();
      const secretField = fields.find(f => f.key === 'secretAccessKey');

      expect(secretField?.isPassword).toBe(true);
    });

    it('should mark year subdirectory as toggle field', () => {
      const fields = createSettingFields();
      const toggleField = fields.find(f => f.key === 'useYearSubdirectory');

      expect(toggleField?.isToggle).toBe(true);
    });

    it('should mark enabled folders as array field', () => {
      const fields = createSettingFields();
      const arrayField = fields.find(f => f.key === 'enabledFolders');

      expect(arrayField?.isArray).toBe(true);
    });
  });
});
