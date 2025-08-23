import { vi } from 'vitest';
import type { R2UploaderSettings } from '../../types';

export const createValidSettings = (
  overrides: Partial<R2UploaderSettings> = {}
): R2UploaderSettings => ({
  endpoint: 'https://r2.cloudflarestorage.com',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
  bucketName: 'test-bucket',
  region: 'auto',
  customDomain: '',
  pathPrefix: 'images/',
  useYearSubdirectory: false,
  enabledFolders: [],
  ...overrides,
});

export const createMockFile = (name: string, type: string, content = 'test'): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Fixed timestamp for consistent test results across time zones
export const TEST_TIMESTAMP = 1640995200000;
export const TEST_YEAR = '2022';

export const expectSuccess = <T>(result: { success: boolean; data?: T; error?: string }): T => {
  if (!result.success) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
  if (result.data === undefined) {
    throw new Error('Expected success result to have data');
  }
  return result.data;
};

export const expectError = <E>(result: { success: boolean; error?: E }): E => {
  if (result.success) {
    throw new Error('Expected error but got success');
  }
  if (result.error === undefined) {
    throw new Error('Expected error result to have error');
  }
  return result.error;
};

// Minimal DataTransfer mock - only implements properties actually used in tests
export const createMockDataTransfer = (
  options: { items?: DataTransferItem[]; files?: File[] } = {}
): Partial<DataTransfer> => {
  const { items = [], files = [] } = options;

  return {
    files: Object.assign(files, {
      item: (index: number) => files[index] ?? null,
    }) as FileList,
    items: Object.assign(items, {
      length: items.length,
      add: vi.fn(),
      clear: vi.fn(),
    }) as unknown as DataTransferItemList,
  };
};
