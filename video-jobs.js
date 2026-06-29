/**
 * Content OS — VideoJobs sheet operations and Cloud Run trigger.
 */

var VIDEO_JOB_HEADERS = [
  'jobId',
  'status',
  'jobType',
  'parentJobId',
  'folderName',
  'folderId',
  'inputSourceType',
  'inputSourceUrl',
  'inputDriveFolderId',
  'inputPhotosAlbumUrl',
  'importStatus',
  'importedRawFolderId',
  'sourceLanguage',
  'outputLanguage',
  'storyRequired',
  'reelRequired',
  'storyCount',
  'reelMaxDurationSec',
  'priority',
  'slackChannelId',
  'slackUserId',
  'slackThreadTs',
  'createdAt',
  'startedAt',
  'completedAt',
  'outputFolderId',
  'errorMessage',
  'resultSummary',
];

var DEFAULT_VIDEO_JOB_VALUES = {
  jobType: 'story_pack',
  parentJobId: '',
  sourceLanguage: 'Turkish',
  outputLanguage: 'English',
  storyRequired: true,
  reelRequired: true,
  storyCount: '',
  reelMaxDurationSec: 90,
  priority: 'normal',
  importStatus: 'not_required',
};

function getVideoJobsSheet_() {
  return getSheetByName_(getContentOsSpreadsheet_(), SHEET_NAMES.VIDEO_JOBS);
}

function generateNextVideoJobId_() {
  const sheet = getVideoJobsSheet_();
  const rows = getSheetDataAsObjects_(sheet);
  let maxNumber = 0;

  rows.forEach(function (row) {
    const match = String(row.jobId || '').match(/^VJ-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });

  return 'VJ-' + (maxNumber + 1);
}

function buildVideoJobRow_(overrides) {
  const now = new Date();
  const job = Object.assign({
    createdAt: now,
    startedAt: '',
    completedAt: '',
    outputFolderId: '',
    errorMessage: '',
    resultSummary: '',
    importedRawFolderId: '',
    inputPhotosAlbumUrl: '',
    inputDriveFolderId: '',
    inputSourceUrl: '',
    folderId: '',
    folderName: '',
    parentJobId: '',
    slackChannelId: '',
    slackUserId: '',
    slackThreadTs: '',
    storyCount: '',
  }, DEFAULT_VIDEO_JOB_VALUES, overrides || {});

  const row = VIDEO_JOB_HEADERS.map(function (header) {
    return job[header] !== undefined ? job[header] : '';
  });

  return { job: job, row: row };
}

function appendVideoJob_(overrides) {
  const sheet = getVideoJobsSheet_();
  const jobId = generateNextVideoJobId_();
  const built = buildVideoJobRow_(Object.assign({ jobId: jobId }, overrides));

  sheet.appendRow(built.row);
  Logger.log('Created video job: ' + jobId);

  return Object.assign({ jobId: jobId }, built.job, overrides || {});
}

function updateVideoJobFields_(jobId, fields) {
  const sheet = getVideoJobsSheet_();
  const columnMap = getColumnIndexMap_(sheet);
  const rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][columnMap.jobId - 1]) === jobId) {
      Object.keys(fields).forEach(function (key) {
        if (columnMap[key]) {
          sheet.getRange(i + 1, columnMap[key]).setValue(fields[key]);
        }
      });
      Logger.log('Updated video job ' + jobId + ': ' + JSON.stringify(fields));
      return true;
    }
  }

  return false;
}

function getVideoJobById_(jobId) {
  const rows = getSheetDataAsObjects_(getVideoJobsSheet_());
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].jobId) === jobId) {
      return rows[i];
    }
  }
  return null;
}

function getChildJobsByParentId_(parentJobId) {
  const rows = getSheetDataAsObjects_(getVideoJobsSheet_());
  return rows.filter(function (row) {
    return String(row.parentJobId) === parentJobId;
  });
}

function getLatestVideoJobs_(limit) {
  const rows = getSheetDataAsObjects_(getVideoJobsSheet_());
  return rows.slice(-limit).reverse();
}

