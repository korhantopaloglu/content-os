/**
 * Content OS — configuration and script property helpers.
 */

function getScriptProperty_(key, required) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (required && !value) {
    throw new Error('Missing required script property: ' + key);
  }
  return value || '';
}

function getContentOsSpreadsheetId_() {
  return getScriptProperty_('CONTENT_OS_SPREADSHEET_ID', true);
}

function getContentOsSpreadsheet_() {
  const spreadsheetId = getContentOsSpreadsheetId_();
  Logger.log('Opening Content OS spreadsheet: ' + spreadsheetId);
  return SpreadsheetApp.openById(spreadsheetId);
}

function getVideoJobsRootFolderId_() {
  return getScriptProperty_('CONTENT_VIDEO_JOBS_ROOT_FOLDER_ID', true);
}

function getVideoJobsRootFolder_() {
  const folderId = getVideoJobsRootFolderId_();
  Logger.log('Opening video jobs root folder: ' + folderId);
  return DriveApp.getFolderById(folderId);
}

function getCloudRunTriggerUrl_() {
  return getScriptProperty_('CONTENT_CLOUD_RUN_TRIGGER_URL', false);
}

function getCloudRunTriggerToken_() {
  return getScriptProperty_('CONTENT_CLOUD_RUN_TRIGGER_TOKEN', false);
}

function getSlackSigningSecret_() {
  return getScriptProperty_('SLACK_SIGNING_SECRET', false);
}
