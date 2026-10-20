import { chromium } from './workflow-pdf-baseline/node_modules/playwright-core/index.mjs';
const launch = chromium.launch.bind(chromium);
chromium.launch = options => launch({ ...options, executablePath: '/usr/bin/chromium' });
