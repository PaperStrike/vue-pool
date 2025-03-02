import { test as base, expect } from '@playwright/test'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { effectScope, type EffectScope } from 'vue'

interface StoreEnvFixtures {
  pinia: Pinia
  scope: EffectScope
}

const test = base.extend<StoreEnvFixtures>({
  pinia: [async ({}, use) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    await use(pinia)
    setActivePinia(undefined)
  }, { auto: true }],
  scope: async ({}, use) => {
    const scope = effectScope(true)
    await use(scope)
    scope.stop()
  },
})

export { test, expect }
