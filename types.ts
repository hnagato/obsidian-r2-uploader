export type Result<T, E = string> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export const isSuccess = <T, E = string>(
  result: Result<T, E>
): result is { readonly success: true; readonly data: T } => {
  return result.success;
};

export type R2UploaderSettings = {
  readonly endpoint: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucketName: string;
  readonly region: string;
  readonly customDomain: string;
  readonly pathPrefix: string;
  readonly useYearSubdirectory: boolean;
  readonly enabledFolders: readonly string[];
};

export type UploadResult = {
  readonly url: string;
  readonly fileName: string;
  readonly timestamp: number;
};

export type FileInfo = {
  readonly name: string;
  readonly type: string;
  readonly size: number;
  readonly content: Uint8Array;
};

export const DEFAULT_SETTINGS: R2UploaderSettings = {
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
  bucketName: '',
  region: 'auto',
  customDomain: '',
  pathPrefix: 'images/',
  useYearSubdirectory: true,
  enabledFolders: [],
} as const;
