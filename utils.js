'use strict';

module.exports = {
    isReadableStream: function (obj) {
        return obj &&
            typeof obj.pipe === 'function' &&
            typeof obj._read === 'function' &&
            typeof obj._readableState === 'object';
    }
};
