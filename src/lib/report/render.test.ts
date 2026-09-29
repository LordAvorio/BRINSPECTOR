import { describe, expect, it } from 'vitest';
import { renderPdf } from './render';

describe('renderPdf', () => {
  it('renders a real PDF with pdfmake', async () => {
    const blob = await renderPdf({ content: [{ text: 'BRINSPECTOR <script>alert(1)</script> ✓ Saldo' }] });
    const header = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(header).toBe('%PDF-');
  }, 30_000);
});
