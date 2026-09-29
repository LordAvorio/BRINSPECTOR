import { defineConfig } from 'wxt';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'WXT_');
    const hostPermissions: string[] = [];
    if (env.WXT_FOUNDRY_ENDPOINT) {
      hostPermissions.push(`${new URL(env.WXT_FOUNDRY_ENDPOINT).origin}/*`);
    }
    return {
      name: 'BRINSPECTOR',
      description:
        'Captures network, console, and screenshots on monitored sites and generates AI-assisted PDF bug reports.',
      permissions: ['storage', 'scripting', 'tabs', 'alarms', 'unlimitedStorage'],
      optional_host_permissions: ['http://*/*', 'https://*/*'],
      host_permissions: hostPermissions,
    };
  },
});
