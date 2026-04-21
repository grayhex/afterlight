import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/store', () => ({
  auth: {
    login: vi.fn(),
  },
}));

import { httpClient } from './httpClient';

describe('httpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses GET method by default when method is not provided', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    await httpClient('/health');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
      }),
    );
  });
});
