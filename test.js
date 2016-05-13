'use strict';

const mocha = require('mocha');
const JSONStreamify = require('./jsonStreamify');
const Readable = require('stream').Readable;
const expect = require('expect.js');

function createTest(input, expected, replacer) {
    return () => new Promise((resolve, reject) => {
        let str = '';
        new JSONStreamify(input, replacer).on('data', data => str += data.toString()).once('end', () => {
            try {
                expect(str).to.equal(expected);
            } catch (err) {
                return reject(err);
            }
            resolve();
        }).once('error', reject);
    });
}

function ReadableStream() {
    const stream = new Readable({
        objectMode: Array.from(arguments).some(v => typeof v !== 'string')
    });
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

    it('1 should be 2', createTest(1, `2`, (k, v) => 2));

    it('{} should be {}', createTest({}, '{}'));

    it('{a:undefined} should be {}', createTest({
        a: undefined
    }, '{}'));

    it('{a:null} should be {"a":null}', createTest({
        a: null
    }, '{"a":null}'));

    it('{a:undefined} should be {"a":1}', createTest({
        a: undefined
    }, '{"a":1}', (k, v) => {
        if (k) {
            expect(k).to.be('a');
        }
        return k ? 1 : v;
    }));

    it('{a:1,b,2} should be {"b":2}', createTest({
        a: 1,
        b: 2
    }, '{"b":2}', ['b']));

    it('{a:1} should be {"a":1}', createTest({
        a: 1
    }, '{"a":1}'));

    it('{a:function(){}} should be {}', createTest({
        a: function() {}
    }, '{}'));

    it('[function(){}] should be [null]', createTest([function() {}], '[null]'));

    it('{a:date} should be {"a":date.toJSON()}', createTest({
        a: date
    }, `{"a":"${date.toJSON()}"}`));

    it('({a:1,b:{c:2}}) should be {"a":1,"b":{"c":2}}', createTest(({
        a: 1,
        b: {
            c: 2
        }
    }), '{"a":1,"b":{"c":2}}'));

    it('{a:[1], "b": 2} should be {"a":[1],"b":2}', createTest({
        a: [1],
        b: 2
    }, '{"a":[1],"b":2}'));

    it('[] should be []', createTest([], '[]'));

    it('[[[]],[[]]] should be [[[]],[[]]]', createTest([
        [
            []
        ],
        [
            []
        ]
    ], '[[[]],[[]]]'));

    it('[1, undefined, 2] should be [1,null,2]', createTest([1, undefined, 2], '[1,null,2]'));

    it(`[1,'a'] should be [1,"a"]`, createTest([1, 'a'], '[1,"a"]'));

    it('Promise(1) should be 1', createTest(Promise.resolve(1), '1'));

    it('Promise(Promise(1)) should be 1', createTest(Promise.resolve(Promise.resolve(1)), '1'));

    it('{a:Promise(1)} should be {"a":1}', createTest({
        a: Promise.resolve(1)
    }, '{"a":1}'));

    it('ReadableStream(1) should be [1]', createTest(ReadableStream(1), '[1]'));

    it('{a:ReadableStream(1,2,3)} should be {"a":[1,2,3]}', createTest({
        a: ReadableStream(1, 2, 3)
    }, '{"a":[1,2,3]}'));

    it(`ReadableStream('a', 'b', 'c') should be "abc"`, createTest(ReadableStream('a', 'b', 'c'), '"abc"'));

    it(`ReadableStream({}, 'a', undefined, 'c') should be [{},"a",null,"c"]`, createTest(ReadableStream({}, 'a', undefined, 'c'), '[{},"a",null,"c"]'));

    it(`{ a: ReadableStream({name: 'name', date: date }) } should be {"a":[{"name":"name","date":"${date.toJSON()}"}]}`, createTest({
        a: ReadableStream({
            name: 'name',
            date: date
        })
    }, `{"a":[{"name":"name","date":"${date.toJSON()}"}]}`));

    it(`{ a: ReadableStream({name: 'name', arr: [], date: date }) } should be {"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`, createTest({
        a: ReadableStream({
            name: 'name',
            arr: [],
            date: date
        })
    }, `{"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`));

    it(`{ a: [Circular] } should be {"a":"[Circular]"}`, () => {
        let data = {};
        data.a = data;

        let deferred0 = Promise.defer();
        let deferred1 = Promise.defer();
        let str = '';
        new JSONStreamify(data)
            .once('circular', err => {
                try {
                    expect(err).to.be.ok();
                } catch (err) {
                    return deferred1.reject(err);
                }
                deferred1.resolve();
            })
            .on('data', data => str += data.toString())
            .once('end', () => {
                try {
                    expect(str).to.equal(`{"a":"[Circular]"}`);
                } catch (err) {
                    return deferred0.reject(err);
                }
                deferred0.resolve();
            });

        return Promise.all([deferred0.promise, deferred1.promise]);
    });

    it(`{ a: [Circular] } should be {"a":"custom"}`, () => {
        let data = {};
        data.a = data;

        let deferred0 = Promise.defer();
        let deferred1 = Promise.defer();
        let str = '';
        new JSONStreamify(data)
            .once('circular', err => {
                try {
                    expect(err).to.be.ok();
                    expect(err.replace).to.be.a(Function);
                    err.replace(Promise.resolve('custom'));
                } catch (err) {
                    return deferred1.reject(err);
                }
                deferred1.resolve();
            })
            .on('data', data => str += data.toString())
            .once('end', () => {
                try {
                    expect(str).to.equal(`{"a":"custom"}`);
                } catch (err) {
                    return deferred0.reject(err);
                }
                deferred0.resolve();
            });

        return Promise.all([deferred0.promise, deferred1.promise]);
    });

    let circularData0 = {};
    circularData0.a = circularData0;
    circularData0.b = [circularData0, { a: circularData0 }]
    it('{a: Circular, b: [Circular, { a: Circular }]} should be {"a":"[Circular]","b":["[Circular]",{"a":"[Circular]"}]}', createTest(circularData0, '{"a":"[Circular]","b":["[Circular]",{"a":"[Circular]"}]}'));
});
