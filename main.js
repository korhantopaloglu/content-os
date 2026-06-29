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
