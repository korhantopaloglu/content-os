/**
 * Content OS — structured logging to the Logs sheet.
 */

var LOG_HEADERS = ['timestamp', 'level', 'message', 'contextJson'];

function appendLog(level, message, context) {
  const spreadsheet = getContentOsSpreadsheet_();
  const sheet = getSheetByName_(spreadsheet, SHEET_NAMES.LOGS);
  const contextJson = context ? JSON.stringify(context) : '';

  Logger.log('[' + level + '] ' + message + (contextJson ? ' ' + contextJson : ''));

  sheet.appendRow([
    new Date(),
    level,
    message,
    contextJson,
  ]);
}
