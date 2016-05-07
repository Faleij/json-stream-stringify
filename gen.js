'use strict';

const Readable = require('stream').Readable;
const Transform = require('stream').Transform;
const PassThrough = require('stream').PassThrough;

class CoStream extends Readable {
    constructor(args) {
        super();
        this._generator = this._makeGenerator.apply(this, args);
    }

    * _makeGenerator() {
        yield new Error('You need to implement _makeGenerator');
    }

    _handle(result) {
        if (result.value === false) {
            // Abort feed
            this._running = false;
            return;
        }

        if (result.value === true) {
            // Continue to feed
            this._handle(this._generator.next());
            return;
        }

        if (result.done) {
            // Feeding done
            this._done = result.done;
            return this.push(null);
        }

        if (isReadableStream(result.value)) {
            this._source = result.value;
            this._source
                .on('data', chunk => {
                    if (!this.push(chunk)) {
                        this._source.pause();
                    }
                })
                .once('end', () => {
                    this._source = undefined;
                    this._handle(this._generator.next());
                });
            return;
        }

        if (result.value instanceof Promise) {
            // Resolve promises
            return Promise.resolve(result.value).then((res) => {
                this._handle(this._generator.next(res));
            });
        }
    }

    _read(n) {
        if (this._source) {
            this._source.resume();
            return true;
        }

        if (this._done) {
            return false;
        }

        if (!this._running) {
            this._running = true;
            this._handle(this._generator.next());
        }

        return !this._done;
    }
}

class RecursiveIterableObject {
    constructor(obj) {
        // Save a copy of the root object so we can be memory effective
        if (obj && typeof obj.toJSON === 'function') {
            obj = obj.toJSON();
        }
        this.exclude = [Promise, Readable];
        this.obj = this._shouldIterate(obj) ? Array.isArray(obj) ? obj.slice(0) : Object.assign({}, obj) : obj;
    }

    _shouldIterate(val) {
        return val && typeof val === 'object' && !(this.exclude.some(v => val instanceof v));
    }

    static _getType(obj) {
        return Array.isArray(obj) ? Array : obj instanceof Object ? Object : undefined
    }

    [Symbol.iterator]() {
        let isObject = this._shouldIterate(this.obj);
        let nextIndex = 0;
        let keys = isObject && Object.keys(this.obj);
        let childIterator;

        let closed = !isObject;
        let opened = closed;

        const attachIterator = iterator => childIterator = iterator;
        const ctx = {
            depth: 0,
            type: RecursiveIterableObject._getType(this.obj),
            next: () => {
                let child = childIterator && childIterator.next();
                if (child) {
                    if (!child.done) {
                        return child;
                    }
                    childIterator = undefined;
                }

                let state;
                let key;
                let val;

                if (!opened) {
                    state = 'open';
                    opened = true;
                } else if (!closed && !keys.length) {
                    state = 'close';
                    closed = true;
                } else if (keys && keys.length) {
                    state = 'value';
                    key = keys.shift();
                    val = this.obj[key];

                    if (val && typeof val.toJSON === 'function') {
                        val = val.toJSON();
                    }


                    if (this._shouldIterate(val)) {
                        state = 'child';
                        childIterator = new RecursiveIterableObject(val)[Symbol.iterator]();
                        childIterator.ctxType = ctx.type;
                        childIterator.depth = ctx.depth + 1;
                        childIterator.type = RecursiveIterableObject._getType(val);
                    }

                    // Delete reference
                    this.obj[key] = undefined;
                } else if (!isObject && !ctx.done) {
                    state = 'value';
                    val = this.obj;
                    ctx.done = true;
                }

                return {
                    value: {
                        depth: ctx.depth,
                        key: key,
                        value: val,
                        state: state,
                        ctxType: ctx.type,
                        attachChild: attachIterator
                    },
                    done: !state
                };
            }
        };

        return ctx;
    }
}

function isReadableStream(obj) {
    return obj &&
        obj instanceof Object &&
        obj._read && obj._readableState &&
        typeof(obj._read === 'function') &&
        typeof(obj._readableState === 'object');
}

class JSONStreamify extends CoStream {
    constructor(obj) {
        super(arguments);
    }

