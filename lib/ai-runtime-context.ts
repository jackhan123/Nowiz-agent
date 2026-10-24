import { AsyncLocalStorage } from 'node:async_hooks';
const runtime = new AsyncLocalStorage<Record<string, unknown>>();
export function withAiRuntime<T>(env: object, run: () => T): T { return runtime.run(env as Record<string, unknown>, run); }
export function getAiRuntime() { return runtime.getStore() ?? {}; }
