import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderToReadableStreamMock } = vi.hoisted(() => ({
  renderToReadableStreamMock: vi.fn(),
}));

vi.mock('react-dom/server', () => ({
  renderToReadableStream: renderToReadableStreamMock,
}));

vi.mock('isbot', () => ({
  isbot: vi.fn(() => false),
}));

import handleRequest from '~/entry.server';

function createMockStream(): ReadableStream<Uint8Array> & {
  allReady: Promise<void>;
} {
  const stream = new ReadableStream<Uint8Array>();
  return Object.assign(stream, {
    allReady: Promise.resolve(),
  });
}

describe('entry.server', () => {
  beforeEach(() => {
    renderToReadableStreamMock.mockReset();
    renderToReadableStreamMock.mockResolvedValue(createMockStream());
  });

  it('renders the server router without document security headers', async () => {
    const responseHeaders = new Headers();

    const response = await handleRequest(
      new Request('https://inlinepdf.example/'),
      200,
      responseHeaders,
      { isSpaMode: true } as never,
    );

    const routerElement = renderToReadableStreamMock.mock.calls[0]?.[0] as
      | {
          props?: {
            nonce?: string;
          };
        }
      | undefined;

    expect(routerElement?.props?.nonce).toBeUndefined();
    expect(response.headers.get('Content-Security-Policy')).toBeNull();
  });
});
