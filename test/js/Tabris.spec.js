describe("tabris", function() {

  var nativeBridge;
  var log;

  beforeEach(function() {
    nativeBridge = new NativeBridgeSpy();
    log = [];
    tabris._reset();
    tabris._init(nativeBridge);
    tabris.registerType("TestType", {});
  });

  afterEach(function() {
    delete tabris.TestType;
  });

  it("exports tabris object", function() {
    expect(module.exports).toBe(tabris);
  });

  describe("when used as a function", function() {

    it("returns a proxy with the given string as id and type", function() {
      var result = tabris("TestType");

      expect(result).toEqual(jasmine.any(tabris.TestType));
      expect(result.cid).toBe("TestType");
    });

    it("returns a proxy with translated id and type", function() {
      tabris.TestType._type = "CustomType";
      var result = tabris("TestType");

      expect(result).toEqual(jasmine.any(tabris.TestType));
      expect(result.cid).toBe("CustomType");
    });

    it("returns same proxy instance for the same id", function() {
      tabris.TestType._type = "CustomType";
      var result1 = tabris("TestType");
      var result2 = tabris("TestType");

      expect(result1).toBe(result2);
    });

    it("returns same proxy instance for the same translated id", function() {
      var result1 = tabris("TestType");
      var result2 = tabris("TestType");

      expect(result1).toBe(result2);
    });

    it("does not call create on native bridge", function() {
      tabris("TestType");

      expect(nativeBridge.calls().length).toBe(0);
    });

    it("fails for unknown types", function() {
      expect(function() {
        tabris("foo");
      }).toThrow();
    });

  });

  describe("_init", function() {

    it("can be called without a context", function() {
      expect(function() {
        tabris._init.call(null, nativeBridge);
      }).not.toThrow();
    });

    it("executes all load functions", function() {
      tabris.load(function() {
        log.push("foo");
      });
      tabris.load(function() {
        log.push("bar");
      });

      tabris._init.call(null, nativeBridge);

      expect(log).toEqual(["foo", "bar"]);
    });

    it("load functions can access tabris functions", function() {
      tabris._ready = false;
      tabris.load(function() {
        tabris.create("TestType");
      });

      tabris._init.call(null, nativeBridge);

      expect(nativeBridge.calls({op: "create", type: "TestType"}).length).toBe(1);
    });

  });

  describe("_notify", function() {

    var proxy;

    beforeEach(function() {
      tabris.TestType._trigger = {};
      proxy = tabris.create("TestType", {});
      spyOn(proxy, "trigger");
    });

    it("notifies widget proxy", function() {
      tabris._notify(proxy.cid, "foo", {bar: 23});

      expect(proxy.trigger).toHaveBeenCalledWith("foo", {bar: 23});
    });

    it("notifies widget proxy with translated event name", function() {
      tabris.TestType._trigger.foo = "bar";
      tabris._notify.call(window, proxy.cid, "foo", {});

      expect(proxy.trigger).toHaveBeenCalledWith("bar", {});
    });

    it("calls custom trigger", function() {
      tabris.TestType._trigger.foo = jasmine.createSpy();
      tabris._notify.call(window, proxy.cid, "foo", {bar: 23});

      expect(tabris.TestType._trigger.foo).toHaveBeenCalledWith({bar: 23});
    });

    it("ignores invalid custom trigger", function() {
      tabris.TestType._trigger.foo = true;
      tabris._notify.call(window, proxy.cid, "foo", {bar: 23});

      expect(proxy.trigger).toHaveBeenCalledWith("foo", {bar: 23});
    });

    it("silently ignores events for non-existing ids (does not crash)", function() {
      tabris._notify("no-id", "foo", [23, 42]);
      expect(proxy.trigger).not.toHaveBeenCalled();
    });

    it("can be called without a context", function() {
      tabris._notify.call(null, proxy.cid, "foo", [23, 42]);

      expect(proxy.trigger).toHaveBeenCalledWith("foo", [23, 42]);
    });

  });

  describe("load", function() {

    beforeEach(function() {
      delete tabris._nativeBridge;
      tabris._ready = false;
    });

    it("function is not executed before start time", function() {
      var fn = jasmine.createSpy();
      tabris.load(fn);

      expect(fn).not.toHaveBeenCalled();
    });

    it("function is executed at start time", function() {
      var fn = jasmine.createSpy();

      tabris.load(fn);
      tabris._init(nativeBridge);

      expect(fn).toHaveBeenCalled();
    });

    it("nested load functions are executed at the end", function() {
      var log = [];

      tabris.load(function() {
        log.push("1");
        tabris.load(function() {
          log.push("1a");
        });
        tabris.load(function() {
          log.push("1b");
        });
      });
      tabris.load(function() {
        log.push("2");
      });
      tabris._init(nativeBridge);

      expect(log).toEqual(["1", "2", "1a", "1b"]);
    });

    it("runs immediately if already started", function() {
      var fn = jasmine.createSpy();

      tabris._init(nativeBridge);
      tabris.load(fn);

      expect(fn).toHaveBeenCalled();
    });

  });

  describe("create", function() {

    it("fails if tabris.js not yet started", function() {
      tabris._ready = false;
      delete tabris._nativeBridge;

      expect(function() {
        tabris.create("TestType", {});
      }).toThrowError("tabris.js not started");
    });

    it("fails if type is unknown", function() {
      expect(function() {
        tabris.create("UnknownType", {});
      }).toThrowError("Unknown type UnknownType");
    });

    it("creates a non-empty widget id", function() {
      var proxy = tabris.create("TestType", {});

      expect(typeof proxy.cid).toBe("string");
      expect(proxy.cid.length).toBeGreaterThan(0);
    });

    it("creates different widget ids for subsequent calls", function() {
      var proxy1 = tabris.create("TestType", {});
      var proxy2 = tabris.create("TestType", {});

      expect(proxy1.cid).not.toEqual(proxy2.cid);
    });

    it("returns a proxy object", function() {
      var result = tabris.create("TestType", {});

      expect(result).toEqual(jasmine.any(tabris.Proxy));
    });

    it("prints a warning if given type is an alias", function() {
      tabris.Alias = tabris.TestType;
      spyOn(console, "warn");

      var result = tabris.create("Alias", {});

      expect(result.type).toBe("TestType");
      expect(console.warn).toHaveBeenCalledWith("\"Alias\" is deprecated, use \"TestType\"");
    });

    it("triggers a create operation with type and properties", function() {
      var proxy = tabris.create("TestType", {foo: 23});

      var createCall = nativeBridge.calls({op: "create", id: proxy.cid})[0];

      expect(createCall.type).toBe("TestType");
      expect(createCall.properties.foo).toBe(23);
    });

    it("executes type translations", function() {
      var proxy = tabris.create("CheckBox", {});

      var createCall = nativeBridge.calls({op: "create", id: proxy.cid})[0];

      expect(createCall.type).toBe("rwt.widgets.Button");
    });

  });

  describe("register types", function() {

    afterEach(function() {
      delete tabris.CustomType;
    });

    it("allows to register a new type", function() {
      var members = {foo: 23};
      tabris.registerType("CustomType", members);
      var instance = tabris.create("CustomType");
      expect(instance).toEqual(jasmine.any(tabris.Proxy));
      expect(instance).toEqual(jasmine.any(tabris.CustomType));
    });

    it("adds members to new type", function() {
      var members = {foo: 23};
      tabris.registerType("CustomType", members);
      var instance = tabris.create("CustomType");
      expect(instance.foo).toBe(23);
      expect(instance.type).toBe("CustomType");
    });

    it("calls 'create' with type", function() {
      tabris.registerType("CustomType", {});
      tabris.create("CustomType");

      expect(nativeBridge.calls({op: "create"})[0].type).toBe("CustomType");
    });

    it("calls 'create' with _type if present", function() {
      tabris.registerType("CustomType", {_type: "foo.Type"});
      tabris.create("CustomType");

      expect(nativeBridge.calls({op: "create"})[0].type).toBe("foo.Type");
    });

    it("prevents to overwrite already registered types", function() {
      expect(function() {
        tabris.registerType("Button", {});
      }).toThrowError("Type already registered: Button");
    });

    it("adds _trigger to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_trigger: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._trigger.foo).toBe(fn);
      expect(instance._trigger).toBe(tabris.Proxy.prototype._trigger);
    });

    it("adds empty trigger map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._trigger).toEqual({});
    });

    it("adds _listen to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_listen: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._listen.foo).toBe(fn);
      expect(instance._listen).toBe(tabris.Proxy.prototype._listen);
    });

    it("adds empty listen map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._listen).toEqual({});
    });

    it("adds _setProperty to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_setProperty: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._setProperty.foo).toBe(fn);
      expect(instance._setProperty).toBe(tabris.Proxy.prototype._setProperty);
    });

    it("adds empty setProperty map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._setProperty).toEqual({});
    });

    it("adds _getProperty to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_getProperty: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._getProperty.foo).toBe(fn);
      expect(instance._getProperty).toBe(tabris.Proxy.prototype._getProperty);
    });

    it("adds empty getProperty map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._getProperty).toEqual({});
    });

    it("adds _properties to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_properties: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._properties.foo).toBe(fn);
      expect(instance._properties).toBe(tabris.Proxy.prototype._properties);
    });

    it("adds empty checkProperty map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._properties).toEqual({});
    });

    it("adds _type to constructor", function() {
      tabris.registerType("CustomType", {_type: "foo"});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._type).toBe("foo");
      expect(instance._type).toBeUndefined();
    });

  });

});
