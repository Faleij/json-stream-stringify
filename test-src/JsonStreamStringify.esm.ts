// tslint:disable-next-line:import-name
import expect from 'expect.js';

it('esm should export JsonStreamStringify', async () => {
  const esm = await import('../lib/esm/index.mjs');
  expect(esm).to.have.property('JsonStreamStringify');
  expect(esm.JsonStreamStringify.name).to.be('JsonStreamStringify');
});
