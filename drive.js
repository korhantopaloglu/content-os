/**
 * Content OS — Google Drive helpers for video job workspaces.
 */

function parseDriveFolderIdFromUrl_(url) {
  if (!url) {
    return null;
  }

  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) {
    return folderMatch[1];
  }

  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return idMatch[1];
  }

  return null;
}

function isGoogleDriveFolderUrl_(text) {
  return /drive\.google\.com/i.test(text) && /\/folders\//i.test(text);
}

function isGooglePhotosAlbumUrl_(text) {
  return /photos\.app\.goo\.gl/i.test(text);
}

function getDriveFolderUrl_(folderId) {
  return 'https://drive.google.com/drive/folders/' + folderId;
}

function getDriveFileUrl_(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

function findChildFolderCaseInsensitive_(parentFolder, targetName) {
  const folders = parentFolder.getFolders();
  const lowerTarget = targetName.toLowerCase();

  while (folders.hasNext()) {
    const folder = folders.next();
    if (folder.getName().toLowerCase() === lowerTarget) {
      return folder;
    }
  }

  return null;
}

function findReadmeFile_(folder) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    for (var i = 0; i < README_FILE_NAMES.length; i++) {
      if (name === README_FILE_NAMES[i]) {
        return file;
      }
    }
  }

  return null;
}

function findSourceJsonFile_(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().toLowerCase() === 'source.json') {
      return file;
    }
  }
  return null;
}

function findRawFolder_(folder) {
  for (var i = 0; i < RAW_FOLDER_NAMES.length; i++) {
    const rawFolder = findChildFolderCaseInsensitive_(folder, RAW_FOLDER_NAMES[i]);
    if (rawFolder) {
      return rawFolder;
    }
  }
  return null;
}

function hasSupportedVideoFile_(folder) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName().toLowerCase();

    for (var i = 0; i < SUPPORTED_VIDEO_EXTENSIONS.length; i++) {
      if (name.endsWith(SUPPORTED_VIDEO_EXTENSIONS[i])) {
        return true;
      }
    }
  }

  return false;
}

function getOrCreateChildFolder_(parentFolder, folderName) {
  const existing = findChildFolderCaseInsensitive_(parentFolder, folderName);
  if (existing) {
    return existing;
  }

  Logger.log('Creating folder: ' + folderName + ' under ' + parentFolder.getName());
  return parentFolder.createFolder(folderName);
}

function ensureWorkspaceFolderStructure_(workspaceFolder) {
  getOrCreateChildFolder_(workspaceFolder, 'edited');
  const edited = findChildFolderCaseInsensitive_(workspaceFolder, 'edited');
  getOrCreateChildFolder_(edited, 'stories');
  getOrCreateChildFolder_(edited, 'reel');
  getOrCreateChildFolder_(edited, 'metadata');
  return edited.getId();
}

function resolveDriveFolderByName_(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return null;
}

function resolveSourceInputForCreate_(input) {
  if (isGooglePhotosAlbumUrl_(input)) {
    return {
      ok: true,
      sourceType: 'GooglePhotosAlbum',
      sourceUrl: input,
      photosAlbumUrl: input,
    };
  }

  if (isGoogleDriveFolderUrl_(input)) {
    const folderId = parseDriveFolderIdFromUrl_(input);
    if (!folderId) {
      return { ok: false, error: 'Could not parse Google Drive folder ID from URL.' };
    }

    try {
      const folder = DriveApp.getFolderById(folderId);
      return {
        ok: true,
        sourceType: 'DriveFolder',
        sourceUrl: getDriveFolderUrl_(folderId),
        sourceFolderId: folderId,
        sourceFolderName: folder.getName(),
        folder: folder,
      };
    } catch (err) {
      return { ok: false, error: 'Drive folder not found or not accessible: ' + folderId };
    }
  }

  const folder = resolveDriveFolderByName_(input);
  if (!folder) {
    return {
      ok: false,
      error: 'Source folder "' + input + '" not found in Drive.',
    };
  }

  return {
    ok: true,
    sourceType: 'DriveFolder',
    sourceUrl: getDriveFolderUrl_(folder.getId()),
    sourceFolderId: folder.getId(),
    sourceFolderName: folder.getName(),
    folder: folder,
  };
}

