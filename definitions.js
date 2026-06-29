/**
 * Content OS — enum definitions for the Definitions sheet.
 */

var DEFINITION_HEADERS = ['type', 'value', 'label', 'sortOrder', 'isActive'];

var VIDEO_JOB_STATUSES = [
  'draft',
  'ready',
  'queued',
  'processing',
  'done',
  'failed',
  'cancelled',
  'import_required',
];

var INPUT_SOURCE_TYPES = [
  'DriveFolder',
  'GooglePhotosAlbum',
];

var IMPORT_STATUSES = [
  'not_required',
  'required',
  'imported',
  'failed',
];

var JOB_TYPES = [
  'story_pack',
  'reel_from_story_pack',
];

var PRIORITY_VALUES = [
  'low',
  'normal',
  'high',
];

var SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

var README_FILE_NAMES = ['README.md', 'Readme.md', 'readme.md'];

var RAW_FOLDER_NAMES = ['raw', 'Raw', 'RAW'];

function getAllDefinitionRows_() {
  const rows = [];
  let sortOrder = 1;

  VIDEO_JOB_STATUSES.forEach(function (value) {
    rows.push({
      type: 'video_job_status',
      value: value,
      label: value,
      sortOrder: sortOrder++,
      isActive: true,
    });
  });

  sortOrder = 1;
  INPUT_SOURCE_TYPES.forEach(function (value) {
    rows.push({
      type: 'input_source_type',
      value: value,
      label: value,
      sortOrder: sortOrder++,
      isActive: true,
    });
  });

  sortOrder = 1;
  IMPORT_STATUSES.forEach(function (value) {
    rows.push({
      type: 'import_status',
      value: value,
      label: value,
      sortOrder: sortOrder++,
      isActive: true,
    });
  });

  sortOrder = 1;
  JOB_TYPES.forEach(function (value) {
    rows.push({
      type: 'job_type',
      value: value,
      label: value,
      sortOrder: sortOrder++,
      isActive: true,
    });
  });

  sortOrder = 1;
  PRIORITY_VALUES.forEach(function (value) {
    rows.push({
      type: 'priority',
      value: value,
      label: value,
      sortOrder: sortOrder++,
      isActive: true,
    });
  });

  return rows;
}

function populateDefinitionsSheet_(sheet) {
  writeHeadersIfEmpty_(sheet, DEFINITION_HEADERS);

  const rows = getAllDefinitionRows_();
  const values = rows.map(function (row) {
    return [row.type, row.value, row.label, row.sortOrder, row.isActive];
  });

  const lastRow = sheet.getLastRow();
  const dataRowCount = lastRow - 1;
  if (dataRowCount > 0) {
    sheet.getRange(2, 1, dataRowCount, DEFINITION_HEADERS.length).clearContent();
  }

  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, DEFINITION_HEADERS.length).setValues(values);
  }

  formatHeaderRow_(sheet, DEFINITION_HEADERS.length);
  Logger.log('Populated Definitions sheet with ' + values.length + ' rows');
}
