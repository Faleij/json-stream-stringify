'use strict';

const PassThrough = require('stream').PassThrough;
const isReadableStream = require('./utils').isReadableStream;

class CoStream extends PassThrough {
    constructor(args) {
        super();
        this._generator = this._makeGenerator.apply(this, args);
    }

    // You need to implement your logic in this generator
    * _makeGenerator() {
        yield new Error('You need to implement _makeGenerator');
    }

    // Handle results from generator
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
            // Pipe streams and continue feeding afterwards
            return result.value.once('end', () => this._handle(this._generator.next())).pipe(this, {
                end: false
            });
        }

        if (result.value instanceof Promise) {
            // Resolve promises
            return Promise.resolve(result.value).then((res) => {
                this._handle(this._generator.next(res));
            });
        }
    }

    // Read from stream
    _read(n) {
        super._read(n);

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

module.exports = CoStream;
