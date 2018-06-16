import { PassThrough } from 'stream';
import { isReadableStream, isPromise } from './utils';

class CoStream extends PassThrough {
  constructor(...args) {
    super();
    this._generator = this._makeGenerator(...args);
  }

  // You need to implement your logic in this generator
  // eslint-disable-next-line class-methods-use-this
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
      this.push(null);
      return;
    }

    if (isReadableStream(result.value)) {
      // Pipe streams and continue feeding afterwards
      result.value.once('end', () => this._handle(this._generator.next())).pipe(this, {
        end: false,
      });
      return;
    }

    if (isPromise(result.value)) {
      // Resolve promises
      Promise.resolve(result.value).then((res) => {
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

export default CoStream;
