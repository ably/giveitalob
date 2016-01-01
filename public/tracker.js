var Lob = (function () { 'use strict';

	function __commonjs(fn, module) { return module = { exports: {} }, fn(module, module.exports), module.exports; }

	/* jshint esnext: true */

	function KeyError(key) {
	  this.name = "KeyError";
	  this.message = "key \"" + key + "\" not found";
	  this.stack = (new Error()).stack;
	}
	KeyError.prototype = Object.create(Error.prototype);
	KeyError.prototype.constructor = KeyError;

	function Struct(defaults, source){
	  "use strict";
	  if ( !(this instanceof Struct) ) { return new Struct(defaults, source); }

	  Object.assign(this, defaults);
	  for (var key in source) {
	    if (source.hasOwnProperty(key)) {
	      if (!this.hasOwnProperty(key)) {
	        throw new KeyError(key);
	      }
	      this[key] = source[key];
	    }
	  }
	  Object.freeze(this);
	}

	Struct.prototype.hasKey = function (key) {
	  return Object.keys(this).indexOf(key) !== -1;
	};

	Struct.prototype.fetch = function (key) {
	  if (this.hasKey(key)) {
	    return this[key];
	  } else {
	    throw new KeyError(key);
	  }
	};

	Struct.prototype.set = function (key, value) {
	  if (this[key] === value) {
	    return this;
	  }
	  var tmp = {};
	  tmp[key] = value;
	  return this.merge(tmp);
	};

	Struct.prototype.update = function (key, operation) {
	  return this.set(key, operation(this[key]));
	};

	Struct.prototype.merge = function (other) {
	  return Struct(this, other);
	};

	var STATE_DEFAULTS = {
	  uplinkStatus: "UNKNOWN",
	  latestReading: null, // DEBT best place a null object here
	  currentFlight: [],
	  flightHistory: [],
	};

	function State(raw){
	  if ( !(this instanceof State) ) { return new State(raw); }

	  return Struct.call(this, STATE_DEFAULTS, raw);
	}

	State.prototype = Object.create(Struct.prototype);
	State.prototype.constructor = State;

	function Tracker(raw_state){
	  var tracker = this;
	  tracker.state = State(raw_state);

	  function logInfo() {
	    tracker.logger.info.apply(tracker.logger, arguments);
	  }

	  function projectState(state){
	    return {
	      x: state.latestReading
	      // channel: state.channelName,
	      // token: state.token.slice(0, 4) + "..."
	    };
	  }
	  var view;
	  tracker.showcase = {
	    dispatch: function(state){
	      // var projection = new Projection(state);
	      if(view){
	        view(projectState(state));
	      }
	    },
	    register: function(newView){
	      newView(projectState(tracker.state));
	      view = newView;
	    }
	  };

	  // The tracker application has an internal state.
	  // All observers know that the can watch a given projection of that state
	  // project and present overloaded verbs.
	  // options showcase or exhibit
	  function showcase(state){
	    // The tracker just cares that its state is shown somewhere
	    tracker.showcase.dispatch(state);
	  }

	  tracker.uplinkAvailable = function(){
	    // Set state action can cause projection to exhibit new state
	    tracker.state = tracker.state.set("uplinkStatus", "AVAILABLE");
	    // call log change. test listeners that the state has changed.
	    logInfo("[Uplink Available]");
	    showcase(tracker.state);
	  };

	  tracker.newReading = function(reading){
	    var state = tracker.state.set("latestReading", reading);
	    var currentFlight = state.currentFlight;
	    var flightHistory = state.flightHistory;
	    if (reading.magnitude < 4) {
	      currentFlight =  currentFlight.concat(reading);
	    } else if(currentFlight[0]) {
	      // DEBT concat splits array so we double wrap the flight
	      flightHistory = flightHistory.concat([currentFlight]);
	      currentFlight = [];
	    }
	    state = state.set("currentFlight", currentFlight);
	    state = state.set("flightHistory", flightHistory);
	    tracker.state = state;
	    // DEBT might want to log this action too
	  };

	  tracker.resetReadings = function(){
	    tracker.state = tracker.state.merge({
	      latestReading: null,
	      currentFlight: [],
	      flightHistory: []
	    });
	  };
	}

	var index$2 = __commonjs(function (module) {
	'use strict';
	module.exports = function (str) {
		return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
			return '%' + c.charCodeAt(0).toString(16);
		});
	};
	});

	var require$$0 = (index$2 && typeof index$2 === 'object' && 'default' in index$2 ? index$2['default'] : index$2);

	var index = __commonjs(function (module, exports) {
	'use strict';
	var strictUriEncode = require$$0;

	exports.extract = function (str) {
		return str.split('?')[1] || '';
	};

	exports.parse = function (str) {
		if (typeof str !== 'string') {
			return {};
		}

		str = str.trim().replace(/^(\?|#|&)/, '');

		if (!str) {
			return {};
		}

		return str.split('&').reduce(function (ret, param) {
			var parts = param.replace(/\+/g, ' ').split('=');
			// Firefox (pre 40) decodes `%3D` to `=`
			// https://github.com/sindresorhus/query-string/pull/37
			var key = parts.shift();
			var val = parts.length > 0 ? parts.join('=') : undefined;

			key = decodeURIComponent(key);

			// missing `=` should be `null`:
			// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
			val = val === undefined ? null : decodeURIComponent(val);

			if (!ret.hasOwnProperty(key)) {
				ret[key] = val;
			} else if (Array.isArray(ret[key])) {
				ret[key].push(val);
			} else {
				ret[key] = [ret[key], val];
			}

			return ret;
		}, {});
	};

	exports.stringify = function (obj) {
		return obj ? Object.keys(obj).sort().map(function (key) {
			var val = obj[key];

			if (val === undefined) {
				return '';
			}

			if (val === null) {
				return key;
			}

			if (Array.isArray(val)) {
				return val.sort().map(function (val2) {
					return strictUriEncode(key) + '=' + strictUriEncode(val2);
				}).join('&');
			}

			return strictUriEncode(key) + '=' + strictUriEncode(val);
		}).filter(function (x) {
			return x.length > 0;
		}).join('&') : '';
	};
	});

	var parse = index.parse;

	var URI_DEFAULTS = {
	  path: [],
	  query: {},
	};

	function URI(raw){
	  if ( !(this instanceof URI) ) { return new URI(raw); }

	  return Struct.call(this, URI_DEFAULTS, raw);
	}

	URI.prototype = Object.create(Struct.prototype);
	URI.prototype.constructor = URI;

	function parseLocation(location){
	  var query = parse(location.search);
	  var path = location.pathname.substring(1).split("/");
	  return new URI({path: path, query: query});
	}

	// Could also be called UplinkDriver - might be more suitable
	// RESPONSIBILITY - Drive the tracker application in response to messages from the Ably uplink

	/* jshint esnext: true */
	function UplinkController(options, tracker){
	  var channelName = options.channel;
	  var token = options.token;
	  var realtime = new Ably.Realtime({ token: token });
	  realtime.connection.on("connected", function(err) {
	    // If we keep explicitly passing channel data to the controller we should pass it to the main app here
	    tracker.uplinkAvailable();
	  });
	  realtime.connection.on("failed", function(err) {
	    tracker.uplinkFailed();
	  });
	  var channel = realtime.channels.get(channelName);
	  channel.subscribe("newReading", function(event){
	    // new Vector(event.data);
	    tracker.newReading(event.data);
	  });
	  channel.subscribe("resetReadings", function(_event){
	    // event information not needed
	    tracker.resetReadings();
	  });
	}

	// uplink controller does very little work so it is not separated from uplink

	// function Uplink(options, logger){
	//   var channelName = options.channel;
	//   var token = options.token;
	//   var realtime = new Ably.Realtime({ token: token });
	//   var channel = realtime.channels.get(channelName);
	//   realtime.connection.on("connected", function(err) {
	//     console.log("realtime connected");
	//   });
	//   realtime.connection.on("failed", function(err) {
	//     console.log("realtime connection failed");
	//   });
	// }

	var tracker = new Tracker();
	tracker.logger = window.console;

	var uri = parseLocation(window.location);

	var uplinkController = new UplinkController({
	  token: uri.query.token,
	  channel: uri.query.channel
	}, tracker);

	function ConsoleView(logger){
	  function wrap(projection){
	    return "listening on: " + projection.channel + " with token: " + projection.token;
	    // returns presentation
	  }

	  this.render = function(projection){
	    logger.info(wrap(projection));
	  };
	}

	var consoleView = new ConsoleView(window.console);
	tracker.showcase.register(consoleView.render);
	// Dom views should be initialized with the ready on certain selectors library

	return tracker;

})();
//# sourceMappingURL=tracker.js.map