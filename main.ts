import { type App, type Editor, MarkdownView, Notice, Plugin, PluginSettingTab } from 'obsidian';
import { generateUniqueFileName, uploadFileToR2 } from './r2-uploader';
import { createSettingsTab } from './settings-tab';
import type { R2UploaderSettings, Result } from './types';
import { DEFAULT_SETTINGS } from './types';

const isSettingsComplete = (settings: R2UploaderSettings): boolean =>
  !!(settings.endpoint && settings.accessKeyId && settings.secretAccessKey && settings.bucketName);

const getCurrentFilePath = (app: App): string | null => {
  const activeFile = app.workspace.getActiveFile();
  return activeFile?.path ?? null;
};

const isFileInEnabledFolders = (
  filePath: string | null,
  enabledFolders: readonly string[]
): boolean => {
  if (enabledFolders.length === 0) return true;
  if (!filePath) return false;

  return enabledFolders.some(folder => filePath.startsWith(`${folder}/`) || filePath === folder);
};

const showNotice = (message: string, timeout = 4000): Notice => new Notice(message, timeout);

const processImageUpload = async (
  files: File[],
  editor: Editor,
  settings: R2UploaderSettings
): Promise<void> => {
  for (const file of files) {
    const result = await uploadAndInsertImage(file, editor, settings);
    if (!result.success && 'error' in result) {
      showNotice(`Failed to upload ${file.name}: ${result.error}`);
    }
  }
};

const getDropImageFiles = (event: Event): File[] => {
  const dragEvent = event as DragEvent;
  return Array.from(dragEvent.dataTransfer?.files ?? []).filter(file =>
    file.type.startsWith('image/')
  );
};

const getPasteImageFiles = (event: Event): File[] => {
  const clipboardEvent = event as ClipboardEvent;
  return Array.from(clipboardEvent.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);
};

const uploadAndInsertImage = async (
  file: File,
  editor: Editor,
  settings: R2UploaderSettings
): Promise<Result<void>> => {
  const notice = new Notice(`Uploading ${file.name}...`, 2000);

  try {
    const fileName = generateUniqueFileName(file.name);
    const uploadResult = await uploadFileToR2(settings, file, fileName);

    // Explicit comparison for TypeScript type guard
    if (uploadResult.success === false) {
      notice.hide();
      return { success: false, error: uploadResult.error };
    }

    const markdownLink = `![${file.name}](${uploadResult.data.url})`;
    const cursor = editor.getCursor();
    editor.replaceRange(markdownLink, cursor);

    notice.hide();
    showNotice(`Successfully uploaded ${file.name}`);

    return { success: true, data: undefined };
  } catch (error) {
    notice.hide();
    return {
      success: false,
      error: `Upload failed: ${error}`,
    };
  }
};

const shouldHandleUpload = (
  activeView: MarkdownView | null,
  app: App,
  enabledFolders: readonly string[]
): boolean => {
  if (!activeView) return false;
  const currentFilePath = getCurrentFilePath(app);
  return isFileInEnabledFolders(currentFilePath, enabledFolders);
};

const validateUploadPreconditions = (
  activeView: MarkdownView | null,
  app: App,
  settings: R2UploaderSettings
): boolean => {
  if (!shouldHandleUpload(activeView, app, settings.enabledFolders)) {
    return false;
  }

  if (!isSettingsComplete(settings)) {
    showNotice('R2 uploader settings are incomplete. Please check the plugin settings.');
    return false;
  }

  return true;
};

const handleDrop = async (
  event: DragEvent,
  app: App,
  settings: R2UploaderSettings
): Promise<void> => {
  try {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!validateUploadPreconditions(activeView, app, settings)) {
      return;
    }

    const imageFiles = getDropImageFiles(event);
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    await processImageUpload(imageFiles, activeView.editor, settings);
  } catch (error) {
    showNotice(`Plugin error: ${error}`);
  }
};

const handlePaste = async (
  event: ClipboardEvent,
  editor: Editor,
  app: App,
  settings: R2UploaderSettings
): Promise<void> => {
  try {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);

    if (!validateUploadPreconditions(activeView, app, settings)) {
      return;
    }

    const imageFiles = getPasteImageFiles(event);
    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();

    await processImageUpload(imageFiles, editor, settings);
  } catch (error) {
    showNotice(`Plugin error: ${error}`);
  }
};

class R2UploaderSettingTab extends PluginSettingTab {
  private settingsTab: { display: (containerEl: HTMLElement) => void };

  constructor(
    app: App,
    plugin: R2UploaderPlugin,
    getCurrentSettings: () => R2UploaderSettings,
    saveSettingsFn: (settings: R2UploaderSettings) => Promise<void>
  ) {
    super(app, plugin);
    this.settingsTab = createSettingsTab(app, getCurrentSettings, saveSettingsFn);
  }

  display(): void {
    this.settingsTab.display(this.containerEl);
  }
}

export default class R2UploaderPlugin extends Plugin {
  private settings: R2UploaderSettings = DEFAULT_SETTINGS;
  private dropHandler: (event: DragEvent) => void;
  private dragoverHandler: (event: DragEvent) => void;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(
      new R2UploaderSettingTab(this.app, this, () => this.settings, this.saveSettings.bind(this))
    );

    this.dropHandler = (event: DragEvent) => handleDrop(event, this.app, this.settings);
    this.dragoverHandler = (event: DragEvent): void => {
      event.preventDefault();
    };

    document.addEventListener('drop', this.dropHandler, { capture: true });
    document.addEventListener('dragover', this.dragoverHandler, {
      capture: true,
    });

    this.registerEvent(
      this.app.workspace.on('editor-paste', (evt: ClipboardEvent, editor: Editor) => {
        handlePaste(evt, editor, this.app, this.settings);
      })
    );
  }

  onunload(): void {
    document.removeEventListener('drop', this.dropHandler, { capture: true });
    document.removeEventListener('dragover', this.dragoverHandler, {
      capture: true,
    });
  }

  private async loadSettings(): Promise<void> {
    const loadedData = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...loadedData };
  }

  private async saveSettings(newSettings: R2UploaderSettings): Promise<void> {
    this.settings = newSettings;
    await this.saveData(this.settings);
  }
}
