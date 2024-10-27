# vue-pool: 不定量状态管理

## 场景

假设 SPA 存在两个页面涉及同样的数据，如文章列表和文章详情，如果我们能将同一篇文章视作同一个响应式状态，便可以轻松：

1. 同步点赞信息：在文章详情页点赞，文章列表页的点赞状态同步更新。
2. 节省网络请求：列表接口已获取的文章，进入详情时无需请求详情接口。即使列表接口返回的是精简信息，也可以提前渲染这部分，优化用户体验。详情页的刷新，数据也会同步到列表页上。

状态传递有以下常用方案：

1. 父子组件间：props, model, provide & inject
2. 页面间：Pinia, Vuex, 全局事件

文章浏览场景下，文章资源的数量是不确定的，需要及时释放不再展示的文章以免内存泄漏，而上面几种方案均未提供合适的场景支持：

1. 父子组件 不适合列表和详情页相互独立的情况，这种情况在小程序中尤为常见；
2. 事件同步方案 在不同页面中实际对应不同的状态，未能很好地利用 Vue 响应式系统，维护成本高；
3. Pinia, Vuex 状态的释放与应用生命周期相关，仅在整个应用卸载时释放。

此外，文章包含的数据可能不仅仅是文章内容和点赞，还有阅读量、是否关注作者、收藏等信息，这些信息可能同时在边栏今日热门、顶栏关注列表等地方也会用到，父子组件、全局事件 难以处理跨任意组件的状态共享和组合。

vue-pool 便为此而生，在 Pinia 的基础上，引入了一套追踪状态使用的机制，帮助及时释放不再需要的内存资源，致力于简化文章浏览等场景下资源数量不确定的跨任意组件的状态管理。你可以亲自试试 vue-pool，感受它带来的便利。

## 创建

与 Pinia 相似，使用 definePool 定义一个状态池：

```js
import { definePool } from 'vue-pool';

// 定义一个文章状态池
// 支持 option, setup 两种 Pinia store 定义风格
const usePostPool = definePool('post', {
  // id 即文章 ID，用于区分不同文章资源
  // id 从哪里来呢？马上作介绍
  state: (id) => ({
    id,
    title: '',
    content: '',
    hasLiked: false,
    likedCount: 0,
  }),
  actions: {
    // 拉取最新数据
    async refresh() {
      const resp = await exampleApi.queryPost(this.id);
      this.$patch(resp.data);
    },
    // 点赞
    async like() {
      await exampleApi.likePost(this.id);
      this.hasLiked = true;
      this.likedCount += 1;
    },
  },
});
```

## 使用

在组件中，使用 usePool 生成隶属该组件的状态池实例：

```html
<script setup>
import { usePostPool } from '@/pools/post';

const postPool = usePostPool();
</script>
```

任意时机调用状态池实例的 `useStore` 方法传递文章 ID，这个 ID 便会作为 store 初始化函数的参数，返回值即为一个普通 Pinia store，下面是一组 列表页 和 详情页 的简化示例：

### 列表页

```js
const loadPosts = async ({ page, limit }) => {
  const resp = await exampleApi.queryPostList({ page, limit });
  return resp.list.map((data) => {
    // 类似 Pinia，同一个 ID 会返回同一个 store 实例
    const post = postPool.useStore(post.id);
    post.$patch(data);
    return post;
  });
};

const posts = ref([]);
posts.value = await loadPosts({ page: 1, limit: 10 });
```

### 详情页

在本示例中，如果列表页已经取得了这篇文章的数据，详情页会直接展示已取得的部分，随后调用详情接口进行刷新，刷新的数据也会同步到列表页上。

```js
const { id } = defineProps({
  id: String,
});

const post = postPool.useStore(id);
post.refresh();
```

我们也可以设计 `initIfEmpty` 之类的方法，通过 title 判空或维护 initialized 字段等方式，在列表页已经载入时彻底省去详情接口请求。

## 释放

在同一个状态池中，

