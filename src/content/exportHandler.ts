/**
 * The bridge between a resolved thread and the export engine.
 *
 * Separate from `index.ts` because that entry runs the content script at import
 * time; a module that can be imported without mounting anything is what lets
 * the naming rule be tested on its own.
 */

import { buildExportFilename } from './engine/filename.ts';
import { exportCard, type ExportAction, type ExportOutcome } from './engine/export.ts';
import type { ThreadData } from '../types/tweet.ts';

/**
 * Binds an export handler to the thread it will export.
 *
 * The name is built here rather than in the panel because this is the layer
 * that knows which tweet the card is about, and because the panel's `onExport`
 * is a seam tests replace -- naming inside it would be bypassed by every test.
 * The thread's selection state is deliberately not consulted: the filename
 * should describe the post, not a checkbox someone toggled for this session.
 */
export function createExportHandler(
  threadData: ThreadData
): (target: HTMLElement, action: ExportAction) => Promise<ExportOutcome> {
  return (target, action) => {
    const tweet =
      threadData.tweets[threadData.targetTweetIndex ?? 0] ?? threadData.tweets[0];
    return exportCard(target, {
      action,
      filename: buildExportFilename({
        handle: tweet?.author?.handle ?? threadData.author.handle,
        text: tweet?.text,
        timestamp: tweet?.timestamp,
      }),
    });
  };
}