function buildSourceJson_(sourceInfo) {
  const createdAt = new Date().toISOString();

  if (sourceInfo.sourceType === 'DriveFolder') {
    return {
      sourceType: 'DriveFolder',
      sourceUrl: sourceInfo.sourceUrl,
      sourceFolderId: sourceInfo.sourceFolderId,
      sourceFolderName: sourceInfo.sourceFolderName,
      createdAt: createdAt,
      referenceMode: true,
    };
  }

  return {
    sourceType: 'GooglePhotosAlbum',
    sourceUrl: sourceInfo.sourceUrl,
    photosAlbumUrl: sourceInfo.photosAlbumUrl,
    createdAt: createdAt,
    referenceMode: true,
  };
}

function buildReadmeTemplate_(sourceInfo) {
  const sourceName = sourceInfo.sourceFolderName || sourceInfo.photosAlbumUrl || sourceInfo.sourceUrl;
  const lines = [
    '# Content OS Video Workspace',
    '',
    '## Source',
    '',
    '- **Type:** ' + sourceInfo.sourceType,
    '- **URL:** ' + sourceInfo.sourceUrl,
  ];

  if (sourceInfo.sourceFolderName) {
    lines.push('- **Name:** ' + sourceInfo.sourceFolderName);
  }

  lines.push(
    '',
    '## Topic',
    '',
    'TODO: Describe the topic of this video pack.',
    '',
    '## Important Moments',
    '',
    'TODO: List key moments or clips to highlight.',
    '',
    '## Story Sequence Ideas',
    '',
    'TODO: Outline the story sequence.',
    '',
    '## Story Rules',
    '',
    '- Vertical 9:16 format',
    '- Hook in the first 2 seconds',
    '- Clear captions',
  );

  if (sourceInfo.sourceType === 'GooglePhotosAlbum') {
    lines.push('- Source media is referenced from Google Photos (reference mode — no copies)');
  } else {
    lines.push('- Source media is referenced from Drive (reference mode — no copies)');
  }

  lines.push(
    '',
    '## Reel Rules',
    '',
    '- Max duration: 90 seconds',
    '- Use story outputs from edited/stories/',
    '- Strong opening and CTA',
    '',
    '## Spottakiler Tone',
    '',
    '- Energetic, curious, and approachable',
    '- Science-forward but accessible',
    '- Avoid jargon without explanation',
    '',
    '---',
    '',
    'After editing this README, run:',
    '',
    '`/cos -v process <jobId>`',
  );

  return lines.join('\n');
}

function writeTextFileInFolder_(folder, fileName, content, mimeType) {
  const existing = folder.getFilesByName(fileName);
  while (existing.hasNext()) {
    existing.next().setTrashed(true);
  }

  return folder.createFile(fileName, content, mimeType || 'text/plain');
}

function createJobWorkspace_(jobId, sourceInfo) {
  const root = getVideoJobsRootFolder_();
  const workspaceFolder = root.createFolder(jobId);
  const sourceJson = buildSourceJson_(sourceInfo);

  writeTextFileInFolder_(workspaceFolder, 'README.md', buildReadmeTemplate_(sourceInfo), 'text/markdown');
  writeTextFileInFolder_(workspaceFolder, 'source.json', JSON.stringify(sourceJson, null, 2), 'application/json');
  const outputFolderId = ensureWorkspaceFolderStructure_(workspaceFolder);

  const readmeFile = findReadmeFile_(workspaceFolder);
  const sourceFile = findSourceJsonFile_(workspaceFolder);

  return {
    workspaceFolder: workspaceFolder,
    folderId: workspaceFolder.getId(),
    folderName: jobId,
    folderUrl: getDriveFolderUrl_(workspaceFolder.getId()),
    readmeUrl: readmeFile ? getDriveFileUrl_(readmeFile.getId()) : '',
    sourceJsonUrl: sourceFile ? getDriveFileUrl_(sourceFile.getId()) : '',
    sourceJson: sourceJson,
    outputFolderId: outputFolderId,
  };
}

