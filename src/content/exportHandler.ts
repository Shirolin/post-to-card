/**
 * The bridge between a resolved thread and the export engine.
 *
 * Separate from `index.ts` because that entry runs the content script at import
 * time; a module that can be imported without mounting anything is what lets
 * the naming rule be tested on its own.
 */

import { buildExportFilename } from './engine/filename.ts';
import { exportCard, type ExportAction, type ExportOutcome } from './engine/export.ts';
import { threadSession } from './threadSession.ts';
import type { ThreadData } from '../types/tweet.ts';

/**
 * What the entry point knows that the handler is handed once.
 *
 * `preferHighResolution` is a promise rather than a value because the click that starts
 * the export is also the click that has to claim the clipboard: awaiting storage
 * first would spend the user's activation on a round trip and lose it. The
 * setting only picks the scale, which is decided seconds later anyway.
 */
export interface ExportHandlerOptions {
  /** `preferHighResolution`, still being read from storage. */
  preferHighResolution?: Promise<boolean>;
}

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
  threadData: ThreadData,
  options: ExportHandlerOptions = {}
): (target: HTMLElement, action: ExportAction) => Promise<ExportOutcome> {
  return (target, action) => {
    const tweet = threadSession(threadData, undefined).targetTweet;
    return exportCard(target, {
      action,
      preferHighResolution: options.preferHighResolution,
      filename: buildExportFilename({
        handle: tweet?.author?.handle ?? threadData.author.handle,
        text: tweet?.text,
        timestamp: tweet?.timestamp,
      }),
    });
  };
}
