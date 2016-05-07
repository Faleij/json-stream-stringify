'use strict';

const mocha = require('mocha');
const JSONStreamify = require('./gen');
const Readable = require('stream').Readable;
const expect = require('expect.js');

function createTest(input, expected) {
    return () => new Promise((resolve, reject) => {
        let str = '';
        new JSONStreamify(input).on('data', data => str += data.toString()).once('end', () => {
            try {
                expect(str).to.equal(expected);
            } catch (err) {
                reject(err);
            }
            resolve();
        });
    });
}

function ReadableStream() {
    const stream = new Readable({ read: () => undefined, objectMode: typeof arguments[0] !== 'string' });
    Array.from(arguments).forEach(v => stream.push(v));
    stream.push(null);
    return stream;
}

describe('Streamify', () => {
    const date = new Date();

    it('null should be null', createTest(null, 'null'));

    it('date should be date.toJSON()', createTest(date, `"${date.toJSON()}"`));

    it('true should be true', createTest(true, `true`));

    it('1 should be 1', createTest(1, `1`));

    it('{} should be {}', createTest({}, '{}'));

    it('{a:1} should be {"a":1}', createTest({a:1}, '{"a":1}'));

    it('{a:date} should be {"a":date.toJSON()}', createTest({a:date}, `{"a":"${date.toJSON()}"}`));

    it('({a:1,b:{c:2}}) should be {"a":1,"b":{"c":2}}', createTest(({a:1,b:{c:2}}), '{"a":1,"b":{"c":2}}'));

    it('[] should be []', createTest([], '[]'));

    it(`[1,'a'] should be [1,"a"]`, createTest([1,'a'], '[1,"a"]'));

    it('Promise(1) should be 1', createTest(Promise.resolve(1), '1'));

    it('{a:Promise(1)} should be {"a":1}', createTest({a:Promise.resolve(1)}, '{"a":1}'));

    it('ReadableStream(1) should be [1]', createTest(ReadableStream(1), '[1]'));

    it('{a:ReadableStream(1,2,3)} should be {"a":[1,2,3]}', createTest({a:ReadableStream(1,2,3)}, '{"a":[1,2,3]}'));

    it(`ReadableStream('a', 'b', 'c') should be "abc"`, createTest(ReadableStream('a', 'b', 'c'), '"abc"'));
});
