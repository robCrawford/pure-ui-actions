import { watch } from 'fs';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Watch the whole src directory
const srcDir = path.resolve(__dirname, '../../../src');

let parcelProcess = spawn('parcel', ['--no-cache', './index.html'], { stdio: 'inherit' });
let restartTimeout = null;

const DEBOUNCE_DELAY = 200;

watch(
  srcDir,
  {
    recursive: true
  },
  (eventType, filename) => {
    if (!filename) {
      return;
    }

    if (restartTimeout) {
      clearTimeout(restartTimeout);
    }

    restartTimeout = setTimeout(() => {
      console.log(`Detected change in ${filename}, restarting Parcel...`);
      parcelProcess.kill();
      parcelProcess = spawn('parcel', ['--no-cache', './index.html'], { stdio: 'inherit' });
    }, DEBOUNCE_DELAY);
  }
);