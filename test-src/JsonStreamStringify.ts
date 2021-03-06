/* istanbul ignore file */

// tslint:disable-next-line:import-name
import _JsonStreamStringify from '..';

const isNode8orLater = parseInt(process.version.split('.')[0].slice(1), 10) >= 8;

// tslint:disable:variable-name
const JsonStreamStringify: typeof _JsonStreamStringify = isNode8orLater ? require('../lib/umd.js') : require('../lib/umd.polyfill.js');

export default JsonStreamStringify;
