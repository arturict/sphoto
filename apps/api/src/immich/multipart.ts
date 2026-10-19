import { Readable } from 'node:stream';

export interface MultipartFile {
  field: string;
  filename: string;
  contentType: string;
  stream: ReadableStream<Uint8Array>;
}

const escapeQuotes = (value: string) => value.replace(/["\r\n]/g, '_');

// Builds a streaming multipart/form-data body. FormData would buffer the whole file in
// memory, which is not acceptable for multi-gigabyte videos.
export function multipartBody(
  boundary: string,
  fields: Record<string, string>,
  file: MultipartFile,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  async function* chunks(): AsyncGenerator<Uint8Array> {
    for (const [name, value] of Object.entries(fields)) {
      yield encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${escapeQuotes(name)}"\r\n\r\n${value}\r\n`);
    }
    yield encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${escapeQuotes(file.field)}"; filename="${escapeQuotes(file.filename)}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n`,
    );
    const reader = file.stream.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
    yield encoder.encode(`\r\n--${boundary}--\r\n`);
  }
  return Readable.toWeb(Readable.from(chunks())) as ReadableStream<Uint8Array>;
}
