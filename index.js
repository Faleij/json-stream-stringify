/* eslint-disable import/no-dynamic-require */

const prop = process.version.split('.')[0].slice(1) >= 6 ? '' : '-es5';
module.exports = require(`./packages/json-stream-stringify${prop}/dist/umd.js`);
