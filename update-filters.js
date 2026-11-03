'use strict';

// The old crawler performed requests and unsafe file updates at import time.
// Its bounded replacement is maintained separately; never run the legacy code.
function main() {
  throw new Error('The legacy filter updater is disabled. Review the replacement in https://github.com/Revilum/geizhals-api/pull/3 before enabling filter maintenance.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {main};
