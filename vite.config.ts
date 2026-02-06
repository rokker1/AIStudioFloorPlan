import path from 'path';
import { defineConfig } from 'vite';
// FIX: `__dirname` is not available in ES modules by default.
// The following lines define it using `import.meta.url` which is the standard ESM way.
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
    return {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
