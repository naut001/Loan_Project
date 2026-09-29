import { expect, it, vi } from 'vitest';
import { createCloudClient } from './cloud';
import { collectReceivable, editReceivable, undoReceivable, validReceivables, type ReceivableDetails } from './receivable';
import { summarize } from './snapshot';

const details: ReceivableDetails = { name: 'An', amount: 100, got: 0, kind: 'once', due: '2026-10-01', startK: '', day: 1, per: 0, inc: true, note: '' };
const original = { v: 1, updatedAt: 1, wallets: [{ id: 'cash', name: 'Ví', opening: 500 }], tx: {}, debts: [], recv: [{ id: 'r', ...details, extra: { retained: true }, log: [] as { d: string; a: number }[] }], plan: { living: 42 } };
const draft = () => structuredClone(original) as Record<string, unknown>;
const reply = (v: unknown) => new Response(JSON.stringify(v));

it('tạo và xoá khoản trống, giữ số đã thu ban đầu và giới hạn 40 lần như legacy', () => {
  const p = draft();
  editReceivable(p, details);
  const added = (p.recv as typeof original.recv)[1];
  expect(added.id).not.toBe('r');
  editReceivable(p, undefined, added.id);
  expect(p.recv).toEqual(original.recv);
  editReceivable(p, { ...details, got: 10 });
  const imported = (p.recv as typeof original.recv)[1];
  for (let i = 0; i < 41; i++) collectReceivable(p, imported.id, 1, '2026-09-29');
  expect(imported.got).toBe(51); expect(imported.log).toHaveLength(40);
  undoReceivable(p, imported.id);
  expect(imported.got).toBe(50); expect(imported.log).toHaveLength(39);
});

it('mất mạng sau PATCH khoá ghi và không tự retry thu hoặc hoàn tác', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload: original, updated_at: '2026-09-29T00:00:00Z' }])).mockRejectedValueOnce(new Error('offline'));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  await expect(client.collectReceivable('r', 20)).rejects.toThrow();
  expect(client.canSave()).toBe(false);
  await expect(client.collectReceivable('r', 20)).rejects.toThrow('tải lại');
  await expect(client.undoReceivable('r')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(3);
  expect(original.recv[0].got).toBe(0);
});

it('ghi thu, hoàn tác đúng lần gần nhất, không phát sinh tiền ví và giữ trường mở rộng', () => {
  const p = draft();
  collectReceivable(p, 'r', 40, '2026-09-29');
  collectReceivable(p, 'r', 20, '2026-09-29');
  expect((p.recv as typeof original.recv)[0]).toMatchObject({ got: 60, extra: { retained: true }, log: [{ a: 40 }, { a: 20 }] });
  expect(summarize(p as never, '2026-09-29')).toMatchObject({ cash: 500, income: 0 });
  undoReceivable(p, 'r');
  expect((p.recv as typeof original.recv)[0]).toMatchObject({ got: 40, log: [{ a: 40 }] });
  expect(p.tx).toEqual({}); expect(p.plan).toEqual(original.plan);
});

it('sửa lịch dự báo nhưng không sửa got trực tiếp hoặc xoá lịch sử', () => {
  const p = draft();
  collectReceivable(p, 'r', 30, '2026-09-29');
  editReceivable(p, { ...details, got: 30, amount: 150, kind: 'plan', startK: '2026-10', day: 31, per: 50, due: '', inc: false }, 'r');
  expect((p.recv as typeof original.recv)[0]).toMatchObject({ amount: 150, got: 30, log: [{ a: 30 }], extra: { retained: true } });
  expect(() => editReceivable(p, { ...details, got: 0 }, 'r')).toThrow('Đã thu');
  expect(() => editReceivable(p, undefined, 'r')).toThrow('lịch sử');
  editReceivable(p, { ...details, amount: 150, got: 30, id: 'forged', log: [] } as ReceivableDetails, 'r');
  expect((p.recv as typeof original.recv)[0]).toMatchObject({ id: 'r', got: 30, log: [{ a: 30 }], extra: { retained: true } });
});

it('chặn số âm, vượt dư, ngày sai, lịch sai, ID lặp và dữ liệu legacy chưa đối chiếu', () => {
  const p = draft(); const before = structuredClone(p);
  for (const a of [0, -1, 101, 1.5, Number.NaN]) expect(() => collectReceivable(p, 'r', a, '2026-09-29')).toThrow();
  expect(() => collectReceivable(p, 'r', 1, '2026-02-30')).toThrow();
  for (const v of [{ amount: -1 }, { got: 101 }, { due: '2026-02-30' }, { kind: 'plan', startK: '2026-00', per: 10 }, { kind: 'plan', startK: '2026-10', per: 10, day: 32 }]) expect(() => editReceivable(p, { ...details, ...v } as ReceivableDetails)).toThrow();
  expect(() => undoReceivable(p, 'r')).toThrow();
  expect(p).toEqual(before);
  const duplicate = draft(); (duplicate.recv as unknown[]).push(structuredClone(original.recv[0]));
  expect(() => collectReceivable(duplicate, 'r', 1, '2026-09-29')).toThrow('không hợp lệ');
  const invalid = draft(); (invalid.recv as typeof original.recv)[0].got = 200;
  expect(() => editReceivable(invalid, details, 'r')).toThrow('không hợp lệ');
});

it('không coi bản ghi thiếu trường hoặc sai kiểu là dữ liệu an toàn để đọc/ghi', () => {
  for (const field of ['inc', 'note', 'startK', 'day', 'per', 'log', 'due'] as const) {
    const p = draft();
    delete (p.recv as Record<string, unknown>[])[0][field];
    const before = structuredClone(p);
    expect(validReceivables(p.recv)).toBe(false);
    expect(() => collectReceivable(p, 'r', 1, '2026-09-29')).toThrow('không hợp lệ');
    expect(p).toEqual(before);
  }
  const p = draft();
  (p.recv as Record<string, unknown>[])[0].inc = 'false';
  expect(validReceivables(p.recv)).toBe(false);
  expect(() => editReceivable(p, details, 'r')).toThrow('không hợp lệ');
  for (const malformed of [{ day: undefined }, { startK: undefined }, { per: -1 }, { startK: '2026-13' }]) {
    const next = draft();
    expect(() => editReceivable(next, { ...details, ...malformed } as ReceivableDetails)).toThrow();
    expect(next).toEqual(original);
  }
});

it('conditional write giữ toàn bộ payload và xung đột không tự gửi lại', async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValueOnce(reply({ access_token: 'token', user: { id: 'u' } })).mockResolvedValueOnce(reply([{ payload: original, updated_at: '2026-09-29T00:00:00Z' }])).mockImplementationOnce(async (_url, options) => reply([{ payload: JSON.parse(String(options?.body)).payload, updated_at: '2026-09-29T01:00:00Z' }])).mockResolvedValueOnce(reply([]));
  const client = createCloudClient('https://test.supabase.co', 'key', request);
  await client.signIn('a', 'b'); await client.load();
  const result = await client.putReceivable({ ...details, amount: 150 }, 'r');
  expect(result.recv).toEqual([{ ...original.recv[0], amount: 150 }]);
  expect(JSON.parse(client.exportBackup()).data.plan).toEqual(original.plan);
  expect(request.mock.calls[2][0]).toContain('updated_at=eq.');
  await expect(client.undoReceivable('r')).rejects.toThrow();
  await expect(client.collectReceivable('r', 20)).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(4);
  await expect(client.putReceivable({ ...details, amount: 180 }, 'r')).rejects.toThrow('tải lại');
  expect(request).toHaveBeenCalledTimes(4);
});