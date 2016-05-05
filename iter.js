'use strict';

class IterableObject {
    constructor (obj) {
        if (!(this instanceof IterableObject)) {
            return new IterableObject(obj);
        }
        this.obj = obj;
    }

    [Symbol.iterator]() {
        let nextIndex = 0;
        let keys = Object.keys(this.obj);
        let childIterator;

        const ctx = {
            depth: 0,
            type: this.type,
            next: () => {
                let mode = 'value';
                let child = childIterator && childIterator.next();
                if (child) {
                    if (child.done) {
                        childIterator = undefined;
                        child.done = false;
                        child.value.depth--;
                        child.value.key = keys[nextIndex-1];
                        child.value.mode = 'close';
                        return child;
                    } else {
                        child.done = false;
                        return child;
                    }
                }

                let key = keys[nextIndex];
                let val = this.obj[key];

                if (val && typeof val.toJSON === 'function') {
                    val = val.toJSON();
                }

                if (val && typeof val === 'object' && Object.prototype.toString.apply(val) !== '[object Array]') {
                    childIterator = IterableObject(val)[Symbol.iterator]();
                    childIterator.depth = ctx.depth + 1;
                    childIterator.type = Object;
                    mode = 'open';
                }

                let out = {
                    value: {
                        depth: ctx.depth,
                        key: key,
                        value: val,
                        mode: mode
                    },
                    done: nextIndex >= keys.length
                };

                nextIndex++;

                return out;
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


let iter = IterableObject({ a: 1, b: { deep: 'value' }, c: '2', date: new Date(), bool: true, fn: function () {}, arr: [1,2,{ a: 'b' }, false, new Date()] });

for(let obj of iter) console.log(obj)
