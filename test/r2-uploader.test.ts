import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUniqueFileName, uploadFile } from '../r2-uploader';
import { createMockFile, createValidSettings, TEST_TIMESTAMP } from './utils/test-helpers';

const s3Mock = mockClient(S3Client);

describe('r2-uploader', () => {
  describe('generateUniqueFileName', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should generate timestamp-based filename with original extension', () => {
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = generateUniqueFileName('image.png');

      expect(result).toBe('1640995200000.png');
    });

    it('should handle files without extension', () => {
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = generateUniqueFileName('image');

      expect(result).toBe('1640995200000.image');
    });

    it('should handle multiple extensions correctly', () => {
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = generateUniqueFileName('image.test.jpeg');

      expect(result).toBe('1640995200000.jpeg');
    });

    it('should generate different filenames for different timestamps', () => {
      vi.setSystemTime(TEST_TIMESTAMP);
      const result1 = generateUniqueFileName('image.png');

      vi.setSystemTime(TEST_TIMESTAMP + 1);
      const result2 = generateUniqueFileName('image.png');

      expect(result1).not.toBe(result2);
      expect(result1).toBe('1640995200000.png');
      expect(result2).toBe('1640995200001.png');
    });

    it('should handle filenames with special characters', () => {
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = generateUniqueFileName('Screenshot 2024-01-01 at 2.30.45 PM.png');

      expect(result).toBe('1640995200000.png');
    });
  });

  describe('uploadFile', () => {
    beforeEach(() => {
      s3Mock.reset();
      vi.clearAllMocks();
      vi.useFakeTimers();
    });

    it('should fail with incomplete settings - missing endpoint', async () => {
      const incompleteSettings = createValidSettings({ endpoint: '' });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(incompleteSettings, file, 'test.png');

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Missing required settings: endpoint');
      }
    });

    it('should fail with incomplete settings - missing multiple fields', async () => {
      const incompleteSettings = createValidSettings({
        endpoint: '',
        accessKeyId: '',
        bucketName: '',
      });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(incompleteSettings, file, 'test.png');

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Missing required settings');
        expect(result.error).toContain('endpoint');
        expect(result.error).toContain('accessKeyId');
        expect(result.error).toContain('bucketName');
      }
    });

    it('should succeed with valid settings and file', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const validSettings = createValidSettings();
      const file = createMockFile('test.png', 'image/png');
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = await uploadFile(validSettings, file, 'test.png');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(
          'https://test-bucket.r2.cloudflarestorage.com/images/test.png'
        );
        expect(result.data.fileName).toBe('test.png');
        expect(result.data.timestamp).toBe(TEST_TIMESTAMP);
      }

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'images/test.png',
        Body: expect.any(Uint8Array),
        ContentType: 'image/png',
      });
      expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 1);
    });

    it('should use year subdirectory when enabled', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settingsWithYear = createValidSettings({ useYearSubdirectory: true });
      const file = createMockFile('test.png', 'image/png');
      vi.setSystemTime(new Date('2025-01-01').getTime());

      const result = await uploadFile(settingsWithYear, file, 'test.png');

      expect(result.success).toBe(true);
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'images/2025/test.png',
        Body: expect.any(Uint8Array),
        ContentType: 'image/png',
      });
    });

    it('should use custom domain when provided', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settingsWithCustomDomain = createValidSettings({
        customDomain: 'https://images.hnagato.com',
      });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(settingsWithCustomDomain, file, 'test.png');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://images.hnagato.com/images/test.png');
      }
    });

    it('should handle path prefix without trailing slash', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settingsWithPrefix = createValidSettings({ pathPrefix: 'uploads' });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(settingsWithPrefix, file, 'test.png');

      expect(result.success).toBe(true);
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'uploads/test.png',
        Body: expect.any(Uint8Array),
        ContentType: 'image/png',
      });
    });

    it('should handle S3 client errors', async () => {
      const networkError = new Error('Network error');
      s3Mock.on(PutObjectCommand).rejects(networkError);

      const validSettings = createValidSettings();
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(validSettings, file, 'test.png');

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Upload failed: Error: Network error');
      }
    });

    it('should handle CORS errors specifically', async () => {
      const corsError = new TypeError('Failed to fetch');
      s3Mock.on(PutObjectCommand).rejects(corsError);

      const validSettings = createValidSettings();
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(validSettings, file, 'test.png');

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('CORS error');
        expect(result.error).toContain('app://obsidian.md');
      }
    });

    it('should handle file reading errors', async () => {
      const validSettings = createValidSettings();
      const file = createMockFile('test.png', 'image/png');
      vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('File read error'));

      const result = await uploadFile(validSettings, file, 'test.png');

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Failed to read file');
      }
    });

    it('should return pure domain upload result', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const validSettings = createValidSettings();
      const file = createMockFile('problematic<filename>.png', 'image/png');
      vi.setSystemTime(TEST_TIMESTAMP);

      const result = await uploadFile(validSettings, file, 'generated-name.png');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fileName).toBe('generated-name.png');
        // UploadResult now only contains domain-specific upload data
        expect(result.data.url).toBeDefined();
        expect(result.data.fileName).toBeDefined();
        expect(result.data.timestamp).toBeDefined();
        expect(result.data.timestamp).toBe(TEST_TIMESTAMP);
      }
    });
  });
});
