import { describe, expect, it } from 'vitest';
import { multipartBody } from './multipart';

const streamOf = (...parts: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });

describe('multipartBody', () => {
  it('produces a body that standard FormData parsing accepts, including binary-safe file content', async () => {
    const body = multipartBody(
      'xyz',
      { fileCreatedAt: '2024-01-02T03:04:05.000Z', isFavorite: 'true' },
      { field: 'assetData', filename: 'IMG "1".jpg', contentType: 'application/octet-stream', stream: streamOf('abc', 'def') },
    );
    const response = new Response(body, { headers: { 'content-type': 'multipart/form-data; boundary=xyz' } });
    const form = await response.formData();
    expect(form.get('fileCreatedAt')).toBe('2024-01-02T03:04:05.000Z');
    expect(form.get('isFavorite')).toBe('true');
    const file = form.get('assetData');
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('IMG _1_.jpg');
    expect(await (file as File).text()).toBe('abcdef');
  });
});
