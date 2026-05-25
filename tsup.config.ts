import { defineConfig } from 'tsup';

const isDev = process.env.RELEASE !== '1';

export default defineConfig({
    entry: ['src/extension.ts'],
    format: ['cjs'],
    target: 'es2020',
    outDir: 'dist',
    clean: true,
    sourcemap: true,
    dts: false,
    external: ['vscode', 'ws'],
    noExternal: ['antigravity-sdk'],
    define: {
        '__DEV__': JSON.stringify(isDev),
    },
});