function createVideoWorkspaceJob_(sourceInput, slackContext) {
  const resolved = resolveSourceInputForCreate_(sourceInput);
  if (!resolved.ok) {
    return { ok: false, message: resolved.error };
  }

  const jobId = generateNextVideoJobId_();
  const workspace = createJobWorkspace_(jobId, resolved);

  const inputSourceType = resolved.sourceType;
  const importStatus = inputSourceType === 'GooglePhotosAlbum' ? 'required' : 'not_required';

  const job = buildVideoJobRow_(Object.assign({
    jobId: jobId,
    status: 'draft',
    jobType: 'story_pack',
    parentJobId: '',
    folderName: workspace.folderName,
    folderId: workspace.folderId,
    inputSourceType: inputSourceType,
    inputSourceUrl: resolved.sourceUrl,
    inputDriveFolderId: resolved.sourceFolderId || '',
    inputPhotosAlbumUrl: resolved.photosAlbumUrl || '',
    importStatus: importStatus,
    outputFolderId: workspace.outputFolderId,
    slackChannelId: slackContext.channelId || '',
    slackUserId: slackContext.userId || '',
    slackThreadTs: slackContext.threadTs || '',
  })).row;

  getVideoJobsSheet_().appendRow(job);

  const jobRecord = getVideoJobById_(jobId);
  appendLog('info', 'Video workspace created', {
    jobId: jobId,
    folderId: workspace.folderId,
    sourceType: inputSourceType,
  });

  return {
    ok: true,
    job: jobRecord,
    workspace: workspace,
  };
}

function processVideoJob_(jobId, slackContext) {
  const job = getVideoJobById_(jobId);
  if (!job) {
    return { ok: false, message: 'Video job not found: ' + jobId };
  }

  if (job.jobType === 'story_pack') {
    return processStoryPackJob_(job, slackContext);
  }

  if (job.jobType === 'reel_from_story_pack') {
    return processReelFromStoryPackJob_(job, slackContext);
  }

  return { ok: false, message: 'Unsupported job type: ' + job.jobType };
}

function processStoryPackJob_(job, slackContext) {
  if (job.status !== 'draft' && job.status !== 'ready' && job.status !== 'failed') {
    return {
      ok: false,
      message: 'Job ' + job.jobId + ' cannot be processed from status: ' + job.status,
    };
  }

  let workspaceFolder;
  try {
    workspaceFolder = getWorkspaceFolderById_(job.folderId);
  } catch (err) {
    return { ok: false, message: 'Workspace folder not found: ' + job.folderId };
  }

  const validation = validateWorkspaceForProcess_(workspaceFolder);
  if (!validation.ok) {
    return {
      ok: false,
      message: 'Workspace validation failed:\n' + validation.errors.join('\n'),
    };
  }

  updateVideoJobFields_(job.jobId, {
    status: 'queued',
    errorMessage: '',
    startedAt: new Date(),
  });

  const updatedJob = getVideoJobById_(job.jobId);
  appendLog('info', 'Story pack job queued', { jobId: job.jobId });

  const triggerResult = triggerCloudRunVideoJob(updatedJob);

  return {
    ok: true,
    job: updatedJob,
    triggerResult: triggerResult,
    jobKind: 'story_pack',
  };
}

function processReelFromStoryPackJob_(job, slackContext) {
  if (!job.parentJobId) {
    return { ok: false, message: 'Reel job ' + job.jobId + ' is missing parentJobId.' };
  }

  const parentJob = getVideoJobById_(job.parentJobId);
  if (!parentJob) {
    return { ok: false, message: 'Parent job not found: ' + job.parentJobId };
  }

  if (parentJob.status !== 'done') {
    return {
      ok: false,
      message: 'Parent story job ' + job.parentJobId + ' is not done yet (status: ' + parentJob.status + ').',
    };
  }

  let parentWorkspace;
  try {
    parentWorkspace = getWorkspaceFolderById_(parentJob.folderId);
  } catch (err) {
    return { ok: false, message: 'Parent workspace folder not found: ' + parentJob.folderId };
  }

  const outputValidation = validateParentStoryOutputs_(parentWorkspace);
  if (!outputValidation.ok) {
    return {
      ok: false,
      message: 'Parent story outputs validation failed:\n' + outputValidation.errors.join('\n'),
    };
  }

  if (job.status !== 'ready' && job.status !== 'failed') {
    return {
      ok: false,
      message: 'Reel job ' + job.jobId + ' cannot be processed from status: ' + job.status,
    };
  }

  updateVideoJobFields_(job.jobId, {
    status: 'queued',
    errorMessage: '',
    startedAt: new Date(),
  });

  const updatedJob = getVideoJobById_(job.jobId);
  appendLog('info', 'Reel job queued', { jobId: job.jobId, parentJobId: job.parentJobId });

  const triggerResult = triggerCloudRunVideoJob(updatedJob);

  return {
    ok: true,
    job: updatedJob,
    triggerResult: triggerResult,
    jobKind: 'reel_from_story_pack',
  };
}

