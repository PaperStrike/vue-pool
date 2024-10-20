# vue-pool

符合直觉的 Vue.js 状态“池”管理工具。帮助你管理任意数量的状态，简化不同组件之间的状态同步，无需手动设计维护 EventBus，减少潜在的内存泄漏。

## ! README 编写中 !

README 内容已过时，晚点再修复。

## Features

- **类型安全**: 类型可自动推断，即使在 JavaScript 中亦可为你自动补全！
- **灵活高效**: 自动管理任意数量的跨任意组件的状态生命周期！
- **响应式**: 池中的状态是响应式的，轻松同步各视图状态变更！

## Installation

```bash
npm install vue-pool
```

## Usage

### Define a Pool

Define a pool outside of your components, similar to how you define Pinia stores:

```typescript
import { definePool } from 'vue-pool';

const useThreadPool = definePool<string, boolean>('thread-pool', (key) => false);
```

### Use the Pool in a Component

Use the pool inside your components to manage states:

```typescript
import { useThreadPool } from './path-to-your-pool-definition';

export default {
  setup() {
    const threadPool = useThreadPool();
    const followState = threadPool.use('thread-id-123');

    return {
      followState,
    };
  },
};
```

## Example Use Case

When writing a forum SPA webpage, you might have two APIs: one for the thread list and one for thread details. You may have two pages showing the same state, such as the author follow state. With `vue-pool`, you can easily sync this state across these pages without manual event buses.

### Without `vue-pool`

- Refetch the details on page show, which may create a new request and usually make no change.
- Use EventBuses to emit and listen to the change state in each page, which can lead to potential memory leaks if listeners are not removed properly.

### With `vue-pool`

- Create a pool with the thread ID as the key and the follow states as values.
- The pool states are reactive, so you don't need any manual event buses.

```typescript
const useFollowPool = definePool<string, boolean>('follow-pool', (key) => false);

// In component A
const followPool = useFollowPool();
const followStateA = followPool.use('thread-id-123');

// In component B
const followPool = useFollowPool();
const followStateB = followPool.use('thread-id-123');

// followStateA and followStateB are automatically synced
```

## License

This project is licensed under the ISC License.