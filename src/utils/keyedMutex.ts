/**
 * Khóa tuần tự theo KEY (vd repoPath): các lời gọi cùng key chạy lần lượt, khác key chạy song song.
 * Dùng để bảo vệ thao tác git hay tranh chấp (.git index/refs lock) như `fetch`, `worktree add/remove`
 * khi nhiều card cùng 1 repo chạy đồng thời — phần việc nặng (LLM) vẫn song song, chỉ nối tiếp đoạn git ngắn.
 */
const tails = new Map<string, Promise<unknown>>();

export function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  // Chạy fn sau khi lời gọi trước (cùng key) kết thúc, dù trước đó lỗi (then(fn, fn)).
  const run = prev.then(fn, fn) as Promise<T>;
  // Tail mới: nuốt lỗi để không làm hỏng chuỗi của lời gọi kế tiếp.
  tails.set(key, run.then(() => undefined, () => undefined));
  return run;
}