function createReelJobFromStoryPack_(parentJobId) {
  const parentJob = getVideoJobById_(parentJobId);
  if (!parentJob) {
    return { ok: false, message: 'Parent job not found: ' + parentJobId };
  }

  if (parentJob.jobType !== 'story_pack') {
    return { ok: false, message: 'Parent job must be story_pack, got: ' + parentJob.jobType };
  }

  const existingChildren = getChildJobsByParentId_(parentJobId);
  const existingReel = existingChildren.find(function (child) {
    return child.jobType === 'reel_from_story_pack' && child.status !== 'cancelled' && child.status !== 'failed';
  });

  if (existingReel) {
    return { ok: true, job: existingReel, alreadyExists: true };
  }

  const job = appendVideoJob_({
    status: 'ready',
    jobType: 'reel_from_story_pack',
    parentJobId: parentJobId,
    folderName: parentJob.folderName,
    folderId: parentJob.folderId,
    inputSourceType: parentJob.inputSourceType,
    inputSourceUrl: parentJob.inputSourceUrl,
    inputDriveFolderId: parentJob.inputDriveFolderId,
    inputPhotosAlbumUrl: parentJob.inputPhotosAlbumUrl,
    importStatus: parentJob.importStatus,
    sourceLanguage: parentJob.sourceLanguage,
    outputLanguage: parentJob.outputLanguage,
    storyRequired: false,
    reelRequired: true,
    reelMaxDurationSec: parentJob.reelMaxDurationSec,
    priority: parentJob.priority,
    slackChannelId: parentJob.slackChannelId,
    slackUserId: parentJob.slackUserId,
    slackThreadTs: parentJob.slackThreadTs,
    outputFolderId: parentJob.outputFolderId,
  });

  appendLog('info', 'Reel job created from story pack', {
    jobId: job.jobId,
    parentJobId: parentJobId,
  });

  return { ok: true, job: job, alreadyExists: false };
}

function handleStoryPackJobCompleted_(jobId) {
  const job = getVideoJobById_(jobId);
  if (!job) {
    return { ok: false, message: 'Job not found: ' + jobId };
  }

  if (job.jobType !== 'story_pack') {
    return { ok: false, message: 'Job is not a story_pack: ' + job.jobType };
  }

  updateVideoJobFields_(jobId, {
    status: 'done',
    completedAt: new Date(),
  });

  const reelResult = createReelJobFromStoryPack_(jobId);
  appendLog('info', 'Story pack job completed', { jobId: jobId, reelJobId: reelResult.job ? reelResult.job.jobId : '' });

  return {
    ok: true,
    parentJob: getVideoJobById_(jobId),
    reelJob: reelResult.job || null,
    reelAlreadyExists: reelResult.alreadyExists || false,
  };
}

function triggerCloudRunVideoJob(job) {
  const url = getCloudRunTriggerUrl_();
  if (!url) {
    Logger.log('Cloud Run trigger skipped: CONTENT_CLOUD_RUN_TRIGGER_URL is not configured');
    return {
      ok: false,
      skipped: true,
      reason: 'CONTENT_CLOUD_RUN_TRIGGER_URL is not configured',
    };
  }

  const payload = {
    jobId: job.jobId,
    parentJobId: job.parentJobId || '',
    folderId: job.folderId,
    folderName: job.folderName,
    jobType: job.jobType,
    sourceLanguage: job.sourceLanguage || DEFAULT_VIDEO_JOB_VALUES.sourceLanguage,
    outputLanguage: job.outputLanguage || DEFAULT_VIDEO_JOB_VALUES.outputLanguage,
    storyRequired: job.storyRequired !== undefined ? job.storyRequired : DEFAULT_VIDEO_JOB_VALUES.storyRequired,
    reelRequired: job.reelRequired !== undefined ? job.reelRequired : DEFAULT_VIDEO_JOB_VALUES.reelRequired,
    reelMaxDurationSec: job.reelMaxDurationSec || DEFAULT_VIDEO_JOB_VALUES.reelMaxDurationSec,
    slackChannelId: job.slackChannelId || '',
    slackThreadTs: job.slackThreadTs || '',
    referenceMode: true,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const token = getCloudRunTriggerToken_();
  if (token) {
    options.headers = { Authorization: 'Bearer ' + token };
  }

  Logger.log('Triggering Cloud Run for job: ' + job.jobId);

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const body = response.getContentText();

    if (statusCode < 200 || statusCode >= 300) {
      const errorMessage = 'Cloud Run trigger failed (HTTP ' + statusCode + '): ' + body;
      updateVideoJobFields_(job.jobId, {
        status: 'failed',
        errorMessage: errorMessage,
      });
      appendLog('error', 'Cloud Run trigger failed', { jobId: job.jobId, statusCode: statusCode });
      return { ok: false, statusCode: statusCode, error: errorMessage };
    }

    updateVideoJobFields_(job.jobId, { status: 'processing' });
    appendLog('info', 'Cloud Run trigger succeeded', { jobId: job.jobId, statusCode: statusCode });
    return { ok: true, statusCode: statusCode, body: body };
  } catch (err) {
    const errorMessage = 'Cloud Run trigger error: ' + err.message;
    updateVideoJobFields_(job.jobId, {
      status: 'failed',
      errorMessage: errorMessage,
    });
    appendLog('error', 'Cloud Run trigger exception', { jobId: job.jobId, error: err.message });
    return { ok: false, error: errorMessage };
  }
}

