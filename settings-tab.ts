import { type App, FuzzySuggestModal, Notice, Setting, type TFolder } from 'obsidian';
import type { R2UploaderSettings } from './types';

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private onSubmit: (result: string) => void;

  constructor(app: App, onSubmit: (result: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.setPlaceholder('Start typing folder name...');
  }

  getItems(): TFolder[] {
    return this.app.vault.getAllFolders();
  }

  getItemText(folder: TFolder): string {
    return folder.path === '/' ? '(root)' : folder.path;
  }

  onChooseItem(folder: TFolder): void {
    const folderPath = folder.path === '/' ? '' : folder.path;
    this.onSubmit(folderPath);
  }
}

const updateSettings = (
  currentSettings: R2UploaderSettings,
  key: keyof R2UploaderSettings,
  value: string | boolean | readonly string[]
): R2UploaderSettings => ({
  ...currentSettings,
  [key]: value,
});

const saveSettingsImmediate = async (
  getCurrentSettings: () => R2UploaderSettings,
  saveSettingsFn: (settings: R2UploaderSettings) => Promise<void>,
  key: keyof R2UploaderSettings,
  value: string | boolean | readonly string[]
): Promise<void> => {
  try {
    const latestSettings = getCurrentSettings();
    const updatedSettings = updateSettings(latestSettings, key, value);
    await saveSettingsFn(updatedSettings);
  } catch (error) {
    new Notice(`Failed to save settings: ${error}`, 5000);
  }
};

export const createSettingsTab = (
  app: App,
  getCurrentSettings: () => R2UploaderSettings,
  saveSettingsFn: (settings: R2UploaderSettings) => Promise<void>
) => {
  let saveTimeout: NodeJS.Timeout | null = null;
  let displayContainer: HTMLElement | null = null;

  const saveSettingsDebounced = async (
    key: keyof R2UploaderSettings,
    value: string | boolean | readonly string[]
  ): Promise<void> => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(
      () => saveSettingsImmediate(getCurrentSettings, saveSettingsFn, key, value),
      500
    );
  };

  const refreshDisplay = () => {
    if (displayContainer) {
      renderSettings(displayContainer);
    }
  };

  const renderEndpointSetting = (containerEl: HTMLElement, settings: R2UploaderSettings) => {
    new Setting(containerEl)
      .setName('R2 Endpoint')
      .setDesc('Cloudflare R2 endpoint URL')
      .addText(text =>
        text
          .setPlaceholder('https://xxxxxxxxx.r2.cloudflarestorage.com')
          .setValue(settings.endpoint)
          .onChange(value => saveSettingsDebounced('endpoint', value))
      );
  };

  const renderCredentialSettings = (containerEl: HTMLElement, settings: R2UploaderSettings) => {
    new Setting(containerEl)
      .setName('Access Key ID')
      .setDesc('R2 access key ID')
      .addText(text =>
        text
          .setPlaceholder('Access Key ID')
          .setValue(settings.accessKeyId)
          .onChange(value => saveSettingsDebounced('accessKeyId', value))
      );

    new Setting(containerEl)
      .setName('Secret Access Key')
      .setDesc('R2 secret access key')
      .addText(text => {
        text.inputEl.type = 'password';
        return text
          .setPlaceholder('Secret Access Key')
          .setValue(settings.secretAccessKey)
          .onChange(value => saveSettingsDebounced('secretAccessKey', value));
      });
  };

  const renderBucketSettings = (containerEl: HTMLElement, settings: R2UploaderSettings) => {
    new Setting(containerEl)
      .setName('Bucket Name')
      .setDesc('R2 bucket name')
      .addText(text =>
        text
          .setPlaceholder('my-bucket')
          .setValue(settings.bucketName)
          .onChange(value => saveSettingsDebounced('bucketName', value))
      );

    new Setting(containerEl)
      .setName('Region')
      .setDesc('R2 region (usually "auto" for Cloudflare R2)')
      .addText(text =>
        text
          .setPlaceholder('auto')
          .setValue(settings.region)
          .onChange(value => saveSettingsDebounced('region', value))
      );
  };

  const renderPathSettings = (containerEl: HTMLElement, settings: R2UploaderSettings) => {
    new Setting(containerEl)
      .setName('Custom Domain')
      .setDesc('Custom domain for uploaded files (optional)')
      .addText(text =>
        text
          .setPlaceholder('https://cdn.example.com')
          .setValue(settings.customDomain)
          .onChange(value => saveSettingsDebounced('customDomain', value))
      );

    new Setting(containerEl)
      .setName('Path Prefix')
      .setDesc('Path prefix for uploaded files')
      .addText(text =>
        text
          .setPlaceholder('images/')
          .setValue(settings.pathPrefix)
          .onChange(value => saveSettingsDebounced('pathPrefix', value))
      );

    new Setting(containerEl)
      .setName('Use Year Subdirectory')
      .setDesc('Organize uploads by year (e.g., images/2024/)')
      .addToggle(toggle =>
        toggle
          .setValue(settings.useYearSubdirectory)
          .onChange(value => saveSettingsDebounced('useYearSubdirectory', value))
      );
  };

  const renderFolderSettings = (containerEl: HTMLElement, settings: R2UploaderSettings) => {
    const headerSetting = new Setting(containerEl)
      .setName('Enabled Folders')
      .setDesc('Folders where image uploads are enabled');

    let inputEl: HTMLInputElement;

    headerSetting.addText(text => {
      inputEl = text.inputEl;
      text.setPlaceholder('Type folder path...');
      return text;
    });

    headerSetting.addButton(button =>
      button.setButtonText('Add').onClick(async () => {
        if (inputEl.value.trim()) {
          const newFolders = [...settings.enabledFolders, inputEl.value.trim()];
          await saveSettingsImmediate(
            getCurrentSettings,
            saveSettingsFn,
            'enabledFolders',
            newFolders
          );
          inputEl.value = '';
          refreshDisplay();
        }
      })
    );

    headerSetting.addButton(button =>
      button.setButtonText('Browse').onClick(() => {
        new FolderSuggestModal(app, (folderPath: string) => {
          inputEl.value = folderPath;
        }).open();
      })
    );

    settings.enabledFolders.forEach((folder, index) => {
      new Setting(containerEl).setName(`${folder || '(root)'}`).addButton(button =>
        button
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            const newFolders = [...settings.enabledFolders];
            newFolders.splice(index, 1);
            await saveSettingsImmediate(
              getCurrentSettings,
              saveSettingsFn,
              'enabledFolders',
              newFolders
            );
            refreshDisplay();
          })
      );
    });
  };

  const renderSettings = (containerEl: HTMLElement) => {
    containerEl.empty();
    containerEl.createEl('h2', { text: 'R2 Image Uploader Settings' });

    const currentSettings = getCurrentSettings();

    renderEndpointSetting(containerEl, currentSettings);
    renderCredentialSettings(containerEl, currentSettings);
    renderBucketSettings(containerEl, currentSettings);
    renderPathSettings(containerEl, currentSettings);
    renderFolderSettings(containerEl, currentSettings);
  };

  return {
    display: (containerEl: HTMLElement): void => {
      displayContainer = containerEl;
      renderSettings(containerEl);
    },
  };
};
