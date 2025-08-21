import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { FileInfo, R2UploaderSettings, Result, UploadResult } from './types';

const createS3Client = (settings: R2UploaderSettings): S3Client =>
  new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
  });

const generateFileKey = (
  pathPrefix: string,
  fileName: string,
  useYearSubdirectory: boolean
): string => {
  const normalizedPrefix = pathPrefix.endsWith('/') ? pathPrefix : `${pathPrefix}/`;
  const subdirectory = useYearSubdirectory ? `${new Date().getFullYear()}/` : '';
  return `${normalizedPrefix}${subdirectory}${fileName}`;
};

const buildUrl = (settings: R2UploaderSettings, key: string): string => {
  const baseUrl =
    settings.customDomain ||
    `https://${settings.bucketName}.${settings.endpoint.replace('https://', '')}`;
  return `${baseUrl}/${key}`;
};

const fileToFileInfo = async (file: File): Promise<Result<FileInfo>> => {
  try {
    const content = new Uint8Array(await file.arrayBuffer());
    return {
      success: true,
      data: {
        name: file.name,
        type: file.type,
        size: file.size,
        content,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error}`,
    };
  }
};

const validateSettings = (settings: R2UploaderSettings): Result<R2UploaderSettings> => {
  const errors: string[] = [];
  if (!settings.endpoint) errors.push('endpoint');
  if (!settings.accessKeyId) errors.push('accessKeyId');
  if (!settings.secretAccessKey) errors.push('secretAccessKey');
  if (!settings.bucketName) errors.push('bucketName');

  if (errors.length > 0) {
    return { success: false, error: `Missing required settings: ${errors.join(', ')}` };
  }
  return { success: true, data: settings };
};

export const uploadFileToR2 = async (
  settings: R2UploaderSettings,
  file: File,
  fileName: string
): Promise<Result<UploadResult>> => {
  const settingsResult = validateSettings(settings);
  // Explicit comparison for TypeScript type guard
  if (settingsResult.success === false) {
    return { success: false, error: settingsResult.error };
  }

  const fileInfoResult = await fileToFileInfo(file);
  // Explicit comparison for TypeScript type guard
  if (fileInfoResult.success === false) {
    return { success: false, error: fileInfoResult.error };
  }

  try {
    const client = createS3Client(settings);
    const key = generateFileKey(settings.pathPrefix, fileName, settings.useYearSubdirectory);

    const command = new PutObjectCommand({
      Bucket: settings.bucketName,
      Key: key,
      Body: fileInfoResult.data.content,
      ContentType: fileInfoResult.data.type,
    });

    await client.send(command);

    const url = buildUrl(settings, key);
    const timestamp = Date.now();

    return {
      success: true,
      data: {
        url,
        fileName,
        timestamp,
      },
    };
  } catch (error) {
    let errorMessage = `Upload failed: ${error}`;

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      errorMessage =
        'Upload failed: CORS error. Please add "app://obsidian.md" to AllowedOrigins in your R2 bucket CORS policy.';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  return `${timestamp}.${extension}`;
};
