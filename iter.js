'use strict';

const Readable = require('stream').Readable;

class RecursiveIterableObject {
    constructor(obj) {
        // Save a copy of the root object so we can be memory effective
        if (obj && typeof obj.toJSON === 'function') {
            obj = obj.toJSON();
        }
        this.exclude = [Promise, Readable];
        this.obj = obj && typeof obj === 'object' && !(obj instanceof Promise) ? Object.assign({}, obj) : obj;
    }

    _shouldIterate(val) {
        return val && typeof val === 'object' && !(this.exclude.some(v => val instanceof v));
    }

    static _getType(obj) {
        return Array.isArray(obj) ? Array : obj instanceof Object ? Object : undefined
    }

    [Symbol.iterator]() {
        let isObject = typeof this.obj === 'object';
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
                let type;
                let key;
                let val;

                if (!opened) {
                    state = 'open';
                    opened = true;
                } else if (!closed && !keys.length) {
                    state = 'close';
                    closed = true;
                } else if (keys.length) {
                    state = 'value';
                    key = keys.shift();
                    val = key ? this.obj[key] : this.obj;

                    if (val && typeof val.toJSON === 'function') {
                        val = val.toJSON();
                    }

                    type = typeof val;

                    if (this._shouldIterate(val)) {
                        state = 'child';
                        childIterator = new RecursiveIterableObject(val)[Symbol.iterator]();
                        childIterator.ctxType = ctx.type;
                        childIterator.depth = ctx.depth + 1;
                        childIterator.type = RecursiveIterableObject._getType(val);
                    }

                    // Delete reference
                    this.obj[key] = undefined;
                } else if (typeof this.obj !== 'object' && !ctx.done) {
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
                        type: type,
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

/*
var iter = _makeIterator({ a: 1, b: { deep: 'value' }, c: '2', date: new Date(), bool: true, fn: function () {}, arr: [1,2,{ a: 'b' }, false, new Date()] });
var obj = iter.next();
while (!obj.done) {
    console.log(obj);
    obj = iter.next();
}
*/
/*
let data0 = { a: 1, b: { deep: 'value' }, c: '2', date: new Date(), bool: true, fn: function () {}, arr: [1,2,{ a: 'b' }, false, new Date()] };

let iter = new RecursiveIterableObject({});

for(let obj of iter) console.log(obj)

iter = new RecursiveIterableObject(1);

for(let obj of iter) console.log(obj)

let iter = new RecursiveIterableObject({ deep: { b: 'c'}, emptyDepp: {}, arr: [1, { a: 'b' }]});

for(let obj of iter) console.log(obj)
*/
let iter = new RecursiveIterableObject({ a: Promise.resolve({ a: 'value' }) });

require('co')(function* () {
        for(let obj of iter) {
            console.log(obj);

            if (obj.value instanceof Promise) {
                obj.attachChild(new RecursiveIterableObject(yield obj.value)[Symbol.iterator]())
            }

        }
})
