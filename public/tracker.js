var Lob = (function () { 'use strict';

  var Config = {
    readingPublishLimit: 200, // ms
    flightPublishLimit: 1000, // ms
    trackingGraphTimePeriod: 8000, // ms - time to keep points in visible graph
    gravityMagnitudeConstant: 10, // default gravity magnitude value from accelerometer
    broadcastNewChannelName: 'broadcast:channel' /* replicated in app.rb */
  };

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
    uplinkChannelName: "UNKNOWN",
    uplinkDevice: null,
    flightSnapshot: null,
    alert: ""
  };

  function State(raw){
    if ( !(this instanceof State) ) { return new State(raw); }

    return Struct.call(this, STATE_DEFAULTS, raw);
  }

  State.prototype = Object.create(Struct.prototype);
  State.prototype.constructor = State;

  function Audio() {
    if ( !(this instanceof Audio) ) { return new Audio(); }

    ion.sound({
      sounds: [{ name: "pop_cork" }],
      volume: 1,
      path: "/images/audio/",
      preload: true
    });

    this.playDropSound = function() {
      ion.sound.play("pop_cork");
    }
  }

  var TRACKER_INVALID_STATE_MESSAGE = "Tracker did not receive valid initial state";

  /***
    The tracker application has an internal state.
    All observers know that the can watch a given projection of that state
    project and present overloaded verbs.
    options showcase or exhibit
    function showcase(state){
      // The tracker just cares that its state is shown somewhere
      tracker.showcase.dispatch(state);
  ***/

  function Tracker(state, world){
    if ( !(this instanceof Tracker) ) { return new Tracker(state, world); }
    try {
      state = State(state || {});
    } catch (e) {
      // alert(e); DEBT throws in tests
      throw new TypeError(TRACKER_INVALID_STATE_MESSAGE);
      // return; // Will be needed if we move the error handling to logger
    }
    var tracker = this;
    tracker.state = state;
    // DEBT return to external assignment
    world = world || {};
    tracker.logger = world.logger // Or error causing of silent version;

    tracker.audio = new Audio();

    tracker.uplinkAvailable = function(channelName){
      // Set state action can cause projection to exhibit new state
      tracker.state = tracker.state.set("uplinkStatus", "AVAILABLE");
      tracker.state = tracker.state.set("uplinkChannelName", channelName);
      // call log change. test listeners that the state has changed.
      tracker.logger.info("Uplink available on channel:", channelName);
      showcase(tracker.state);
    };

    tracker.uplinkPresent = function(channelName, publishingMembers){
      if (publishingMembers.length === 0) {
        this.uplinkAvailable(channelName);
      } else {

        var deviceDescriptions = publishingMembers.filter(function(member) {
          return member.data.device;
        }).map(function(member) {
          return member.data.device;
        });

        if (tracker.state.uplinkStatus !== 'STREAMING') {
          tracker.state = tracker.state.set("uplinkStatus", "STREAMING");
          tracker.state = tracker.state.set("uplinkChannelName", channelName);
          tracker.state = tracker.state.set("uplinkDevice", deviceDescriptions[0]);
          tracker.logger.info("Uplink streaming", channelName);
          showcase(tracker.state);
        }
      }
    };

    tracker.uplinkFailed = function(err ){
      console.error(err);
      var state = tracker.state.set("uplinkStatus", "FAILED");
      tracker.state = state.set("alert", "Could not connect to Ably realtime service. Please try again later");
      tracker.logger.error("Uplink failed to connect", err);
      showcase(tracker.state);
    };

    tracker.uplinkDisconnected = function(err) {
      if (tracker.state.uplinkStatus === 'DISCONNECTED') { return; }
      tracker.state = tracker.state.set("uplinkStatus", "DISCONNECTED");
      tracker.logger.warn("Uplink has been disconnected", err);
      showcase(tracker.state);
    };

    tracker.newReading = function(newReading){
      tracker.showcase.addReading(newReading);
    };

    tracker.newFlight = function(flightData, live) {
      this.showcase.addFlight(flightData, live);
      if (live) { this.audio.playDropSound(); };
    }

    tracker.newOrientation = function(position){
      tracker.showcase.orientatePhones(position);
    };

    tracker.closeAlert = function(){
      tracker.state = tracker.state.set("alert", "");
      showcase(tracker.state);
    };

    function showcase(state) {
      tracker.showcase.update(state);
    }
  }

  /* jshint esnext: true */

  function isRational() {
    for (var i = 0; i < arguments.length; i++) {
      var val = arguments[i];
      if (typeof val !== "number"){
        return false;
      }
      if (!isFinite(val)) {
        return false;
      }
    }
    return true;
  }

  function roundtoFour(number) {
    return parseFloat(number.toFixed(4));
  }

  function Reading(raw){
    if ( !(this instanceof Reading) ) { return new Reading(raw); }

    this.x = raw.x;
    this.y = raw.y;
    this.z = raw.z;
    this.timestamp = raw.timestamp;

    if (!isRational(this.x, this.y, this.z, this.timestamp)) {
      throw new TypeError("Reading should have numerical values for x, y, z & timestamp");
    }
  }

  Object.defineProperty(Reading.prototype, "magnitude", {
    get: function(){
      return roundtoFour(Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z));
    }
  });

  Reading.prototype.asJson = function() {
    return {
      timestamp: this.timestamp,
      magnitude: this.magnitude
    }
  };

  /* jshint esnext: true */

  // Router makes use of current location
  // Router should always return some value of state it does not have the knowledge to regard it as invalid
  // Router is currently untested
  // Router does not follow modifications to the application location.
  // Router is generic for tracker and flyer at the moment
  // location is a size cause and might make sense to be lazily applied
  function Router(location) {
    if ( !(this instanceof Router) ) { return new Router(location); }
    var router = this;
    router.location = location;

    function getState(){
      return {
        channelName: $("head").data('channel-name')
      };
    }

    Object.defineProperty(router, 'state', {
      get: getState
    });
  }

  function TrackerShowcase(window){
    if ( !(this instanceof TrackerShowcase) ) { return new TrackerShowcase(window); }
    var showcase = this;
    var views = [];
    var phones = [];

    this.update = function(projection){
      // Values needed in display
      // isLive
      // readings
      // isLockedToLiveReadings
      // graph lines
      // uplink statuses
      // TODO should be projection not this
      showcase.projection = this;
      views.forEach(function(view){
        view.render(projection);
      });
    };

    this.addView = function(view){
      if (showcase.projection) {
        view.render(showcase.projection);
      }
      views.push(view);
    };

    this.addPhone = function(phone) {
      phones.push(phone);
    }

    this.addReading = function(newReading){
      views.forEach(function(view){
        view.addReading(newReading);
      });
    }

    this.addFlight = function(newFlightData, live) {
      views.forEach(function(view){
        view.addFlight(newFlightData, live);
      });
    }

    this.orientatePhones = function(position) {
      phones.forEach(function(phone){
        if (phone.setOrientation) {
          phone.setOrientation(position);
        }
      });
    }
  }

  /* jshint esnext: true */
  function UplinkController(options, tracker){
    var realtime = new Ably.Realtime({ authUrl: '/token' });
    var channelName = options.channelName;
    var channel = realtime.channels.get(channelName);

    /* Flights namespace is configured to persist messages */
    var flightRecorderChannelName = "flights:" + channelName;
    var flightRecorderChannel = realtime.channels.get(flightRecorderChannelName);

    function uplinkPublisherPresenceUpdate() {
      channel.presence.get(function(err, members) {
        if (err) {
          tracker.uplinkFailed(err);
        } else {
          tracker.uplinkPresent(channelName, members);
        }
      });
    }

    realtime.connection.on("connected", function(err) {
      // If we keep explicitly passing channel data to the controller we should pass it to the main app here
      tracker.uplinkAvailable(channelName);
      uplinkPublisherPresenceUpdate();
    });

    realtime.connection.on("failed", function(err) {
      tracker.uplinkFailed(err);
    });

    realtime.connection.on("disconnected", function(err) {
      tracker.uplinkDisconnected(err);
    });

    channel.subscribe("reading", function(event){
      tracker.newReading(Reading(event.data.reading));
      tracker.newOrientation(event.data.orientation);
    });

    channel.presence.subscribe(uplinkPublisherPresenceUpdate);

    flightRecorderChannel.subscribe(function(flightMessage) {
      tracker.newFlight(flightMessage.data, true);
    }, function(err) {
      if (err) {
        console.error("Could not attach to flight recorder channel", flightRecorderChannelName, err);
      } else {
        console.info("Attached to flight recorder channel", flightRecorderChannelName);
        flightRecorderChannel.history({ limit: 20 }, function(err, historicalFlightPage) {
          if (err) {
            console.error("Could not retrieve history for ", flightRecorderChannelName, err);
          } else {
            var historicalFlights = historicalFlightPage.items;
            for (var i = historicalFlights.length - 1; i >= 0; i--) {
              tracker.newFlight(historicalFlights[i].data, false);
            }
          }
        })
      }
    });
  }

  /* jshint esnext: true */

  function ready(fn) {
    if (document.readyState !== "loading"){
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  if (!Object.assign) {
    Object.defineProperty(Object, 'assign', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function(target) {
        'use strict';
        if (target === undefined || target === null) {
          throw new TypeError('Cannot convert first argument to object');
        }

        var to = Object(target);
        for (var i = 1; i < arguments.length; i++) {
          var nextSource = arguments[i];
          if (nextSource === undefined || nextSource === null) {
            continue;
          }
          nextSource = Object(nextSource);

          var keysArray = Object.keys(nextSource);
          for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
            var nextKey = keysArray[nextIndex];
            var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
            if (desc !== undefined && desc.enumerable) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
        return to;
      }
    });
  }

  /* jshint esnext: true */

  function Display() {
    var $root = $('.notices'),
        $message = $root.find('.message');

    return Object.create({}, {
      active: {
        set: function(active){
          var ACTIVE = "active";
          if (active) {
            $root.addClass(ACTIVE);
          } else {
            $root.removeClass(ACTIVE);
          }
        },
        enumerable: true
      },
      message: {
        set: function(message){
          $message.html(message);
        }
      }
    });
  }

  function Phone() {
    if ( !(this instanceof Phone) ) { return new Phone(); }
    var $phone = document.documentElement.querySelector('#tridiv .scene');
    var prefixes = ["-webkit-", "-moz-", "-ms-", ""];

    this.setOrientation = function(position) {
      var landscape = false;

      if ((position.orientation == 90) || (position.orientation == -90)) {
        landscape = true;
      }

      /* Don't rotate on Y axis so that phone rotates on X & Y axis in front of user */
      var xRotation = (90 - position.beta) + 270,
          yRotation = landscape ? 90 : 0,
          zRotation = position.gamma;

      var cssText = '';

      for (var prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex++) {
        var prefix = prefixes[prefixIndex];
        cssText += prefix + 'transform: rotateX(' + xRotation + 'deg) rotateY(' + yRotation + 'deg) rotateZ(' + zRotation + 'deg);';
      }

      $phone.style.cssText = cssText;
    }
  }

  function GraphDisplay(trackDivId) {
    if ( !(this instanceof GraphDisplay) ) { return new GraphDisplay(trackDivId); }

    var chart,
        context,
        data = [],
        lineDataTemplate = function() { return {
          labels: [],
          datasets: [
            {
              title: "Magnitude",
              strokeColor: "rgba(151,187,205,1)",
              fillColor: "rgba(255,255,255,0)",
              data: [],
              xPos: [],
              axis: 1
            },
            {
              title: "Throw",
              fillColor: "rgba(220,0,0,0.4)",
              strokeColor: "rgba(220,0,0,1)",
              data: [],
              xPos: [],
              axis: 2
            }
          ]
        }; },
        chartOptions = {
          datasetFill: true,
          animation: false,
          pointDot : false,
          showToolTips: false,
          scaleOverride: true,
          scaleStartValue: -10,
          scaleSteps: 8,
          scaleStepWidth: 10,
          scaleLabel: "<%=value%>",
          responsive: false,
          yAxisLabel: "LobForce™",
          showXLabels: 5,
          scaleXGridLinesStep: 5,
          fmtXLabel : "fmttime ss",
          extrapolateMissingData: false,
          inGraphDataShow: true,
          inGraphDataTmpl: "<%=((v1 == 'Throw') && (v3 > 0) ? 'Lob ' + Math.round(v3*100)/100 + 'm' : '')%>",
          inGraphDataAlign: "left",
          inGraphDataVAlign: "bottom",
          inGraphDataPaddingX: 20,
          inGraphDataPaddingY: -15,
          inGraphDataFontColor: "rgba(220,0,0,1)",
          graphSpaceAfter: 0,
          spaceBottom: 0
        };

    var $trackerGraph = $('#tracker-graph'),
        $canvas = $trackerGraph.find('canvas'),
        listenerAdded = false;

    var lineData;

    function initialize(lineData) {
      setDimensions();
      context = $canvas[0].getContext("2d");
      chart = new Chart(context).Line(lineData, chartOptions);

      if (!listenerAdded) {
        listenerAdded = true;
        $(window).on('resize', function() { /* catches orientation changes and window resizing */
          var oldCanvas = $trackerGraph.find('canvas');
          oldCanvas.after('<canvas>');
          oldCanvas.remove();
          $canvas = $trackerGraph.find('canvas');
          chart = undefined;
          prepareAndTruncateData(); /* this will create a new graph */
        });
      }
    }

    function setDimensions() {
      $canvas.attr('width', $trackerGraph.width());
      $canvas.attr('height', $trackerGraph.height());
    }

    function maxTimestampFromData() {
      return Math.max.apply(null, data.map(function(elem) { return elem.date; }));
    }

    /* Ensuring that each data point falls cleanly on a label entry the charts
       no longer present weird curves that match the data entry points.  This is a ChartNew.js
       bug, but this works around that problem */
    function clipToDateLabel(date, labels) {
      var closestTime,
          dateTime = date.getTime();

      labels.forEach(function(label) {
        var labelTime = label.getTime();
        if ((!closestTime) || (Math.abs(dateTime - labelTime) < Math.abs(dateTime - closestTime))) {
          closestTime = labelTime;
        }
      });

      return closestTime;
    }

    /*
      Sort data, then delete old data, cut off point of Config.trackingGraphTimePeriod
    */
    function prepareAndTruncateData() {
      var minDateOnGraph = maxTimestampFromData() - Config.trackingGraphTimePeriod,
          minDate, maxDate, labels = [];

      lineData = lineDataTemplate(),

      data = data.filter(function(point) {
        return point.date > minDateOnGraph;
      }).sort(function(a,b) {
        return a.date - b.date;
      });

      minDate = data[0].date.getTime();
      maxDate = data[data.length - 1].date.getTime();
      for (var dtLabel = minDate; dtLabel <= maxDate; dtLabel += Config.readingPublishLimit) {
        labels.push(new Date(dtLabel));
      }
      lineData.labels = labels;

      var magnitudeData = data.filter(function(point) { return !isNaN(parseInt(point.value)) });
      lineData.datasets[0].data = magnitudeData.map(function(point) {
        return point.value;
      });
      lineData.datasets[0].xPos = magnitudeData.map(function(point) {
        return clipToDateLabel(point.date, labels);
      });

      var flightData = data.filter(function(point) { return isNaN(parseInt(point.value)) });
      lineData.datasets[1].data = flightData.map(function(point) {
        return point.altitude;
      });
      lineData.datasets[1].xPos = flightData.map(function(point) {
        return clipToDateLabel(point.date, labels);
      });
      if (!lineData.datasets[1].xPos.length) {
        delete lineData.datasets[1].xPos;
      }

      if (!chart) {
        initialize(lineData);
      } else {
        updateChart(context, lineData, chartOptions);
      }
    }

    this.addPoint = function(point) {
      var lobForce = Math.round((point.magnitude - Config.gravityMagnitudeConstant) * 100) / 100; /* LobForce is stationery at 0 */
      data.push({
        date: new Date(point.timestamp),
        value: lobForce
      });
      prepareAndTruncateData();
    }

    this.addFlight = function(flightData) {
      var start = flightData.peakInfo[0].timestampStart;
      var end = flightData.peakInfo[flightData.peakInfo.length-1].timestampEnd;
      var altitude = flightData.altitude;
      var midpointDate = (start + end) / 2;

      data.push({
        date: new Date(start),
        altitude: undefined
      });
      data.push({
        date: new Date(start+1),
        altitude: 0
      });
      data.push({
        date: new Date(midpointDate),
        altitude: altitude
      });
      data.push({
        date: new Date(end-1),
        altitude: 0
      });
      data.push({
        date: new Date(end),
        altitude: undefined
      });

      prepareAndTruncateData();
    }
  }

  // GENERAL CONFIGURATION
  window.Tracker = Tracker;
  window.Tracker.Reading = Reading;

  var router = Router(window.location);
  console.log('Router:', 'Started with initial state:', router.state);

  var tracker = new Tracker();
  tracker.logger = window.console;
  tracker.showcase = TrackerShowcase(window);

  var uplinkController = new UplinkController(router.state, tracker);

  function uplinkStatusMessageFromProjection(projection) {
    var message = projection.uplinkStatus;
    if (message === 'AVAILABLE') {
      return '<p>Connection made to live Lob <b>' + projection.uplinkChannelName + '</b>.</p>' +
        "<p>As soon as the device is connected, you'll see the results in realtime below</p>";
    } else if (message === 'STREAMING') {
      return 'Streaming Lob <b>' + projection.uplinkChannelName + "</b>" +
        (projection.uplinkDevice ? "  from " + projection.uplinkDevice : "");
    } else if (message === 'FAILED') {
      return 'Could not connect to live Lob realtime service';
    } else if (message === 'DISCONNECTED') {
      return 'Hold on, we\'re currently disconnected from the live Lob';
    } else {
      return 'Unknown';
    }
  }

  ready(function(){
    var $uplinkStatusMessage = $('.uplink-status-message'),
        $graphAndPhone = $('.graph-and-phone'),
        $preloader = $('.connecting-loader'),
        $flightHistory = $('.flight-history'),
        $flightHistoryTable = $flightHistory.find('table');

    var alertDisplay = Display(),
        phone = new Phone(),
        graphDisplay;

    var paused = false;

    var mainView = {
      render: function(projection) {
        $uplinkStatusMessage.html(uplinkStatusMessageFromProjection(projection));

        if (projection.uplinkStatus === 'STREAMING') {
          $graphAndPhone.show();
          $preloader.hide();
          if (!graphDisplay) {
            graphDisplay = new GraphDisplay('tracker-graph');
          }
        } else {
          $graphAndPhone.hide();
          $preloader.show();
        }

        var alertMessage = projection.alert;
        if (alertMessage) {
          alertDisplay.message = alertMessage;
          alertDisplay.active = true;
        } else {
          alertDisplay.active = false;
        }

        $('.pause-button').on('click', function() {
          paused = true;
          $('.pause-button').hide();
          $('.play-button').show();
        });

        $('.play-button').on('click', function() {
          paused = false;
          $('.play-button').hide();
          $('.pause-button').show();
        });
      },

      addReading: function(newReading) {
        if (paused) { return; }

        if (graphDisplay) {
          graphDisplay.addPoint(newReading);
        }
      },

      addFlight: function(newFlightData, live) {
        if (paused) { return; }

        if (graphDisplay) {
          graphDisplay.addFlight(newFlightData);
        }

        var altitude = Math.round(newFlightData.altitude * 100)/100 + "m",
            flightTime = Math.round(newFlightData.flightTime * 100)/100 + "s",
            flightDate = new Date(newFlightData.timestamp),
            flewAt = flightDate.toLocaleTimeString() + " on " + flightDate.toLocaleDateString();

        var row = $("<tr><td>" + altitude + "</td><td>" + flightTime + "</td><td>" + flewAt + "</td></tr>");
        $flightHistoryTable.find('tr:first').after(row);
        $flightHistory.show();
      }
    };

    tracker.showcase.addView(mainView);
    tracker.showcase.addPhone(phone);
  });

  return tracker;

})();
//# sourceMappingURL=tracker.js.map