    * _makeGenerator(value) {
        let iter = new RecursiveIterableObject(value);
        let insertSeparator = false;
        for (let obj of iter) {
            if (obj.state === 'close') {
                yield this.push(obj.ctxType === Object ? '}' : ']');
                continue;
            }

            if (obj.state === 'open') {
                insertSeparator = false;
                yield this.push(obj.ctxType === Object ? '{' : '[');
                continue;
            }

            if (insertSeparator) {
                yield this.push(',');
            }

            if (obj.key && obj.ctxType !== Array) {
                yield this.push(JSON.stringify(obj.key) + ':');
            }

            if (isReadableStream(obj.value)) {
                if (!obj.value._readableState.objectMode) {
                    yield this.push('"');
                    yield obj.value.pipe(new Transform({
                        transform: (data, enc, next) => next(null, JSON.stringify(data.toString()).slice(1,-1))
                    }));
                    yield this.push('"');
                    continue;
                }

                yield this.push('[');
                let first = true;
                var pass = new PassThrough();
                obj.value.pipe(new Transform({
                    objectMode: true,
                    transform: function (data, enc, next) {
                        if (!first) {
                            pass.push(',');
                        }
                        first = false;
                        // TODO: stream flow controll
                        new JSONStreamify(data).once('end', () => next(null, undefined)).pipe(pass, { end: false });
                    }
                })).once('end', () => pass.end()).resume();
                yield pass;
                yield this.push(']');
                continue;
            }

            if (obj.value instanceof Promise) {
                obj.value = obj.attachChild(new RecursiveIterableObject(yield obj.value)[Symbol.iterator]());
                insertSeparator = false;
                continue;
            }

            if (obj.state === 'value') {
                yield this.push(JSON.stringify(obj.value));
            }

            insertSeparator = true;
        }
    }
}


module.exports = JSONStreamify;


/*
function aPromise() {
    return new Promise(resolve => setTimeout(() => resolve('abc'), 1000));
}

const data = {
    a: 1,
    b: {
        deep: 'value'
    },
    c: '2',
    date: new Date(),
    bool: true,
    fn: function() {},
    arr: [1, 2, {
        a: 'b'
    }, false, new Date()],
    promise: aPromise(),
    stream: new Readable({ read: () => undefined, objectMode: false}),
    objStream: new Readable({ read: () => undefined, objectMode: true})
};

data.stream.push('some text');
data.stream.push(' that get concatinated');
data.stream.push(null);

data.objStream.push({ deep: 'shit' });
data.objStream.push('strings works too');
data.objStream.push(null);

var num = 3;
var time = process.hrtime();
Array.apply(null, Array(num)).reduce((p) => p.then(() => aPromise().then(() => JSON.stringify(data))), Promise.resolve()).then(() => {
    var diff = process.hrtime(time);
    console.log('benchmark took %d nanoseconds', (diff[0] * 1e9 + diff[1]) / num);

    time = process.hrtime();
    var s = new JSONStreamify(data);
    s.pipe(process.stdout);
    s.once('end', () => {
        let diff = process.hrtime(time);
        console.log('benchmark took %d nanoseconds', diff[0] * 1e9 + diff[1]);
    });
});
class TestStream extends Readable {
    constructor(options) {
        super(options);
    }

    _read(n) {
        setTimeout(() => this.push('x'), 1000);
    }
}


var s = new TestStream();
s.pipe(process.stdout);

JSONStreamify.prototype._str = co.wrap(function (key, holder) {
    var value = holder[key];

    if (value && typeof value === 'object' && typeof value.then === 'function') {
        value = yield value;
    }

    if (value && typeof value === 'object' && value instanceof stream.Readable) {
        value = yield value;
    }

})

function makeIterator(obj){
    var nextIndex = 0;
    var keys = Object.keys(obj);

    return {
       next: function(){
           return nextIndex < array.length ?
               {value: obj[keys[nextIndex]], key: keys[nextIndex++], done: false} :
               {done: true};
       }
    }
}

function* walk(obj) {
    yield Object.keys(obj).forEach(function *(key) {

        yield { key: key, value: value }
    })

}

var gen = makeIterator({ a: 'b', c: 'd', e: 'f' })
*/