1. 同一个 ID 取得的 store 状态在被销毁之前是相同的。
2. 组件可以“释放”某个 store 状态，但组件释放不等于状态销毁。仅当所有用过的组件均释放该 store 时，该状态才会被“销毁”，垃圾回收机制进一步在适当时机回收内存。

组件有 3 种方式释放状态：

1. 组件卸载，自动释放自身用到的所有状态（不需要额外手动侦听卸载事件，`usePostPool()` 时已经侦听上了）；
2. 主动调用状态池实例 `releaseStore(id)` 方法，释放该 ID 的状态；
3. 主动调用状态池实例 `clear()` 方法，释放之前用到的所有状态。

> 理论上来说，通过 `FinalizationRegistry` 和 `WeakRef`，可以让垃圾回收机制自动通知状态池不再被用的状态。但由于这两个 API 尚未在作者业务落地环境普及，vue-pool 未支持这种释放销毁方式。

在文章列表页，我们可以在刷新时释放之前用到的文章资源：

```js
const loadPosts = async ({ page, limit }) => {
  const resp = await exampleApi.queryPostList({ page, limit });

  // 刷新时，释放之前引用的文章
  if (page === 1) {
    postPool.clear();
  }

  return resp.list.map((data) => {
    const post = postPool.useStore(post.id);
    post.$patch(data);
    return post;
  });
};
```

文章详情页可以依赖组件卸载时的自动释放，无需额外处理。

## 组合

假设页面顶栏存在一个鼠标悬浮时显示的关注列表，我们定义一个关注池与文章池组合：

```js
import { computed, ref } from 'vue';
import { definePool } from 'vue-pool';

// 关注池
export const useFollowPool = definePool('follow', {
  state: (userId) => ({
    userId,
    isFollowed: false,
  }),
  actions: {
    async startFollow() {
      await exampleApi.follow(this.userId);
      this.isFollowed = true;
    },
    async cancelFollow() {
      await exampleApi.cancelFollow(this.userId);
      this.isFollowed = false;
    },
  },
});

// 文章池
export const usePostPool = definePool('post', {
  state: (id) => {
    const followPool = useFollowPool();
    const authorId = ref('');
    return {
      id,
      authorId,
      title: '',
      content: '',
      hasLiked: false,
      likedCount: 0,
      followStore: computed(() => followPool.useStore(authorId.value)),
    };
  },
  actions: {
    // ...
  },
});
```

随后，文章相关的组件通过文章池 `useStore(postId).followStore` 拿到的关注状态及其动作，与关注相关的组件通过关注池 `useStore(userId)` 拿到的关注状态及其动作，就是同步统一的了。

由于一篇文章的作者一般是固定的，这里文章 store 内部无需主动调用关注池的 releaseStore / clear 方法，不会导致内存泄漏。在内部实现上，类似组件卸载，文章 store 会自动在销毁时释放用到的关注池状态。

如果文章的作者 ID 确实可能变化，或者是组合其他一些 ID 确实会变化的状态，可以转而使用 watch + releaseStore / clear 及时释放。同样地，类似组件卸载，不论是 option 还是 setup 风格的 store 定义，watch / computed 等侦听会自动在 store 销毁时停止，无需担心内存泄漏。

```js
import { computed, ref } from 'vue';
import { definePool } from 'vue-pool';
import { useFollowPool } from '@/pools/follow';

// 文章池
export const usePostPool = definePool('post', {
  state: (id) => {
    const followPool = useFollowPool();
    const authorId = ref('');
    const followStore = ref();

    // 不使用 computed / watchEffect，避免错误追踪依赖
    watch(() => authorId.value, (newAuthorId, oldAuthorId) => {
      // 也可以直接 followPool.clear();
      if (oldAuthorId) {
        followPool.releaseStore(oldAuthorId);
      }
      followStore.value = followPool.useStore(newAuthorId);
    });

    return {
      id,
      authorId,
      title: '',
      content: '',
      hasLiked: false,
      likedCount: 0,
      followStore,
    };
  },
  actions: {
    // ...
  },
});
```