function formatVideoJobDetailSlackMessage_(job) {
  const lines = [
    'ID: ' + job.jobId,
    'Type: ' + job.jobType,
    'Parent: ' + (job.parentJobId || '—'),
    'Status: ' + job.status,
    'Source: ' + (job.inputSourceUrl || '—'),
    'Created: ' + formatDateForSlack_(job.createdAt),
  ];

  if (job.folderId) {
    lines.push('Output folder: ' + getDriveFolderUrl_(job.folderId));
  }

  if (job.errorMessage) {
    lines.push('Error: ' + job.errorMessage);
  }

  return lines.join('\n');
}

function formatLatestJobsSlackMessage_(jobs) {
  if (!jobs || jobs.length === 0) {
    return 'No video jobs found yet.';
  }

  const lines = ['Latest video jobs:', ''];
  jobs.forEach(function (job) {
    const parent = job.parentJobId ? ' (parent: ' + job.parentJobId + ')' : '';
    lines.push('• ' + job.jobId + ' — ' + job.jobType + ' — ' + job.status + parent);
  });

  return lines.join('\n');
}

function formatWorkspaceCreatedSlackMessage_(job, workspace) {
  const lines = [
    '📝 Video workspace created: ' + job.jobId,
    '',
    'README:',
    workspace.readmeUrl || getDriveFolderUrl_(workspace.folderId),
    '',
    'Next step:',
    'Update README.md and run:',
    '',
    '/cos -v process ' + job.jobId,
    '',
    'source.json',
  ];

  if (workspace.sourceJsonUrl) {
    lines.push(workspace.sourceJsonUrl);
  }

  if (job.importStatus === 'required') {
    lines.push('');
    lines.push('Note: Google Photos source — import videos into workspace raw/ before processing.');
  }

  return lines.join('\n');
}

function formatStoryJobQueuedSlackMessage_(job, triggerResult) {
  const lines = [
    '🎬 Story job queued: ' + job.jobId,
    '',
    'Status:',
    job.status,
  ];

  if (triggerResult && triggerResult.skipped) {
    lines.push('');
    lines.push('Note: Cloud worker is not configured yet.');
  } else if (triggerResult && !triggerResult.ok) {
    lines.push('');
    lines.push('Note: Cloud worker trigger failed. Check job error message.');
  }

  return lines.join('\n');
}

function formatReelJobCreatedSlackMessage_(reelJob) {
  return [
    '🎞 Reel job created: ' + reelJob.jobId,
    '',
    'Parent: ' + reelJob.parentJobId,
    'Status: ' + reelJob.status,
    '',
    'Next step:',
    '/cos -v process ' + reelJob.jobId,
  ].join('\n');
}

function formatReelJobQueuedSlackMessage_(job, triggerResult) {
  const lines = [
    '🎞 Reel job queued: ' + job.jobId,
    '',
    'Parent: ' + job.parentJobId,
    'Status:',
    job.status,
  ];

  if (triggerResult && triggerResult.skipped) {
    lines.push('');
    lines.push('Note: Cloud worker is not configured yet.');
  } else if (triggerResult && !triggerResult.ok) {
    lines.push('');
    lines.push('Note: Cloud worker trigger failed. Check job error message.');
  }

  return lines.join('\n');
}

function formatDateForSlack_(value) {
  if (!value) {
    return '—';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
