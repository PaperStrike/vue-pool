/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable max-len */
import {
  markRaw,
  onScopeDispose,
  ref,
  type Ref,
} from 'vue';
import {
  defineStore,
  getActivePinia,
  type _ActionsTree,
  type _ExtractActionsFromSetupStore,
  type _ExtractGettersFromSetupStore,
  type _ExtractStateFromSetupStore,
  type _GettersTree,
  type DefineSetupStoreOptions,
  type DefineStoreOptions,
  type Pinia,
  type StateTree,
  type Store,
} from 'pinia';

export interface StoreHandle<Id extends string = string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  count: number;
  store: Store<Id, S, G, A>;
  pinia: Pinia;
}

/**
 * A root pool is a pool that manages the lifecycle of some stores.
 * It requires 1:1 use/release in-order calls. Make sure they are perfectly paired like typing brackets.
 */
export interface RootPool<PoolId extends string, ItemId extends string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  /** @internal */
  handles: Ref<{ [K in ItemId]?: StoreHandle<`${PoolId}:${K}`, S, G, A> }>;
  poolId: PoolId;
  useStore: (itemId: ItemId, pinia: Pinia) => Store<`${PoolId}:${ItemId}`, S, G, A>;
  releaseStore: (itemId: ItemId) => void;
}

/**
 * A scoped pool is a pool that manages the lifecycle of some stores within the same scope.
 * It allows any sequence of use/release/clear calls. It will automatically clear on scope disposal.
 */
export interface Pool<PoolId extends string, ItemId extends string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  poolId: PoolId;
  /** @internal */
  root: RootPool<PoolId, ItemId, S, G, A>;
  /** @internal */
  pinia: Pinia;
  /** @internal */
  cache: Ref<{ [K in ItemId]?: Store<`${PoolId}:${K}`, S, G, A> }>;
  useStore: (itemId: ItemId) => Store<`${PoolId}:${ItemId}`, S, G, A>;
  releaseStore: (itemId: ItemId) => void;
  clear: () => void;
}

export interface PoolDefinition<PoolId extends string = string, ItemId extends string = string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  (pinia?: Pinia | null | undefined): Pool<PoolId, ItemId, S, G, A>;
  poolId: PoolId;
  /** @internal */
  root: RootPool<PoolId, ItemId, S, G, A>;
}

export type DefinePoolOptions<PoolId extends string, ItemId extends string, S extends StateTree, G, A> = Omit<DefineStoreOptions<`${PoolId}:${ItemId}`, S, G, A>, 'state'> & {
  state?: (itemId: ItemId) => S;
};

export type DefineSetupPoolOptions<PoolId extends string, ItemId extends string, S extends StateTree, G, A> = DefineSetupStoreOptions<`${PoolId}:${ItemId}`, S, G, A>;

/** @internal */
export function createRootPool<PoolId extends string, ItemId extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(poolId: PoolId, options: Omit<DefinePoolOptions<PoolId, ItemId, S, G, A>, 'id'>): RootPool<PoolId, ItemId, S, G, A>;
export function createRootPool<PoolId extends string, ItemId extends string, SS>(poolId: PoolId, storeSetup: (itemId: string) => SS, options?: DefineSetupPoolOptions<PoolId, ItemId, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>): RootPool<PoolId, ItemId, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>;
export function createRootPool<PoolId extends string, ItemId extends string, S extends StateTree, G extends _GettersTree<S>, A>(poolId: PoolId, ...args: unknown[]): RootPool<PoolId, ItemId, S, G, A> {
  if (poolId.includes(':')) {
    throw new Error('Pool id cannot contain a colon ":"');
  }

  const handles: RootPool<PoolId, ItemId, S, G, A>['handles'] = ref({});

  return {
    poolId,
    handles,
    useStore: (itemId, pinia) => {
      const handle = handles.value[itemId];
      if (handle) {
        handle.count += 1;
        return handle.store;
      }

      // Generate defineStore args
      const defineStoreArgs = args.slice();
      const [arg0] = args;
      if (typeof arg0 === 'function') {
        const storeSetup = arg0 as (itemId: string) => unknown;
        defineStoreArgs[0] = () => storeSetup(itemId);
      } else if (typeof arg0 === 'object' && arg0) {
        const options = arg0 as DefinePoolOptions<PoolId, ItemId, S, G, A>;
        const { state } = options;
        if (typeof state === 'function') {
          defineStoreArgs[0] = {
            ...options,
            state: () => state(itemId),
          };
        }
      }

      const storeDefinition = defineStore(`${poolId}:${itemId}`, ...defineStoreArgs as [Omit<DefineStoreOptions<`${PoolId}:${typeof itemId}`, S, G, A>, 'id'>]);
      const store = storeDefinition(pinia);
      handles.value[itemId] = {
        count: 1,
        store,
        pinia: markRaw(pinia),
      };
      return store;
    },
    releaseStore: (itemId) => {
      const handle = handles.value[itemId];
      if (!handle) return;

      handle.count -= 1;
      if (handle.count <= 0) {
        // Pinia $dispose says we had to delete the store state manually
        handle.store.$dispose();
        delete handle.pinia.state.value[`${poolId}:${itemId}`];

        delete handles.value[itemId];
      }
    },
  };
}

