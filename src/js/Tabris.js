(function(module) {

  window.tabris = module.exports = util.extend(function(id) {
    if (!tabris._proxies[id] && !tabris[id]) {
      throw new Error("No native object with id or type " + id);
    }
    var nativeId = tabris[id] && tabris[id]._type ? tabris[id]._type : id;
    return nativeId in tabris._proxies ? tabris._proxies[nativeId] : new tabris[id](nativeId);
  }, {

    _loadFunctions: [],
    _proxies: {},
    _ready: false,

    load: function(fn) {
      if (tabris._ready) {
        fn.call();
      } else {
        tabris._loadFunctions.push(fn);
      }
    },

    create: function(type, properties) {
      if (!tabris._nativeBridge) {
        throw new Error("tabris.js not started");
      }
      if (!(type in tabris)) {
        throw new Error("Unknown type " + type);
      }
      if (tabris[type].prototype.type !== type) {
        console.warn("\"" + type + "\" is deprecated, use \"" + tabris[type].prototype.type + "\"");
      }
      return new tabris[type]()._create(properties || {});
    },

    registerType: function(type, members) {
      if (type in tabris) {
        throw new Error("Type already registered: " + type);
      }
      tabris[type] = function() {
        tabris.Proxy.apply(this, arguments);
      };
      for (var member in staticMembers) {
        tabris[type][member] = members[member] || getDefault(member);
      }
      var superProto = util.omit(members, Object.keys(staticMembers));
      superProto.type = type;
      superProto.constructor = tabris[type]; // util.extendPrototype can not provide the original
      tabris[type].prototype = util.extendPrototype(tabris.Proxy, superProto);
    },

    version: "${VERSION}",

    _init: function(client) {
      tabris.off();
      tabris._client = client;
      tabris._nativeBridge = new tabris.NativeBridge(client);
      var i = 0;
      while (i < tabris._loadFunctions.length) {
        tabris._loadFunctions[i++].call();
      }
      tabris._ready = true;
    },

    _setEntryPoint: function(entryPoint) {
      this._entryPoint = entryPoint;
    },

    _notify: function(id, event, param) {
      try {
        var proxy = tabris._proxies[id];
        if (proxy) {
          try {
            proxy._trigger(event, param);
          } catch (error) {
            console.error(error);
            console.log(error.stack);
          }
        }
        tabris.trigger("flush");
      } catch (ex) {
        console.error(ex);
        console.log(ex.stack);
      }
    },

    _reset: function() {
      this._loadFunctions = [];
      this._proxies = {};
    }

  });

  function getDefault(member) {
    var value = staticMembers[member];
    return value instanceof Object ? util.clone(value) : value;
  }

  var staticMembers = {
    "_trigger": {},
    "_listen": {},
    "_setProperty": {},
    "_getProperty": {},
    "_initProperties": {},
    "_type": null,
    "_properties": {},
    "_supportsChildren": false
  };

}(typeof module !== "undefined" ? module : {}));
