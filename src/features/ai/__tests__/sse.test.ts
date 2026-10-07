import { parseSse, textDirection } from '../sse';

describe('parseSse', () => {
  it('parses complete events and keeps the remainder', () => {
    const { events, rest } = parseSse(
      'event: delta\ndata: {"text":"Hel"}\n\nevent: delta\ndata: {"text":"lo"}\n\nevent: do',
    );
    expect(events).toEqual([
      { event: 'delta', data: { text: 'Hel' } },
      { event: 'delta', data: { text: 'lo' } },
    ]);
    expect(rest).toBe('event: do');
  });

  it('handles events split across chunks and CRLF line endings', () => {
    let buffer = '';
    const seen: unknown[] = [];
    for (const chunk of [
      'event: delta\r\nda',
      'ta: {"text":"مرحبا"}\r\n',
      '\r\nevent: done\ndata: {"id":"m1"}\n\n',
    ]) {
      const out = parseSse(buffer + chunk);
      buffer = out.rest;
      seen.push(...out.events);
    }
    expect(seen).toEqual([
      { event: 'delta', data: { text: 'مرحبا' } },
      { event: 'done', data: { id: 'm1' } },
    ]);
  });

  it('defaults the event name and keeps non-JSON data as text', () => {
    expect(parseSse('data: hello\n\n').events).toEqual([{ event: 'message', data: 'hello' }]);
    expect(parseSse(': comment\n\n').events).toEqual([]);
  });
});

describe('textDirection', () => {
  it.each([
    ['أنا في مطعم الآن', 'rtl'],
    ['  123 تمرين', 'rtl'],
    ['The bench is busy', 'ltr'],
    ['¿Puedo comer pizza hoy?', 'ltr'],
    ['', 'ltr'],
  ])('%j → %s', (text, dir) => expect(textDirection(text)).toBe(dir));
});
