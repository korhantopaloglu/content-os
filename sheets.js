/**
 * Content OS — spreadsheet sheet access helpers.
 */

var SHEET_NAMES = {
  VIDEO_JOBS: 'VideoJobs',
  DEFINITIONS: 'Definitions',
  CONFIG: 'Config',
  LOGS: 'Logs',
};

function getSheetByName_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found (exact name required): ' + sheetName);
  }
  return sheet;
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('Creating sheet: ' + sheetName);
    sheet = spreadsheet.insertSheet(sheetName);
  }
  return sheet;
}

function formatHeaderRow_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setFontWeight('bold');
  sheet.autoResizeColumns(1, columnCount);
}

function writeHeadersIfEmpty_(sheet, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeaderRow_(sheet, headers.length);
    return;
  }

  const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const matches = headers.every(function (header, index) {
    return String(existing[index] || '') === header;
  });

  if (!matches) {
    Logger.log('Updating headers on sheet: ' + sheet.getName());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    formatHeaderRow_(sheet, headers.length);
  } else {
    formatHeaderRow_(sheet, headers.length);
  }
}

function getSheetDataAsObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const rows = [];

  for (var i = 1; i < values.length; i++) {
    const row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = values[i][j];
    }
    rows.push(row);
  }

  return rows;
}

function getColumnIndexMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return {};
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach(function (header, index) {
    map[header] = index + 1;
  });
  return map;
}
