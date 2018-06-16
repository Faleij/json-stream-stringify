
import JSONStreamify from './..';
import { Readable } from 'stream';
import expect from 'expect.js';

function createTest(input, expected, ...args) {
  return () => new Promise((resolve, reject) => {
    let str = '';
    new JSONStreamify(input, ...args)
      .on('data', (data) => {
        str += data.toString();
      })
      .once('end', () => {
        try {
          expect(str).to.equal(expected);
        } catch (err) {
          reject(err);
          return;
        }
        resolve();
      })
      .once('error', reject);
  });
}

function ReadableStream(...args) {
  const stream = new Readable({
    objectMode: args.some(v => typeof v !== 'string'),
  });
  args.forEach(v => stream.push(v));
  stream.push(null);
  return stream;
}

describe('JsonStreamStringify', () => {
  const date = new Date();

  it('null should be null', createTest(null, 'null'));

  it('date should be date.toJSON()', createTest(date, `"${date.toJSON()}"`));

  it('true should be true', createTest(true, 'true'));

  it('1 should be 1', createTest(1, '1'));

  it('1 should be 2', createTest(1, '2', () => 2));

  it('{} should be {}', createTest({}, '{}'));

  it('{a:undefined} should be {}', createTest({
    a: undefined,
  }, '{}'));

  it('{a:null} should be {"a":null}', createTest({
    a: null,
  }, '{"a":null}'));

  it('{a:undefined} should be {"a":1}', createTest({
    a: undefined,
  }, '{"a":1}', (k, v) => {
    if (k) {
      expect(k).to.be('a');
    }
    return k ? 1 : v;
  }));

  it('{a:1,b,2} should be {"b":2}', createTest({
    a: 1,
    b: 2,
  }, '{"b":2}', ['b']));

  it('{a:1} should be {"a":1}', createTest({
    a: 1,
  }, '{"a":1}'));

  it('{a:function(){}} should be {}', createTest({
    a() {},
  }, '{}'));

  it('[function(){}] should be [null]', createTest([function a() {}], '[null]'));

  it('{a:date} should be {"a":date.toJSON()}', createTest({
    a: date,
  }, `{"a":"${date.toJSON()}"}`));

  it('({a:1,b:{c:2}}) should be {"a":1,"b":{"c":2}}', createTest(({
    a: 1,
    b: {
      c: 2,
    },
  }), '{"a":1,"b":{"c":2}}'));

  it('{a:[1], "b": 2} should be {"a":[1],"b":2}', createTest({
    a: [1],
    b: 2,
  }, '{"a":[1],"b":2}'));

  it('[] should be []', createTest([], '[]'));

  it('[[[]],[[]]] should be [[[]],[[]]]', createTest([
    [
      [],
    ],
    [
      [],
    ],
  ], '[[[]],[[]]]'));

  it('[1, undefined, 2] should be [1,null,2]', createTest([1, undefined, 2], '[1,null,2]'));

  it('[1, , 2] should be [1,null,2]', createTest([1,, 2], '[1,null,2]'));

  it('[1,\'a\'] should be [1,"a"]', createTest([1, 'a'], '[1,"a"]'));

  it('Promise(1) should be 1', createTest(Promise.resolve(1), '1'));

  it('Promise(Promise(1)) should be 1', createTest(Promise.resolve(Promise.resolve(1)), '1'));

  it('{a:Promise(1)} should be {"a":1}', createTest({
    a: Promise.resolve(1),
  }, '{"a":1}'));

  it('ReadableStream(1) should be [1]', createTest(ReadableStream(1), '[1]'));

  it('{a:ReadableStream(1,2,3)} should be {"a":[1,2,3]}', createTest({
    a: ReadableStream(1, 2, 3),
  }, '{"a":[1,2,3]}'));

  it('ReadableStream(\'a\', \'b\', \'c\') should be "abc"', createTest(ReadableStream('a', 'b', 'c'), '"abc"'));

  it('ReadableStream({}, \'a\', undefined, \'c\') should be [{},"a",null,"c"]', createTest(ReadableStream({}, 'a', undefined, 'c'), '[{},"a",null,"c"]'));

  it(`{ a: ReadableStream({name: 'name', date: date }) } should be {"a":[{"name":"name","date":"${date.toJSON()}"}]}`, createTest({
    a: ReadableStream({
      name: 'name',
      date,
    }),
  }, `{"a":[{"name":"name","date":"${date.toJSON()}"}]}`));

  it(`{ a: ReadableStream({name: 'name', arr: [], date: date }) } should be {"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`, createTest({
    a: ReadableStream({
      name: 'name',
      arr: [],
      date,
    }),
  }, `{"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`));

  describe('circular structure', () => {
    const circularData0 = {};
    circularData0.a = circularData0;
    it('{ a: a } should be {"a":{"$ref":"$"}}', createTest(circularData0, '{"a":{"$ref":"$"}}'));

    const circularData1 = {};
    circularData1.a = circularData1;
    circularData1.b = [circularData1, {
      a: circularData1,
    }];
    circularData1.b[3] = ReadableStream(circularData1.b[1]);
    it('{a: a, b: [a, { a: a },,ReadableStream(b.1)]} should be {"a":{"$ref":"$"},"b":[{"$ref":"$"},{"a":{"$ref":"$"}},null,[{"$ref":"$[\\"b\\"][1]"}]]}', createTest(circularData1, '{"a":{"$ref":"$"},"b":[{"$ref":"$"},{"a":{"$ref":"$"}},null,[{"$ref":"$[\\"b\\"][1]"}]]}'));

    const circularData2 = {};
    const data2 = {
      a: 'deep',
    };
    circularData2.a = Promise.resolve({
      b: data2,
    });
    circularData2.b = data2;
    it('{ a: Promise({ b: { a: \'deep\' } }), b: a.b } should be {"a":{"b":{"a":"deep"}},"b":{"$ref":"$[\\"a\\"][\\"b\\"]"}}', createTest(circularData2, '{"a":{"b":{"a":"deep"}},"b":{"$ref":"$[\\"a\\"][\\"b\\"]"}}'));
  });

  describe('disable circular', () => {
    const el = { foo: 'bar' };
    const arr = [el, el];
    it('[{"foo":"bar"},{"foo":"bar"}] should be [{"foo":"bar"},{"foo":"bar"}]', createTest(arr, '[{"foo":"bar"},{"foo":"bar"}]', undefined, 2, true));
  });
});