function readWorkspaceSourceJson_(workspaceFolder) {
  const sourceFile = findSourceJsonFile_(workspaceFolder);
  if (!sourceFile) {
    return null;
  }

  try {
    return JSON.parse(sourceFile.getBlob().getDataAsString());
  } catch (err) {
    Logger.log('Failed to parse source.json: ' + err.message);
    return null;
  }
}

function validateWorkspaceSourceMedia_(workspaceFolder, sourceJson) {
  const rawFolder = findRawFolder_(workspaceFolder);
  if (rawFolder && hasSupportedVideoFile_(rawFolder)) {
    return { ok: true, source: 'raw' };
  }

  if (sourceJson && sourceJson.sourceType === 'DriveFolder' && sourceJson.sourceFolderId) {
    try {
      const sourceFolder = DriveApp.getFolderById(sourceJson.sourceFolderId);
      if (hasSupportedVideoFile_(sourceFolder)) {
        return { ok: true, source: 'drive_reference' };
      }
      return {
        ok: false,
        errors: ['Referenced Drive source folder has no supported video files.'],
      };
    } catch (err) {
      return {
        ok: false,
        errors: ['Referenced Drive source folder is not accessible: ' + sourceJson.sourceFolderId],
      };
    }
  }

  if (sourceJson && sourceJson.sourceType === 'GooglePhotosAlbum') {
    // TODO: Implement Google Photos Picker API import flow for reference validation.
    return {
      ok: false,
      errors: [
        'Google Photos source requires an import step before processing.',
        'Import selected videos into workspace raw/ folder, then run process again.',
      ],
    };
  }

  return {
    ok: false,
    errors: [
      'No source media found. Reference a Drive folder with videos or add videos to workspace raw/.',
    ],
  };
}

function validateWorkspaceForProcess_(workspaceFolder) {
  const errors = [];

  const readme = findReadmeFile_(workspaceFolder);
  if (!readme) {
    errors.push('README.md not found in workspace.');
  }

  const sourceFile = findSourceJsonFile_(workspaceFolder);
  if (!sourceFile) {
    errors.push('source.json not found in workspace.');
  }

  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }

  const sourceJson = readWorkspaceSourceJson_(workspaceFolder);
  if (!sourceJson) {
    errors.push('source.json is invalid or unreadable.');
    return { ok: false, errors: errors };
  }

  const mediaValidation = validateWorkspaceSourceMedia_(workspaceFolder, sourceJson);
  if (!mediaValidation.ok) {
    return { ok: false, errors: mediaValidation.errors };
  }

  return { ok: true, sourceJson: sourceJson, mediaSource: mediaValidation.source };
}

function validateParentStoryOutputs_(parentWorkspaceFolder) {
  const edited = findChildFolderCaseInsensitive_(parentWorkspaceFolder, 'edited');
  if (!edited) {
    return { ok: false, errors: ['Parent workspace edited/ folder not found.'] };
  }

  const stories = findChildFolderCaseInsensitive_(edited, 'stories');
  if (!stories) {
    return { ok: false, errors: ['Parent workspace edited/stories/ folder not found.'] };
  }

  const storyFiles = stories.getFiles();
  if (!storyFiles.hasNext()) {
    return {
      ok: false,
      errors: ['Parent story outputs not found in edited/stories/. Run story processing first.'],
    };
  }

  return { ok: true, storiesFolder: stories };
}

function validateVideoJobsRootFolder_() {
  const root = getVideoJobsRootFolder_();
  return {
    ok: true,
    folderId: root.getId(),
    folderName: root.getName(),
    folderUrl: getDriveFolderUrl_(root.getId()),
  };
}

function getWorkspaceFolderById_(folderId) {
  return DriveApp.getFolderById(folderId);
}
