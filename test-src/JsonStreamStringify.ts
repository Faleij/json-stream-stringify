/* istanbul ignore file */

import type * as Module from '..';
import expect from 'expect.js';

const nodeVersion = parseInt(process.version.split('.')[0].slice(1), 10);

type ModuleType = typeof Module;
// tslint:disable:variable-name
const { JsonStreamStringify }: ModuleType = (nodeVersion >= 8 ? require('../lib/umd/index.js') : require('../lib/umd/polyfill.js'));

describe('JsonStreamStringify package', () => {
  if (nodeVersion === 16) {
    require('./JsonStreamStringify.esm.js');
  }

  it('umd should export JsonStreamStringify', async () => {
    const { JsonStreamStringify: { name } }: ModuleType = require('../lib/umd/index.js');
    expect(name).to.be('JsonStreamStringify');
  });

  it('cjs should export JsonStreamStringify', async () => {
    const { JsonStreamStringify: { name } }: ModuleType = require('../lib/cjs/index.js');
    expect(name).to.be('JsonStreamStringify');
  });
});

export { JsonStreamStringify };
