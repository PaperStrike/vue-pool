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

export interface PoolBase<Id extends string = string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  id: Id;
  useStore: <ItemId extends string>(itemId: ItemId) => Store<`${Id}:${ItemId}`, S, G, A>;
  releaseStore: <ItemId extends string>(itemId: ItemId) => void;
}

export interface StoreHandle<Id extends string = string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  count: number;
  store: Store<Id, S, G, A>;
  pinia: Pinia;
}

/**
 * A root pool is a pool that manages the lifecycle of some stores.
 * It requires 1:1 use/release in-order calls. Make sure they are perfectly paired like typing brackets.
 */
export interface RootPool<Id extends string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> extends PoolBase<Id, S, G, A> {
  /** @internal */
  handles: Ref<{ [K in string]?: StoreHandle<`${Id}:${string}`, S, G, A> }>;
}

/**
 * A scoped pool is a pool that manages the lifecycle of some stores within the same scope.
 * It allows any sequence of use/release/clear calls. It will automatically clear on scope disposal.
 */
export interface Pool<Id extends string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> extends PoolBase<Id, S, G, A> {
  /** @internal */
  root: RootPool<Id, S, G, A>;
  /** @internal */
  cache: Ref<{ [K in string]?: Store<`${Id}:${string}`, S, G, A> }>;
  clear: () => void;
}

export interface PoolDefinition<Id extends string = string, S extends StateTree = StateTree, G = _GettersTree<S>, A = _ActionsTree> {
  (): Pool<Id, S, G, A>;
  /** @internal */
  root: RootPool<Id, S, G, A>;
  id: Id;
}

export type DefinePoolOptions<Id extends string, S extends StateTree, G, A> = Omit<DefineStoreOptions<`${Id}:${string}`, S, G, A>, 'state'> & {
  state?: (itemId: string) => S;
};

export type DefineSetupPoolOptions<Id extends string, S extends StateTree, G, A> = DefineSetupStoreOptions<`${Id}:${string}`, S, G, A>;

/** @internal */
export function createRootPool<Id extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(poolId: Id, options: Omit<DefinePoolOptions<Id, S, G, A>, 'id'>): RootPool<Id, S, G, A>;
export function createRootPool<Id extends string, SS>(poolId: Id, storeSetup: (itemId: string) => SS, options?: DefineSetupPoolOptions<Id, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>): RootPool<Id, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>;
export function createRootPool<Id extends string, S extends StateTree, G extends _GettersTree<S>, A>(poolId: Id, ...args: unknown[]): RootPool<Id, S, G, A> {
  if (poolId.includes(':')) {
    throw new Error('Pool id cannot contain a colon ":"');
  }

  const handles = ref<{ [K in string]?: StoreHandle<`${Id}:${string}`, S, G, A> }>({});

  return {
    id: poolId,
    handles,
    useStore: (itemId) => {
      const handle = handles.value[itemId] as StoreHandle<`${Id}:${typeof itemId}`, S, G, A> | undefined;
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
        const options = arg0 as DefinePoolOptions<Id, S, G, A>;
        const { state } = options;
        if (typeof state === 'function') {
          defineStoreArgs[0] = {
            ...options,
            state: () => state(itemId),
          };
        }
      }

      const storeDefinition = defineStore(`${poolId}:${itemId}`, ...defineStoreArgs as [Omit<DefineStoreOptions<`${Id}:${typeof itemId}`, S, G, A>, 'id'>]);
      const store = storeDefinition();
      const pinia = getActivePinia()!;
      handles.value[itemId] = {
        count: 1,
        store,
        pinia: markRaw(pinia),
      };
      return store;
    },
    releaseStore: (itemId) => {
      const handle = handles.value[itemId] as StoreHandle<`${Id}:${typeof itemId}`, S, G, A> | undefined;
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

export function definePool<Id extends string, S extends StateTree = {}, G extends _GettersTree<S> = {}, A = {}>(poolId: Id, options: Omit<DefinePoolOptions<Id, S, G, A>, 'id'>): PoolDefinition<Id, S, G, A>;
export function definePool<Id extends string, SS>(poolId: Id, storeSetup: (itemId: string) => SS, options?: DefineSetupPoolOptions<Id, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>): PoolDefinition<Id, _ExtractStateFromSetupStore<SS>, _ExtractGettersFromSetupStore<SS>, _ExtractActionsFromSetupStore<SS>>;
export function definePool<Id extends string, S extends StateTree, G extends _GettersTree<S>, A>(poolId: Id, ...args: unknown[]): PoolDefinition<Id, S, G, A> {
  const root = createRootPool(poolId, ...args as [DefinePoolOptions<Id, S, G, A>]);

  const usePool = (): Pool<Id, S, G, A> => {
    const cache = ref<{ [K in string]?: Store<`${Id}:${string}`, S, G, A> }>({});

    const clear = () => {
      Object.keys(cache.value).forEach((key) => {
        root.releaseStore(key);
      });
      cache.value = {};
    };

    onScopeDispose(clear);

    return {
      id: poolId,
      root,
      cache,
      useStore: (itemId) => {
        const cachedStore = cache.value[itemId] as Store<`${Id}:${typeof itemId}`, S, G, A> | undefined;
        if (cachedStore) {
          return cachedStore;
        }

        const store = root.useStore(itemId);
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
    root,
    id: poolId,
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
