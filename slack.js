/**
 * Content OS — Slack slash command integration (/cos).
 */

function doPost(e) {
  Logger.log('doPost received');
  try {
    return handleSlackPost(e);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    appendLog('error', 'doPost failed', { error: err.message });
    return createSlackTextResponse_('Content OS error: ' + err.message);
  }
}

function handleSlackPost(e) {
  const params = parseSlackRequestParams_(e);
  Logger.log('Slack params: ' + JSON.stringify(params));

  if (!verifySlackRequest_(e)) {
    appendLog('warn', 'Slack request verification failed', {});
    return createSlackTextResponse_('Invalid Slack request signature.');
  }

  const text = (params.text || '').trim();
  const context = {
    channelId: params.channel_id || '',
    userId: params.user_id || '',
    threadTs: params.thread_ts || params.message_ts || '',
    command: params.command || '',
    responseUrl: params.response_url || '',
  };

  const responseText = handleCosCommand(text, context);
  return createSlackTextResponse_(responseText);
}

function parseSlackRequestParams_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  const contents = e.postData.contents;
  const params = {};

  contents.split('&').forEach(function (pair) {
    const parts = pair.split('=');
    const key = decodeURIComponent(parts[0] || '');
    const value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
    params[key] = value;
  });

  return params;
}

function verifySlackRequest_(e) {
  const signingSecret = getSlackSigningSecret_();
  if (!signingSecret) {
    Logger.log('SLACK_SIGNING_SECRET not configured — skipping verification');
    return true;
  }

  // TODO: Implement Slack signing secret verification when SLACK_SIGNING_SECRET is configured.
  Logger.log('SLACK_SIGNING_SECRET is set but verification is not yet implemented');
  return true;
}

function createSlackTextResponse_(text) {
  return ContentService.createTextOutput(JSON.stringify({
    response_type: 'ephemeral',
    text: text,
  })).setMimeType(ContentService.MimeType.JSON);
}

function handleCosCommand(text, context) {
  Logger.log('handleCosCommand: ' + text);

  if (!text) {
    return formatCosHelpMessage_();
  }

  const parts = text.trim().split(/\s+/);
  if (parts[0] === '-v') {
    return handleVideoCommand(parts.slice(1), context);
  }

  return 'Unknown command. Use /cos -v create|process|status';
}

function formatCosHelpMessage_() {
  return [
    'Content OS',
    '',
    'Video commands:',
    '• /cos -v create <driveFolderUrl|photosAlbumUrl|sourceFolderName>',
    '• /cos -v process <jobId>',
    '• /cos -v status',
    '• /cos -v status <jobId>',
  ].join('\n');
}

function handleVideoCommand(args, context) {
  const subcommand = (args[0] || '').toLowerCase();

  if (subcommand === 'create') {
    return handleVideoCreateCommand_(args.slice(1), context);
  }

  if (subcommand === 'process') {
    return handleVideoProcessCommand_(args.slice(1), context);
  }

  if (subcommand === 'status') {
    return handleVideoStatusCommand_(args.slice(1), context);
  }

  return 'Unknown video command. Use: create, process, or status';
}

function handleVideoCreateCommand_(args, context) {
  const sourceInput = args.join(' ').trim();

  if (!sourceInput) {
    return 'Usage: /cos -v create <driveFolderUrl|photosAlbumUrl|sourceFolderName>';
  }

  const result = createVideoWorkspaceJob_(sourceInput, context);
  if (!result.ok) {
    return result.message;
  }

  return formatWorkspaceCreatedSlackMessage_(result.job, result.workspace);
}

function handleVideoProcessCommand_(args, context) {
  const jobId = (args[0] || '').trim();

  if (!jobId) {
    return 'Usage: /cos -v process <jobId>';
  }

  const result = processVideoJob_(jobId, context);
  if (!result.ok) {
    return result.message;
  }

  if (result.jobKind === 'story_pack') {
    return formatStoryJobQueuedSlackMessage_(result.job, result.triggerResult);
  }

  if (result.jobKind === 'reel_from_story_pack') {
    return formatReelJobQueuedSlackMessage_(result.job, result.triggerResult);
  }

  return 'Job processed: ' + jobId;
}

function handleVideoStatusCommand_(args, context) {
  const jobId = (args[0] || '').trim();

  if (jobId) {
    const job = getVideoJobById_(jobId);
    if (!job) {
      return 'Video job not found: ' + jobId;
    }
    return formatVideoJobDetailSlackMessage_(job);
  }

  const jobs = getLatestVideoJobs_(10);
  return formatLatestJobsSlackMessage_(jobs);
}

// Backward-compatible alias for any existing deployments referencing handleContentCommand.
function handleContentCommand(text, context) {
  return handleCosCommand(text, context);
}
