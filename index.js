/* eslint-disable no-dynamic-require */

const prop = process.version.split('.')[0].slice(1) >= 6.5 ? 'main' : 'browser';
module.exports = require(require('./package.json')[prop]);
