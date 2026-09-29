import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

// Static regression guards, not a substitute for executing against PostgreSQL.
const migration = readFileSync(new URL('../../../sql/migrations/002_data_history.sql', import.meta.url), 'utf8');
it('migration không xoá bảng hoặc viết lại payload hiện tại', () => {
  expect(migration).not.toMatch(/drop\s+table|truncate\s+table|update\s+public\.user_data\s+set/i);
  expect(migration).toMatch(/begin;/i); expect(migration).toMatch(/commit;/i);
  expect(migration).toContain('add column if not exists revision');
});
it('lịch sử giới hạn quyền và lưu bản trước trong trigger', () => {
  expect(migration).toContain('enable row level security');
  expect(migration).toContain('revoke all on public.user_data_history from public, anon, authenticated');
  expect(migration).toContain('(select auth.uid()) = user_id');
  expect(migration).toContain('old.payload');
  expect(migration).toContain('limit 20');
  expect(migration).toContain("set search_path = ''");
});