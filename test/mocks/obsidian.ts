// Mock classes for Obsidian API - enables unit testing without Obsidian runtime
export class Notice {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for Obsidian API compatibility
  constructor(_message: string, _timeout?: number) {}
  hide() {}
}

type MockApp = Record<string, unknown>;
type MockManifest = Record<string, unknown>;
type MockData = Record<string, unknown>;

type MockTextComponent = {
  inputEl: HTMLInputElement;
  setPlaceholder: (placeholder: string) => MockTextComponent;
  setValue: (value: string) => MockTextComponent;
  onChange: (fn: (value: string) => void) => MockTextComponent;
};

type MockToggleComponent = {
  setValue: (value: boolean) => MockToggleComponent;
  onChange: (fn: (value: boolean) => void) => MockToggleComponent;
};

type MockButtonComponent = {
  setButtonText: (text: string) => MockButtonComponent;
  setWarning: () => MockButtonComponent;
  onClick: (fn: () => void) => MockButtonComponent;
};

export class Plugin {
  app: MockApp = {
    workspace: {
      getActiveFile: (): null => null,
      getActiveViewOfType: (): null => null,
      on: () => ({ unload: () => {} }),
    },
  };
  manifest: MockManifest = {};

  async loadData(): Promise<MockData> {
    return {};
  }

  async saveData(_data: MockData): Promise<void> {}

  addSettingTab(_settingTab: PluginSettingTab): void {}

  registerEvent(_eventRef: unknown): void {}
}

export class PluginSettingTab {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for API compatibility
  constructor(_app: MockApp, _plugin: Plugin) {}

  display(): void {}

  containerEl = {
    empty: () => {},
    createEl: () => ({}),
  };
}

export class Setting {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for API compatibility
  constructor(_containerEl: HTMLElement) {}

  setName(_name: string): Setting {
    return this;
  }

  setDesc(_desc: string): Setting {
    return this;
  }

  addText(fn: (text: MockTextComponent) => void): Setting {
    const textComponent = {
      inputEl: document.createElement('input'),
      setPlaceholder: (_placeholder: string) => textComponent,
      setValue: (_value: string) => textComponent,
      onChange: (_fn: (value: string) => void) => textComponent,
    };
    fn(textComponent);
    return this;
  }

  addToggle(fn: (toggle: MockToggleComponent) => void): Setting {
    const toggleComponent = {
      setValue: (_value: boolean) => toggleComponent,
      onChange: (_fn: (value: boolean) => void) => toggleComponent,
    };
    fn(toggleComponent);
    return this;
  }

  addButton(fn: (button: MockButtonComponent) => void): Setting {
    const buttonComponent = {
      setButtonText: (_text: string) => buttonComponent,
      setWarning: () => buttonComponent,
      onClick: (_fn: () => void) => buttonComponent,
    };
    fn(buttonComponent);
    return this;
  }
}

export class MarkdownView {
  editor = {
    getCursor: () => ({ line: 0, ch: 0 }),
    replaceRange: (_text: string, _cursor: { line: number; ch: number }) => {},
  };
}

export class Modal {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for API compatibility
  constructor(_app: MockApp) {}

  open(): void {}

  close(): void {}
}

export class FuzzySuggestModal<T> extends Modal {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for parent class compatibility
  constructor(app: MockApp) {
    super(app);
  }

  setPlaceholder(_text: string): void {}

  getItems(): T[] {
    return [];
  }

  getItemText(_item: T): string {
    return '';
  }

  onChooseItem(_item: T): void {}
}

export class AbstractInputSuggest<T> {
  // biome-ignore lint/complexity/noUselessConstructor: Mock class needs constructor for API compatibility
  constructor(_app: MockApp, _inputEl: HTMLInputElement) {}

  protected getSuggestions(_query: string): T[] {
    return [];
  }

  renderSuggestion(_item: T, _el: HTMLElement): void {}

  selectSuggestion(_item: T): void {}

  close(): void {}
}

export type TFolder = {
  path: string;
};

export type Editor = {
  getCursor: () => { line: number; ch: number };
  replaceRange: (text: string, cursor: { line: number; ch: number }) => void;
};

export type MarkdownFileInfo = Record<string, never>;
