import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUniqueFileName, uploadFile } from '../r2-uploader';
import { createMockFile, createValidSettings, TEST_TIMESTAMP } from './utils/test-helpers';

const s3Mock = mockClient(S3Client);

describe('Integration Tests', () => {
  beforeEach(() => {
    s3Mock.reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('Upload Workflow Tests', () => {
    it('should complete basic upload workflow', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settings = createValidSettings({
        customDomain: 'https://cdn.hnagato.com',
        useYearSubdirectory: true,
      });
      const file = createMockFile('test-image.png', 'image/png');
      vi.setSystemTime(TEST_TIMESTAMP);

      const fileName = generateUniqueFileName(file.name);
      const result = await uploadFile(settings, file, fileName);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toContain('https://cdn.hnagato.com/images/2022/');
        expect(result.data.fileName).toBe('1640995200000.png');
        expect(result.data.timestamp).toBe(TEST_TIMESTAMP);
      }

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'images/2022/1640995200000.png',
        ContentType: 'image/png',
      });
      expect(calls[0].args[0].input.Body).toBeInstanceOf(Uint8Array);
    });

    it('should handle custom domain and path configuration', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const customSettings = createValidSettings({
        customDomain: 'https://custom.hnagato.com',
        pathPrefix: 'uploads/photos',
        useYearSubdirectory: false,
      });
      const file = createMockFile('photo.jpg', 'image/jpeg');
      const fileName = 'custom-photo-123.jpg';

      const result = await uploadFile(customSettings, file, fileName);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(
          'https://custom.hnagato.com/uploads/photos/custom-photo-123.jpg'
        );
      }

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'uploads/photos/custom-photo-123.jpg',
        ContentType: 'image/jpeg',
      });
      expect(calls[0].args[0].input.Body).toBeInstanceOf(Uint8Array);
    });
  });

  describe('File Filtering Tests', () => {
    it('should filter image files from mixed file types', () => {
      const files = [
        createMockFile('image.png', 'image/png'),
        createMockFile('document.pdf', 'application/pdf'),
        createMockFile('photo.jpg', 'image/jpeg'),
      ];

      const imageFiles = files.filter(file => file.type.startsWith('image/'));

      expect(imageFiles).toHaveLength(2);
      expect(imageFiles[0].name).toBe('image.png');
      expect(imageFiles[1].name).toBe('photo.jpg');
    });

    it('should handle multiple uploads sequentially', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settings = createValidSettings();
      const files = [
        createMockFile('image1.png', 'image/png'),
        createMockFile('image2.jpg', 'image/jpeg'),
      ];

      const uploadPromises = files.map(async file => {
        const fileName = generateUniqueFileName(file.name);
        return await uploadFile(settings, file, fileName);
      });

      const results = await Promise.all(uploadPromises);

      expect(results.every(r => r.success)).toBe(true);
      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls.length).toBe(2);
    });
  });

  describe('Settings Validation Tests', () => {
    it('should handle incomplete settings', async () => {
      const incompleteSettings = createValidSettings({
        endpoint: '',
        bucketName: '',
      });
      const file = createMockFile('test.png', 'image/png');
      const fileName = generateUniqueFileName(file.name);

      const result = await uploadFile(incompleteSettings, file, fileName);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Missing required settings');
        expect(result.error).toContain('endpoint');
        expect(result.error).toContain('bucketName');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle path prefix normalization', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settings = createValidSettings({
        pathPrefix: 'uploads/images',
        useYearSubdirectory: false,
      });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFile(settings, file, 'test.png');

      expect(result.success).toBe(true);
      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls.length).toBe(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'uploads/images/test.png',
        ContentType: 'image/png',
      });
      expect(calls[0].args[0].input.Body).toBeInstanceOf(Uint8Array);
    });
  });
});
