# Obsidian R2 Uploader

Obsidian plugin that uploads images to Cloudflare R2 and converts `[[image]]` links to `![image](URL)` format.

## Setup

### R2 Bucket Configuration

1. Create a Cloudflare R2 bucket
2. Add CORS policy

```json
[
  {
    "AllowedOrigins": ["app://obsidian.md"],
    "AllowedMethods": ["PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Plugin Settings

#### Required

- R2 Endpoint
- Access Key ID
- Secret Access Key
- Bucket Name

#### Optional

- Custom Domain
- Path Prefix
- Enabled Folders (restrict to specific folders)
- Year Subdirectory (organize by year)

## Usage

- Drag & Drop: Drag image files into markdown editor
- Clipboard Paste: Paste copied images (Ctrl+V / Cmd+V)

Images are automatically uploaded with unique filenames and markdown links are inserted.

## Installation

```bash
git clone https://github.com/hnagato/obsidian-r2-uploader.git
cd obsidian-r2-uploader
npm install && npm run build

# Copy to your vault
cp main.js manifest.json /path/to/vault/.obsidian/plugins/obsidian-r2-uploader/
```

Restart Obsidian and enable the plugin in settings.

## AWS S3 Compatibility

> [!WARNING]
> This plugin uses the AWS S3 SDK and may work with AWS S3, but has only been tested with Cloudflare R2. Use with AWS S3 at your own risk.
