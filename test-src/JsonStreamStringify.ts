/* istanbul ignore file */

import * as _JsonStreamStringify from '..';

const isNode8orLater = parseInt(process.version.split('.')[0].slice(1), 10) >= 8;

// tslint:disable:variable-name
const exported: typeof _JsonStreamStringify = isNode8orLater ? require('../lib/umd.js') : require('../lib/umd.polyfill.js');
const JsonStreamStringify = exported.JsonStreamStringify;

export default JsonStreamStringify;
