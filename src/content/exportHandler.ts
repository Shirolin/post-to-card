/**
 * The bridge between a resolved thread and the export engine.
 *
 * Separate from `index.ts` because that entry runs the content script at import
 * time; a module that can be imported without mounting anything is what lets
 * the naming rule be tested on its own.
 *
 * The export's own options arrive per call, not when the card opens. They used
 * to be a `preferHighResolution` promise bound here at open time, which gave one
 * preference two answers: the panel's size readout followed the live config
 * while the file used the snapshot, so turning the switch on and pressing copy
 * named a different pixel count than the one written. A value the panel already
 * holds needs no promise, and a copy taken here can only go stale.
 */

import { buildExportFilename } from './engine/filename.ts';
import {
  exportCard,
  type ExportAction,
  type ExportOutcome,
  type ExportRequestOptions,
} from './engine/export.ts';
import { threadSession } from './threadSession.ts';
import type { ThreadData } from '../types/tweet.ts';

/**
 * Binds an export handler to the thread it will export.
 *
 * The name is built here rather than in the panel because this is the layer
 * that knows which tweet the card is about, and because the panel's `onExport`
 * is a seam tests replace -- naming inside it would be bypassed by every test.
 * The thread's selection state is deliberately not consulted: the filename
 * should describe the post, not a checkbox someone toggled for this session.
 * The post itself is the one the thread is about, which the session names.
 */
export function createExportHandler(
  threadData: ThreadData
): (target: HTMLElement, action: ExportAction, request?: ExportRequestOptions) => Promise<ExportOutcome> {
  return (target, action, request) => {
    const tweet = threadSession(threadData, undefined).targetTweet;
    return exportCard(target, {
      action,
      ...request,
      filename: buildExportFilename({
        handle: tweet?.author?.handle ?? threadData.author.handle,
        text: tweet?.text,
        timestamp: tweet?.timestamp,
      }),
    });
  };
}
