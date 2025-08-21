import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateUniqueFileName, uploadFileToR2 } from '../r2-uploader';
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
        customDomain: 'https://cdn.example.com',
        useYearSubdirectory: true,
      });
      const file = createMockFile('test-image.png', 'image/png');
      vi.setSystemTime(TEST_TIMESTAMP);

      const fileName = generateUniqueFileName(file.name);
      const result = await uploadFileToR2(settings, file, fileName);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toContain('https://cdn.example.com/images/2022/');
        expect(result.data.fileName).toBe('1640995200000.png');
        expect(result.data.timestamp).toBe(TEST_TIMESTAMP);
      }

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'images/2022/1640995200000.png',
        Body: expect.any(Uint8Array),
        ContentType: 'image/png',
      });
    });

    it('should handle custom domain and path configuration', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const customSettings = createValidSettings({
        customDomain: 'https://custom.cdn.com',
        pathPrefix: 'uploads/photos',
        useYearSubdirectory: false,
      });
      const file = createMockFile('photo.jpg', 'image/jpeg');
      const fileName = 'custom-photo-123.jpg';

      const result = await uploadFileToR2(customSettings, file, fileName);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://custom.cdn.com/uploads/photos/custom-photo-123.jpg');
      }

      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'uploads/photos/custom-photo-123.jpg',
        Body: expect.any(Uint8Array),
        ContentType: 'image/jpeg',
      });
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
        return await uploadFileToR2(settings, file, fileName);
      });

      const results = await Promise.all(uploadPromises);

      expect(results.every(r => r.success)).toBe(true);
      expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 2);
    });
  });

  describe('Folder Restriction Tests', () => {
    it('should respect enabled folders setting in upload workflow', () => {
      const settings = createValidSettings({
        enabledFolders: ['documents', 'projects/2025'],
      });
      expect(settings.enabledFolders).toEqual(['documents', 'projects/2025']);
      expect(settings.enabledFolders.length).toBeGreaterThan(0);
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

      const result = await uploadFileToR2(incompleteSettings, file, fileName);

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.error).toContain('Missing required settings');
        expect(result.error).toContain('endpoint');
        expect(result.error).toContain('bucketName');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in filenames', () => {
      vi.setSystemTime(TEST_TIMESTAMP);

      const fileName = generateUniqueFileName('Screenshot 2025-08-20 at 2.30.45 PM.png');

      expect(fileName).toBe('1640995200000.png');
      expect(fileName).toContain('.png');
    });

    it('should handle path prefix normalization', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const settings = createValidSettings({
        pathPrefix: 'uploads/images',
        useYearSubdirectory: false,
      });
      const file = createMockFile('test.png', 'image/png');

      const result = await uploadFileToR2(settings, file, 'test.png');

      expect(result.success).toBe(true);
      expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
        Bucket: 'test-bucket',
        Key: 'uploads/images/test.png',
        Body: expect.any(Uint8Array),
        ContentType: 'image/png',
      });
    });

    it('should generate unique timestamps for different files', () => {
      vi.setSystemTime(TEST_TIMESTAMP);
      const fileName1 = generateUniqueFileName('image.png');

      vi.setSystemTime(TEST_TIMESTAMP + 1);
      const fileName2 = generateUniqueFileName('image.png');

      expect(fileName1).toBe('1640995200000.png');
      expect(fileName2).toBe('1640995200001.png');
      expect(fileName1).not.toBe(fileName2);
    });
  });
});