export function definePool<PoolId extends string, ItemId extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(poolId: PoolId, options: Omit<DefinePoolOptions<PoolId, ItemId, S, G, A>, 'id'>): PoolDefinition<PoolId, ItemId, S, G, A>;
export function definePool<PoolId extends string, ItemId extends string, SS>(poolId: PoolId, storeSetup: (itemId: string) => SS, options?: DefineSetupPoolOptions<PoolId, ItemId, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>): PoolDefinition<PoolId, ItemId, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>;
export function definePool<PoolId extends string, ItemId extends string, S extends StateTree, G extends _GettersTree<S>, A>(poolId: PoolId, ...args: unknown[]): PoolDefinition<PoolId, ItemId, S, G, A> {
  const root = createRootPool(poolId, ...args as [DefinePoolOptions<PoolId, ItemId, S, G, A>]);

  const usePool = (customPinia?: Pinia | null | undefined): Pool<PoolId, ItemId, S, G, A> => {
    const pinia = customPinia || getActivePinia();
    if (!pinia) {
      throw new Error('Pinia instance not found');
    }

    const cache: Pool<PoolId, ItemId, S, G, A>['cache'] = ref({});

    const clear = () => {
      Object.keys(cache.value).forEach((key) => {
        root.releaseStore(key as ItemId);
      });
      cache.value = {};
    };

    onScopeDispose(clear);

    return {
      poolId,
      root,
      pinia,
      cache,
      useStore: (itemId) => {
        const cachedStore = cache.value[itemId];
        if (cachedStore) {
          return cachedStore;
        }

        const store = root.useStore(itemId, pinia);
        cache.value[itemId] = store;
        return store;
      },
      releaseStore: (itemId) => {
        if (itemId in cache.value) {
          delete cache.value[itemId];
          root.releaseStore(itemId);
        }
      },
      clear,
    };
  };

  return Object.assign(usePool, {
    poolId,
    root,
  });
}

// export interface PoolStoreMeta<Id extends string, ItemId extends string> {
//   poolId: Id;
//   itemId: ItemId;
// }

// export function getPoolStoreMeta<Id extends string = string, ItemId extends string = string>(store: Store<`${Id}:${ItemId}`>): PoolStoreMeta<Id, ItemId>;
// export function getPoolStoreMeta<Id extends string = string, ItemId extends string = string>(store: Store): PoolStoreMeta<Id, ItemId>;
// export function getPoolStoreMeta<Id extends string, ItemId extends string>(store: Store): PoolStoreMeta<Id, ItemId> {
//   const id = store.$id;
//   const splitIndex = id.indexOf(':');
//   if (splitIndex === -1) {
//     throw new Error(`Invalid pool store with id "${id}"`);
//   }

//   return {
//     poolId: id.slice(0, splitIndex) as Id,
//     itemId: id.slice(splitIndex + 1) as ItemId,
//   };
// }
