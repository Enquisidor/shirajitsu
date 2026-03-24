import { defineConfig } from 'wxt'

export default defineConfig({
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Shirajitsu',
    description: 'Annotates factual claims in text — surfaces tension, never verdicts.',
    version: '0.0.1',
    permissions: ['storage', 'activeTab', 'scripting', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: {},
  },
})
