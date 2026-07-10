/**
 * Content OS — setup functions and test entry points.
 */

var CONFIG_HEADERS = ['key', 'value', 'description', 'updatedAt'];

function setupContentOs() {
  Logger.log('Starting setupContentOs');

  const spreadsheet = getContentOsSpreadsheet_();
  Logger.log('Spreadsheet: ' + spreadsheet.getName());

  setupVideoJobsSheet();
  setupDefinitionsSheet();
  setupConfigSheet();
  setupLogsSheet();

  appendLog('info', 'Content OS setup completed', {
    spreadsheetId: spreadsheet.getId(),
  });

  Logger.log('setupContentOs completed');
  return 'Content OS setup completed for spreadsheet: ' + spreadsheet.getName();
}

function setupVideoJobsSheet() {
  const spreadsheet = getContentOsSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.VIDEO_JOBS);
  writeHeadersIfEmpty_(sheet, VIDEO_JOB_HEADERS);
  Logger.log('VideoJobs sheet ready');
}

function setupDefinitionsSheet() {
  const spreadsheet = getContentOsSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.DEFINITIONS);
  populateDefinitionsSheet_(sheet);
  Logger.log('Definitions sheet ready');
}

function setupConfigSheet() {
  const spreadsheet = getContentOsSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.CONFIG);
  writeHeadersIfEmpty_(sheet, CONFIG_HEADERS);
  Logger.log('Config sheet ready');
}

function setupLogsSheet() {
  const spreadsheet = getContentOsSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, SHEET_NAMES.LOGS);
  writeHeadersIfEmpty_(sheet, LOG_HEADERS);
  Logger.log('Logs sheet ready');
}

function testSetupContentOs() {
  const result = setupContentOs();
  Logger.log(result);
  return result;
}

function testValidateVideoJobsRoot() {
  const result = validateVideoJobsRootFolder_();
  Logger.log(JSON.stringify(result));
  appendLog('info', 'Validated video jobs root folder', result);
  return result;
}

function testLatestVideoJobs() {
  const jobs = getLatestVideoJobs_(10);
  Logger.log('Latest jobs: ' + JSON.stringify(jobs));
  return jobs;
}

function testCreateReelJobFromStoryPack(jobId) {
  const result = createReelJobFromStoryPack_(jobId);
  Logger.log(JSON.stringify(result));
  return result;
}

function testCompleteStoryPackJob(jobId) {
  const result = handleStoryPackJobCompleted_(jobId);
  Logger.log(JSON.stringify(result));
  if (result.reelJob) {
    Logger.log(formatReelJobCreatedSlackMessage_(result.reelJob));
  }
  return result;
}

function testNormalizeSlackInput() {
  const cases = [
  {
    input: '<https://photos.google.com/album/abc|photos.google.com/album/abc>',
    expected: 'https://photos.google.com/album/abc',
  },
  {
    input: '<https://drive.google.com/drive/folders/abc>',
    expected: 'https://drive.google.com/drive/folders/abc',
  },
  {
    input: 'My Folder Name',
    expected: 'My Folder Name',
  },
  ];

  const results = cases.map(function (testCase) {
    const actual = normalizeSlackInput_(testCase.input);
    const passed = actual === testCase.expected;
    Logger.log((passed ? 'PASS' : 'FAIL') + ': ' + testCase.input + ' => ' + actual);
    return {
      input: testCase.input,
      expected: testCase.expected,
      actual: actual,
      passed: passed,
    };
  });

  return results;
}

function testCreatePhotosGoogleComAlbum() {
  const slackWrapped = '<https://photos.google.com/album/abc123|photos.google.com/album/abc123>';
  const normalized = normalizeSlackInput_(slackWrapped);
  const isPhotosUrl = isGooglePhotosAlbumUrl_(normalized);
  const resolved = resolveSourceInputForCreate_(normalized);

  Logger.log('normalized: ' + normalized);
  Logger.log('isGooglePhotosAlbumUrl_: ' + isPhotosUrl);
  Logger.log('resolved: ' + JSON.stringify(resolved));

  return {
    normalized: normalized,
    isPhotosUrl: isPhotosUrl,
    resolved: resolved,
    passed: isPhotosUrl && resolved.ok && resolved.sourceType === 'GooglePhotosAlbum',
  };
}
