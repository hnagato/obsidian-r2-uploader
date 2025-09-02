import { type App, type Editor, MarkdownView, Notice, Plugin, PluginSettingTab } from 'obsidian';
import sanitize from 'sanitize-filename';
import { generateUniqueFileName, uploadFile } from './r2-uploader';
import { createSettingsTab } from './settings-tab';
import type { R2UploaderSettings, Result, UploadResult } from './types';
import { DEFAULT_SETTINGS } from './types';

const getCurrentFilePath = (app: App): string => {
  const activeFile = app.workspace.getActiveFile();
  return activeFile?.path ?? '';
};

const isInEnabledFolder = (filePath: string, enabledFolders: readonly string[]): boolean => {
  if (!filePath) return false;
  if (enabledFolders.length === 0) return true;

  return enabledFolders.some(folder => filePath.startsWith(`${folder}/`) || filePath === folder);
};

const showNotice = (message: string, timeout = 4_000): Notice => new Notice(message, timeout);

const processFiles = async (
  files: File[],
  settings: R2UploaderSettings
): Promise<readonly Result<UploadResult>[]> =>
  Promise.all(files.map(file => uploadFile(settings, file, generateUniqueFileName(file.name))));

type FileProcessResult = {
  readonly originalName: string;
  readonly result: Result<UploadResult>;
};

type MarkdownLink = {
  readonly displayName: string;
  readonly url: string;
};

const insertMarkdownLinks = (editor: Editor, links: readonly MarkdownLink[]): void => {
  let insertPosition = editor.getCursor();

  links.forEach(({ displayName, url }) => {
    const markdownLink = `![${displayName}](${url})`;
    editor.replaceRange(markdownLink, insertPosition);
    insertPosition = {
      ...insertPosition,
      ch: insertPosition.ch + markdownLink.length,
    };
  });
};

const showProcessResults = (results: readonly FileProcessResult[]): void => {
  results.forEach(({ originalName, result }) => {
    const safeName = sanitize(originalName, { replacement: '_' });

    if (result.success === true) {
      showNotice(`Successfully uploaded ${safeName}`, 2_000);
    } else {
      showNotice(`Failed to upload ${safeName}: ${result.error}`, 0);
    }
  });
};

const processImages = async (
  files: File[],
  editor: Editor,
  settings: R2UploaderSettings
): Promise<void> => {
  const results = await processFiles(files, settings);

  const processResults: FileProcessResult[] = results.map((result, index) => ({
    originalName: files[index].name,
    result,
  }));

  insertMarkdownLinks(
    editor,
    processResults
      .filter(({ result }) => result.success)
      .map(
        ({ originalName, result }): MarkdownLink => ({
          displayName: sanitize(originalName, { replacement: '_' }),
          url: result.success ? result.data.url : '',
        })
      )
  );

  showProcessResults(processResults);
};

const extractDropFiles = (event: DragEvent): File[] => {
  return Array.from(event.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
};

const extractPasteFiles = (event: ClipboardEvent): File[] => {
  return Array.from(event.clipboardData?.items ?? [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => file !== null);
};

const validateConditions = (app: App, settings: R2UploaderSettings): boolean => {
  if (settings.enabledFolders.length > 0) {
    if (!isInEnabledFolder(getCurrentFilePath(app), settings.enabledFolders)) {
      showNotice('Current folder is not enabled for uploads');
      return false;
    }
  }

  const hasRequiredSettings = !!(
    settings.endpoint &&
    settings.accessKeyId &&
    settings.secretAccessKey &&
    settings.bucketName
  );

  if (!hasRequiredSettings) {
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

    if (!activeView) {
      return;
    }

    if (!validateConditions(app, settings)) {
      return;
    }

    const imageFiles = extractDropFiles(event);
    if (imageFiles.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    await processImages(imageFiles, activeView.editor, settings);
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

    if (!activeView) {
      return;
    }

    if (!validateConditions(app, settings)) {
      return;
    }

    const imageFiles = extractPasteFiles(event);
    if (imageFiles.length === 0) return;

    event.preventDefault();

    await processImages(imageFiles, editor, settings);
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
  private dropHandler?: (event: DragEvent) => void;
  private dragoverHandler?: (event: DragEvent) => void;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(
      new R2UploaderSettingTab(this.app, this, () => this.settings, this.saveSettings.bind(this))
    );

    this.dropHandler = (event: DragEvent) => handleDrop(event, this.app, this.settings);
    this.dragoverHandler = (event: DragEvent) => {
      event.preventDefault();
    };

    if (this.dropHandler && this.dragoverHandler) {
      document.addEventListener('drop', this.dropHandler, { capture: true });
      document.addEventListener('dragover', this.dragoverHandler, {
        capture: true,
      });
    }

    this.registerEvent(
      this.app.workspace.on('editor-paste', (evt, editor) => {
        handlePaste(evt, editor, this.app, this.settings);
      })
    );
  }

  onunload(): void {
    if (this.dropHandler && this.dragoverHandler) {
      document.removeEventListener('drop', this.dropHandler, { capture: true });
      document.removeEventListener('dragover', this.dragoverHandler, {
        capture: true,
      });
    }
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
