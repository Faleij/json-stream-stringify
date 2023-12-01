/* istanbul ignore file */

import { Readable } from 'stream';
// tslint:disable-next-line:import-name
import expect from 'expect.js';
import { JsonStreamStringify } from './JsonStreamStringify';

// create an object that emits an error (err) when serialized to json
function emitError(err: Error) {
  return {
    toJSON() {
      throw err;
    },
  };
}

function createTest(input, expected, ...args) {
  return () => new Promise((resolve, reject) => {
    let str = '';
    const jsonStream = new JsonStreamStringify(input, ...args)
      .once('end', () => {
        try {
          expect(str).to.equal(expected);
        } catch (err) {
          reject(err);
          return;
        }
        resolve({ jsonStream });
      })
      .once('error', err => {
        reject(Object.assign(err, { jsonStream }))
      })
      .on('data', (data) => {
        str += data.toString();
      });
  });
}

function readableStream(...args) {
  const stream = new Readable({
    objectMode: args.some(v => typeof v !== 'string'),
  });
  stream._read = () => {
    if (!args.length) {
      return stream.push(null);
    }
    const v = args.shift();
    if (v instanceof Error) return stream.emit('error', v);
    return stream.push(v);
  };
  return stream;
}

describe('JsonStreamStringify', () => {
  after(() => {
    // test does not exit cleanly :/
    setTimeout(() => process.exit(), 500).unref();
  });

  const date = new Date();

  it('null should be null', createTest(null, 'null'));

  it('Infinity should be null', createTest(Infinity, 'null'));

  it('date should be date.toJSON()', createTest(date, `"${date.toJSON()}"`));

  it('true should be true', createTest(true, 'true'));

  it('Symbol should be ""', createTest(Symbol('test'), ''));

  it('1 should be 1', createTest(1, '1'));

  it('1 should be 2', createTest(1, '2', () => 2));

  it('"\\n" should be "\\\\n"', createTest('\n', '"\\n"'));

  it('"漢字" should be "漢字"', createTest('漢字', '"漢字"'));

  // it('"\\u009f" should be "\\\\u009f"', createTest('\u009f', '"\\u009f"'));

  it('{} should be {}', createTest({}, '{}'));

  it('/regex/gi should be {}', createTest(/regex/gi, '{}'));

  it('{undefined:null} should be {"undefined":null}', createTest({ undefined: null }, '{"undefined":null}'));

  it('{"":null} should be {"":null}', createTest({ "": null }, '{"":null}'));

  it('{a:undefined} should be {}', createTest({ a: undefined }, '{}'));

  it('{a:null} should be {"a":null}', createTest({ a: null }, '{"a":null}'));

  if (typeof BigInt !== 'undefined') {
    it('{a:0n} should be {"a":0}', createTest({ a: BigInt(0) }, '{"a":0}'));
  }

  it('{a:undefined} should be {"a":1}', createTest(
    {
      a: undefined,
    },
    '{"a":1}',
    (k, v) => {
      if (k) {
        expect(k).to.be('a');
        expect(v).to.be(undefined);
        return 1;
      }
      return v;
    }));

  it('{a:1, b:2} should be {"a":1}', createTest(
    {
      a: 1,
      b: 2,
    },
    '{"a":1}',
    (k, v) => {
      if (k === 'a') {
        expect(v).to.be(1);
        return v;
      }
      if (k === 'b') {
        expect(v).to.be(2);
        return undefined;
      }
      if (k === '') return v;
      expect(['a', 'b', '']).to.contain(k);
      return v;
    }));

  it('{a:1,b:2} should be {"b":2}', createTest(
    {
      a: 1,
      b: 2,
    },
    '{"b":2}',
    ['b']));

  it('{a:1} should be {"a":1}', createTest(
    {
      a: 1,
    },
    '{"a":1}'));

  it('{a:1,b:undefined} should be {"a":1}', createTest(
    {
      a: 1,
      b: undefined,
    },
    '{"a":1}'));

  it('{a:1,b:Promise(undefined)} should be {"a":1}', createTest(
    {
      a: 1,
      b: Promise.resolve(undefined),
    },
    '{"a":1}'));

  it('{a:function(){}, b: "b"} should be {"b":"b"}', createTest(
    {
      // tslint:disable-next-line:function-name
      a() {},
      b: 'b',
    },
    '{"b":"b"}'));

  it('[function(){}] should be [null]', createTest([function a() {}], '[null]'));

  it('[function(){}, undefined] should be [null,null]', createTest([function a() {}, undefined], '[null,null]'));

  it('{a:date} should be {"a":date.toJSON()}', createTest(
    {
      a: date,
    },
    `{"a":"${date.toJSON()}"}`));

  it('({a:1,b:{c:2}}) should be {"a":1,"b":{"c":2}}', createTest(
    {
      a: 1,
      b: {
        c: 2,
      },
    },
    '{"a":1,"b":{"c":2}}'));

  it('{a:[1], "b": 2} should be {"a":[1],"b":2}', createTest(
    {
      a: [1],
      b: 2,
    },
    '{"a":[1],"b":2}'));
  
  it('{a: array, "b": array } should be {"a":[],"b":[]}', () => {
    const array = [];
    const data = { a: array, b: array };
    return createTest(data, '{"a":[],"b":[]}')();
  });

  it('{ partiallyEvaluated: { resolved: array }, evaluated: array } should be {"partiallyEvaluated":{"resolved":[]},"evaluated":[]}', () => {
    const array = [];
    const data = { raw: { reference: "/items" }, partiallyEvaluated: { resolved: array }, evaluated: array, };
    return createTest(data, '{"raw":{"reference":"/items"},"partiallyEvaluated":{"resolved":[]},"evaluated":[]}')();
  });

  it('[] should be []', createTest([], '[]'));

  it('[[[]],[[]]] should be [[[]],[[]]]', createTest(
    [
      [
      [],
      ],
      [
      [],
      ],
    ],
    '[[[]],[[]]]'));

  it('[1, undefined, 2] should be [1,null,2]', createTest([1, undefined, 2], '[1,null,2]'));

  it('[1, , 2] should be [1,null,2]', createTest([1, , 2], '[1,null,2]'));

  it('[1,\'a\'] should be [1,"a"]', createTest([1, 'a'], '[1,"a"]'));

  it('Promise(1) should be 1', createTest(Promise.resolve(1), '1'));

  it('Promise(Promise(1)) should be 1', createTest(Promise.resolve(Promise.resolve(1)), '1'));

  it('Promise(fakePromise(Promise.resolve(1))) should be 1', createTest(
    {
      then(fn) {
        return fn(Promise.resolve(1));
      },
    },
    '1'));

  it('Promise.reject(Error) should emit Error', () => {
    const err = new Error('should emit error');
    return createTest(new Promise((resolve, reject) => reject(err)), '')()
      .then(
        () => new Error('exepected error to be emitted'),
        err1 => expect(err1).to.be(err),
      );
  });

  it('{a:Promise(1)} should be {"a":1}', createTest({ a: Promise.resolve(1) }, '{"a":1}'));

  it('readableStream(1) should be [1]', createTest(readableStream(1), '[1]'));

  it('Promise(readableStream(1)) should be [1]', createTest(Promise.resolve(readableStream(1)), '[1]'));

  it('{a:[readableStream(1, Error, 2)]} should emit Error', () => {
    const err = new Error('should emit error');
    return createTest({
      a: [readableStream(1, emitError(err), 2)],
    }, '')()
      .then(() => new Error('exepected error to be emitted'), (err1) => {
        expect(err1).to.be(err);
      });
  });

  it('readableStream(1, 2, 3, 4, 5, 6, 7).resume() should emit Error', () => {
    return createTest(readableStream(1, 2, 3, 4, 5, 6, 7).resume(), '[1,2,3,4,5,6,7]')()
      .then(() => new Error('exepected error to be emitted'), (err) => {
        expect(err.message).to.be('Readable Stream is in flowing mode, data may have been lost. Trying to pause stream.');
      });
  });

  it('EndedReadableStream(1, 2, 3, 4, 5, 6, 7) should emit Error', () => {
    const stream = readableStream(1, 2, 3, 4, 5, 6, 7);
    return createTest(new Promise(resolve => stream.once('end', () => resolve(stream)).resume()), '[1,2,3,4,5,6,7]')()
      .then(() => new Error('exepected error to be emitted'), (err) => {
        expect(err.message).to.be('Readable Stream has ended before it was serialized. All stream data have been lost');
      });
  });

  it('{a:ReadableStream(1,2,3)} should be {"a":[1,2,3]}', createTest({
    a: readableStream(1, 2, 3),
  },                                                                 '{"a":[1,2,3]}'));

  it('readableStream(\'a\', \'b\', \'c\') should be "abc"', createTest(readableStream('a', 'b', 'c'), '"abc"'));

  it('readableStream(\'a\', \'b\', \'c\') should be "abc"', () => {
    const stream = new Readable();
    const args = ['a', 'b', 'c'];
    Object.assign(stream, {
      firstRead: true,
      // tslint:disable-next-line:function-name
      _read() {
        setTimeout(() => {
          if (!args.length) return stream.push(null);
          const v = args.shift();
          return stream.push(v);
        }, 1);
      },
    });
    return createTest(stream, '"abc"')();
  });

  it('readableStream({}, \'a\', undefined, \'c\') should be [{},"a",null,"c"]', createTest(readableStream({}, 'a', undefined, 'c'), '[{},"a",null,"c"]'));

  it(`{ a: readableStream({name: 'name', date: date }) } should be {"a":[{"name":"name","date":"${date.toJSON()}"}]}`, createTest(
    {
      a: readableStream({
        name: 'name',
        // tslint:disable-next-line:object-shorthand-properties-first
        date,
      }),
    },
    `{"a":[{"name":"name","date":"${date.toJSON()}"}]}`));

  it(`{ a: readableStream({name: 'name', arr: [], date: date }) } should be {"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`, createTest(
    {
      a: readableStream({
        name: 'name',
        arr: [],
        // tslint:disable-next-line:object-shorthand-properties-first
        date,
      }),
    },
    `{"a":[{"name":"name","arr":[],"date":"${date.toJSON()}"}]}`));

  describe('space option', () => {
    it('{ a: 1 } should be {\\n  "a": 1\\n}', createTest({ a: 1 }, '{\n  "a": 1\n}', undefined, 2));

    it('[1] should be [\\n  1\\n  ]', createTest([1], '[\n  1\n]', undefined, 2));

    it('[1] should be [\\na1\\na]', createTest([1], '[\na1\n]', undefined, 'a'));
  });

  describe('cyclic structure', () => {
    const cyclicData0 : any = {};
    cyclicData0.a = cyclicData0;
    it('{ a: a } should be {"a":{"$ref":"$"}}', () => createTest(cyclicData0, '{"a":{"$ref":"$"}}', undefined, undefined, true));

    it('{ a: [], b: [] } should be {"a":[],"b":[]}', () => {
      const cyclicData : any = { a: [], b: [] };
      return createTest(cyclicData, '{"a":[],"b":[]}', undefined, undefined, true)();
    });
  
    it('{ a: a, b: a } should be {"a":[],"b":{"$ref":"$"}}', () => {
      const cyclicData : any = { a: [] };
      cyclicData.b = cyclicData.a;
      return createTest(cyclicData, '{"a":[],"b":{"$ref":"$[\\"a\\"]"}}', undefined, undefined, true)();
    });

    const cyclicData1 : any = {};
    cyclicData1.a = cyclicData1;
    cyclicData1.b = [cyclicData1, {
      a: cyclicData1,
    }];
    cyclicData1.b[3] = readableStream(cyclicData1.b[1]);
    it('{a: a, b: [a, { a: a },,readableStream(b.1)]} should be {"a":{"$ref":"$"},"b":[{"$ref":"$"},{"a":{"$ref":"$"}},null,[{"$ref":"$[\\"b\\"][1]"}]]}',
       createTest(cyclicData1, '{"a":{"$ref":"$"},"b":[{"$ref":"$"},{"a":{"$ref":"$"}},null,[{"$ref":"$[\\"b\\"][1]"}]]}', undefined, undefined, true));

    const cyclicData2 : any = {};
    const data2 = {
      a: 'deep',
    };
    cyclicData2.a = Promise.resolve({
      b: data2,
    });
    cyclicData2.b = data2;
    it('{ a: Promise({ b: { a: \'deep\' } }), b: a.b } should be {"a":{"b":{"a":"deep"}},"b":{"$ref":"$[\\"a\\"][\\"b\\"]"}}',
       createTest(cyclicData2, '{"a":{"b":{"a":"deep"}},"b":{"$ref":"$[\\"a\\"][\\"b\\"]"}}', undefined, undefined, true));
  });

  describe('circular structure', () => {
    const cyclicData0: any = {};
    cyclicData0.a = cyclicData0;
    it('{ a: $ } should emit error', () => createTest(cyclicData0, '')()
      .then(
        () => new Error('should emit error'),
        (err) => {
          expect(err.message).to.be('Converting circular structure to JSON');
        },
      ));

    it('Promise({ a: Promise($) }) should emit error', () => {
      const cyclicData1: any = {};
      cyclicData1.a = Promise.resolve(cyclicData1);
      return createTest(Promise.resolve(cyclicData1), '')()
        .then(
          () => new Error('should emit error'),
          (err) => {
            expect(err.message).to.be('Converting circular structure to JSON');
          },
        );
    });

    it('{ a: readableStream($) } should emit error', () => {
      const cyclicData2: any = {};
      cyclicData2.a = readableStream(cyclicData2);
      return createTest(readableStream(cyclicData2), '')()
        .then(
          () => new Error('should emit error'),
          (err) => {
            expect(err.message).to.be('Converting circular structure to JSON');
          },
        );
    });
  });

  describe('decycle should not be active', () => {
    const a = {
      foo: 'bar',
    };
    const arr = [a, a];
    it('[a, a] should be [{"foo":"bar"},{"foo":"bar"}]', createTest(arr, '[{"foo":"bar"},{"foo":"bar"}]'));
  });
});
