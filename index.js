/* eslint-disable import/no-dynamic-require */

const prop = process.version.split('.')[0].slice(1) >= 8 ? '' : '.polyfill';
module.exports = require(`./dist/umd${prop}.js`);
