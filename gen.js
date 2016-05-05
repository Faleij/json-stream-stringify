'use strict';

const Readable = require('stream').Readable;

function aPromise() {
    return new Promise(resolve => setTimeout(() => resolve('abc'), 1000));
}

class CoStream extends Readable {
    constructor(args) {
        super();
        this._generator = this._makeGenerator.apply(this, args);
    }

    * _makeGenerator() {
        yield new Error('Not Implemented');
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

        if (result.value instanceof Promise) {
            // Resolve promises
            return Promise.resolve(result.value).then((res) => {
                this._running = true;
                this._handle(this._generator.next(res));
            });
        }
    }

    _read(n) {
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

class IterableObject {
    constructor(obj) {
        // Save a copy of the root object so we can be memory effective
        this.obj = Object.assign({}, obj);
    }

    [Symbol.iterator]() {
        let nextIndex = 0;
        let keys = Object.keys(this.obj);
        let childIterator;

        const ctx = {
            depth: 0,
            type: this.type,
            next: () => {
                // output mode for current iteration
                let mode = 'value';
                let child = childIterator && childIterator.next();
                if (child) {
                    if (child.done) {
                        child.done = false;
                        child.value.depth--;
                        child.value.key = childIterator.key;
                        child.value.mode = 'close';

                        childIterator = undefined;

                        return child;
                    }

                    child.done = false;
                    return child;
                }

                let key = keys.shift();
                let val = this.obj[key];

                if (val && val instanceof Function) {
                    keys.shift();
                    return ctx.next();
                }

                if (val && typeof val.toJSON === 'function') {
                    val = val.toJSON();
                }

                if (val && typeof val === 'object' && Object.prototype.toString.apply(val) !== '[object Array]' && !(val instanceof Promise)) {
                    childIterator = new IterableObject(val)[Symbol.iterator]();
                    childIterator.depth = ctx.depth + 1;
                    childIterator.type = Object;
                    childIterator.key = key;
                    mode = 'open';
                }

                let out = {
                    value: {
                        depth: ctx.depth,
                        key: key,
                        value: val,
                        mode: mode
                    },
                    done: !key && !keys.length
                };

                // Delete reference
                this.obj[key] = undefined;

                return out;
            }
        };

        return ctx;
    }
}

class JSONStreamify extends CoStream {
    constructor(obj) {
        super(arguments);
    }

    * _makeGenerator(value) {
        if (value && typeof value !== 'object') {
            return yield this.push(JSON.stringify(value));
        }

        if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

        if (value && typeof value === 'object' && Object.prototype.toString.apply(value) !== '[object Array]') {
            yield this.push('{');
            let iter = new IterableObject(value);
            let first = true;
            for (let obj of iter) {
                if (obj.mode === 'close') {
                    yield this.push('}');
                    continue;
                }

                if (!first) {
                    yield this.push(',');
                }

                if (Object.prototype.toString.apply(obj.value) === '[object Array]') {
                    // TODO
                }

                if (obj.key) {
                    yield this.push(JSON.stringify(obj.key) + ':');

                    if (obj.mode === 'open') {
                        yield this.push('{');
                        first = true;
                        continue;
                    }


                    if (obj.value instanceof Promise) {
                        obj.value = yield obj.value;
                    }

                    yield this.push(JSON.stringify(obj.value));
                }

                first = false;
            }

            yield this.push('}');
        }
    }
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
    promise: aPromise()
};

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





/*

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
