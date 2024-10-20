# vue-pool

Intuitive, type-safe, and flexible Pool for Vue. It allows you to manage an arbitrary number of keyed similar-structure states, making it easy to sync states across different parts of your application without manual event buses or potential memory leaks.

## ! README Work In Progress !

Outdated README content. Fix it later.

## Features

- **Type-safe**: Ensures type safety with TypeScript.
- **Flexible**: Manages the lifecycle of states within a scope.
- **Reactive**: Pool states are reactive, making it easy to sync states across components.

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