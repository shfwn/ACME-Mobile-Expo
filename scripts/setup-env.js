globalThis.__DEV__ = true;
globalThis.expo = globalThis.expo || {
  EventEmitter: class EventEmitter {
    addListener() {
      return { remove() {} };
    }
    emit() {}
  },
  modules: {},
};

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return originalRequire.call(this, 'react-native-web');
  }
  return originalRequire.call(this, id);
};
