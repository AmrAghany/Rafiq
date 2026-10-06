// Parser for the coach-chat Server-Sent Events stream. Pure, so it can be fed arbitrary
// network chunks (events may be split anywhere).

export interface SseEvent {
  event: string;
  data: unknown;
}

/** Splits complete events off the buffer; returns them and whatever is left over. */
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = [];
  const normalised = buffer.replace(/\r\n/g, '\n');
  const blocks = normalised.split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) continue;
    const raw = dataLines.join('\n');
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // keep the raw string
    }
    events.push({ event, data });
  }
  return { events, rest };
}

/** "rtl" when the first letter is Arabic-script, so each chat bubble reads naturally. */
export function textDirection(text: string): 'rtl' | 'ltr' {
  const m = /[A-Za-zÀ-ɏ֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.exec(text);
  return m && /[֐-׿؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(m[0]) ? 'rtl' : 'ltr';
}
