import LeakDetector from 'jest-leak-detector';
import { markRaw } from 'vue';
import { definePool, type Pool } from '../src/pool';
import { test, expect } from '.';

type GCFixtures = {
  hold: {
    get(): object | null;
    set(value: object): void;
    release(): void;
    hasGC(): Promise<boolean>;
  },
  pool: Pool<string, never, { hold: object }>,
};

const gcTest = test.extend<GCFixtures>({
  hold: async ({}, use) => {
    let ref: object | null = markRaw(['still alive']);
    const detector = new LeakDetector(ref);
    await use({
      get() {
        return ref;
      },
      set(value: object) {
        ref = value;
      },
      release() {
        ref = null;
      },
      async hasGC() {
        return !(await detector.isLeaking());
      },
    });
  },
  pool: [async ({ scope, hold }, use) => {
    const usePool = definePool('gc', {
      state: () => ({ hold: hold.get()! }),
    });
    const pool = scope.run(usePool)!;
    pool.useStore('gc-hold-item');
    hold.release();
    await expect(hold.hasGC()).resolves.toBe(false);
    await use(pool);
  }, { auto: true }],
});

gcTest.describe('garbage collect without leak', () => {
  gcTest('onScopeDispose', async ({ hold, scope }) => {
    scope.stop();
    await expect(hold.hasGC()).resolves.toBe(true);
  });

  gcTest('pool.clear()', async ({ hold, pool }) => {
    pool.clear();
    await expect(hold.hasGC()).resolves.toBe(true);
  });

  gcTest('pool.useStore() then pool.clear()', async ({ hold, pool }) => {
    pool.useStore('gc-hold-item');
    pool.clear();
    await expect(hold.hasGC()).resolves.toBe(true);
  });

  gcTest('pool.releaseStore()', async ({ hold, pool }) => {
    pool.releaseStore('gc-hold-item');
    await expect(hold.hasGC()).resolves.toBe(true);
  });

  gcTest('pool.useStore() then pool.releaseStore()', async ({ hold, pool }) => {
    pool.useStore('gc-hold-item');
    pool.releaseStore('gc-hold-item');
    await expect(hold.hasGC()).resolves.toBe(true);
  });

  gcTest('rootPool.useStore() then *.releaseStore()', async ({ hold, pool }) => {
    const rootPool = pool.root;
    rootPool.useStore('gc-hold-item');
    pool.releaseStore('gc-hold-item');
    await expect(hold.hasGC()).resolves.toBe(false);
    rootPool.releaseStore('gc-hold-item');
    await expect(hold.hasGC()).resolves.toBe(true);
  });
});
