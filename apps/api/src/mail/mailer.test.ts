import { describe, expect, it } from 'vitest';
import { toHtml } from './mailer';

describe('toHtml', () => {
  it('escapes markup, keeps line breaks and links URLs', () => {
    const html = toHtml('Hallo <b>Welt</b>\nZeile 2\n\nLink: https://example.com/a?b=1&c=2');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;Welt&lt;/b&gt;<br>Zeile 2');
    expect(html).toContain('<a href="https://example.com/a?b=1&amp;c=2">');
  });
});
