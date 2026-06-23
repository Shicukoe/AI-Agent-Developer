import { childLogger } from '../utils/logger.js';
import type { TrelloAttachment } from '../trello/types.js';

const log = childLogger('vision');

export interface VisualAnalysis {
  screenName: string;
  components: string[];
  issues: string[];
  layoutNotes: string;
  colorTokens: string[];
  rawDescription: string;
}

// Vision API not used — attachments are described by metadata.
// Claude CLI DevAgent/BusinessAnalyst can follow up by reading the attachment URLs if needed.
export const DesignAnalyzer = {
  async analyzeDesignAttachments(attachments: TrelloAttachment[], _codeContext: string): Promise<string> {
    if (attachments.length === 0) return '(no attachments)';

    log.info({ count: attachments.length }, 'Listing design attachments (no vision processing)');

    const lines = attachments.map(a =>
      `- **${a.name}** (${a.mimeType}, ${Math.round(a.bytes / 1024)}KB) — URL: ${a.url}`
    );

    return `The following design files are attached to the card. Inspect them manually or reference by URL:\n${lines.join('\n')}`;
  },

  async analyzeBugScreenshot(attachments: TrelloAttachment[], cardDescription: string): Promise<VisualAnalysis> {
    const imageAttachments = attachments.filter(a =>
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(a.mimeType)
    );

    if (imageAttachments.length === 0) {
      return { screenName: 'unknown', components: [], issues: [], layoutNotes: '', colorTokens: [], rawDescription: '' };
    }

    // Return lightweight metadata — the CLI DevAgent prompt will include the attachment URLs
    // for Claude to reference (Claude CLI cannot process binary images via stdin)
    const names = imageAttachments.map(a => a.name).join(', ');
    const rawDescription = `Screenshots attached: ${names}. See card description for details: ${cardDescription.slice(0, 300)}`;

    log.debug({ attachments: names }, 'Bug screenshot listed (no vision processing)');

    return {
      screenName: imageAttachments[0].name,
      components: [],
      issues: [],
      layoutNotes: '',
      colorTokens: [],
      rawDescription,
    };
  },
};
