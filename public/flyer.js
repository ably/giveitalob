var Lob = (function () { 'use strict';

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

  var Config = {
    readingPublishLimit: 200, // ms
    flightPublishLimit: 1000, // ms
    trackingGraphTimePeriod: 8000, // ms - time to keep points in visible graph
    gravityMagnitudeConstant: 10, // default gravity magnitude value from accelerometer
    broadcastNewChannelName: 'broadcast:channel' /* replicated in app.rb */
  };

  function Device() {
    if ( !(this instanceof Device) ) { return new Device(); }

    var mobileDetect = new MobileDetect(window.navigator.userAgent);
    var browser = platform;

    function mobileDescription() {
      if (mobileDetect.phone() && (mobileDetect.phone() !== 'UnknownPhone')) {
        return mobileDetect.phone()
      } else if (mobileDetect.tablet() && (mobileDetect.tablet() !== 'UnknownTablet')) {
        return mobileDetect.tablet();
      } else {
        return platform.os.family;
      }
    }

    function desktopDescription() {
      return browser.os.family.replace(/Windows.*/,"Windows") + " desktop";
    }

    this.deviceDescription = function() {
      if (mobileDetect.mobile()) {
        return mobileDescription();
      } else {
        return desktopDescription();
      }
    }
  }

  function FlyerUplink(options, logger) {
    if ( !(this instanceof FlyerUplink) ) { return new FlyerUplink(options, logger); }

    logger.info('Starting uplink', options);

    var uplink = this;
    var channelName = options.channelName.toString();

    // TODO: Remove clientId when https://github.com/ably/ably-js/issues/252 resolved
    var client = new Ably.Realtime({ authUrl: '/flyer/' + channelName + '/token', clientId: channelName.toString() });
    var channel = client.channels.get(channelName);

    /* Flights namespace is configured to persist messages */
    var flightRecorderChannelName = "flights:" + options.channelName;
    var flightRecorderChannel = client.channels.get(flightRecorderChannelName);

    var broadcastChannelName = Config.broadcastNewChannelName;
    var broadcastChannel = client.channels.get(broadcastChannelName);

    var deviceType = new Device().deviceDescription();

    var noop = function() {};

    var intervalTransmissionSetup,
        lastTransmissionTargetTimestamp,
        lastReading,
        lastOrientation;

    function startTransmissionTimer() {
      var timestamp = Date.now(),
          nextFireDelay

      if (lastTransmissionTargetTimestamp) {
        lastReading.timestamp = lastTransmissionTargetTimestamp;
        lastOrientation.timestamp = lastTransmissionTargetTimestamp;
      }

      if (lastTransmissionTargetTimestamp) {
        /* Adjust next transmission based on the delay of this transmission */
        nextFireDelay = lastTransmissionTargetTimestamp - timestamp + Config.readingPublishLimit;
        lastTransmissionTargetTimestamp = timestamp + nextFireDelay;
      } else {
        /* Fire exatly on the interval intended i.e. 0.0, 0.2, 0.4 if 200ms intervals */
        nextFireDelay = Config.readingPublishLimit - (timestamp % Config.readingPublishLimit);
        lastTransmissionTargetTimestamp = timestamp + nextFireDelay;
        setTimeout(startTransmissionTimer, nextFireDelay);
        return;
      }

      channel.publish("reading", { reading: lastReading, orientation: lastOrientation }, function(err) {
        if (err) {
          logger.warn("Unable to send new reading; err = " + err.message);
        }
      });

      setTimeout(startTransmissionTimer, nextFireDelay);
    }

    function transmitReadingAndOrientation(reading, orientation) {
      lastReading = reading;
      lastOrientation = orientation;
      if (!intervalTransmissionSetup) {
        startTransmissionTimer();
        intervalTransmissionSetup = true;
      }
    }

    function transmitFlightData(flightData){
      flightRecorderChannel.publish("flight", flightData, function(err) {
        if (err) {
          logger.warn("Unable to send new fligth data; err = " + err.message);
        }
      })
    }

    function broadcastNewChannel() {
      broadcastChannel.publish("new", { channel: channelName, device: deviceType });
    }

    client.connection.on("connected", function(err) {
      uplink.onconnected();
    });

    client.connection.on("disconnected", function(err) {
      logger.warn("Uplink is disconnected", err);
      uplink.onconnectionDisconnected(err);
    });

    client.connection.on("failed", function(err) {
      console.error("Connection failed", err);
      uplink.onconnectionFailed(err);
    });

    /* Be present on the channel so that subscribers know a publisher is here */
    channel.presence.enter({ device: deviceType }, function(err) {
      if (err) {
        logger.error("Could not enter presence", err);
        uplink.onconnectionFailed(err);
      } else {
        logger.info("Present on channel", channelName, ", device:", deviceType);
        broadcastNewChannel();
      }
    });

    flightRecorderChannel.attach(function(err) {
      if (err) {
        logger.error("Could not attach to flight recorder channel", flightRecorderChannelName);
      } else {
        logger.info("Attached to flight recorder channel", flightRecorderChannelName);
      }
    });

    /* Register leave events quickly so that Ably knows the client is gone intentionally
       as opposed to disconnected abruptly */
    window.onunload = window.onbeforeunload = function () {
      client.connection.close();
    };

    this.channelName = channelName;

    /* These callbacks events are specified by the creator of this object */
    this.onconnected = noop;
    this.onconnectionFailed = noop;
    this.onconnectionDisconnected = noop;

    this.transmitReadingAndOrientation = transmitReadingAndOrientation;
    this.transmitFlightData = transmitFlightData;
  }

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

  var FLYER_STATE_DEFAULTS = {
    uplinkStatus: "CONNECTING",
    uplinkDetails: {},
    latestReading: null, // DEBT best place a null object here
    currentFlight: [],
    flightHistory: [],
    alert: ""
  };

  // DEBT not quite sure why this can't just be named state;
  function FlyerState(raw){
    if ( !(this instanceof FlyerState) ) { return new FlyerState(raw); }

    // DEBT with return statement is not an instance of FlyerState.
    // without return statement does not work at all.
    return Struct.call(this, FLYER_STATE_DEFAULTS, raw);
  }

  FlyerState.prototype = Object.create(Struct.prototype);
  FlyerState.prototype.constructor = FlyerState;

  /* jshint esnext: true */

  function readingsDuration(readings){
    if (!readings[0]) { return 0; }

    var t0 = readings[0].timestamp;
    var t1 = readings[readings.length - 1].timestamp;

    return (t1 - t0) / 1000;
  }

  function altitudeForFreefallDuration(durationInSeconds){
    /*
      Altitude Calculation

      Makes an assumption that magnitude is 10 (stationery) at
      the top of the throw and bottom of the throw starts when magnitude
      starts increasing again indicating deceleration. Our flight data
      is trimmed before it arrives here so that it only contains freefall
      information.

      As we have two peaks and one trough, the freefall data is the mid point
      (as in level of 10) of peak 1 & bottom of trough 1.

      Vertical drop formula:
        height = gravity 9.8m/s * time^2 / 2
    */

    return 9.8 * Math.pow(durationInSeconds, 2) / 2;
  }

  function round(number){
    return parseFloat(number.toFixed(2));
  }

  function maxFlightDuration(flights) {
    var flightDurations = flights.map(readingsDuration);
    return Math.max.apply(null, flightDurations);
  }

  function maxAltitude(flights) {
    var flightDurations = flights.map(readingsDuration);
    var max = Math.max.apply(null, [0].concat(flightDurations));
    return round(altitudeForFreefallDuration(max));
  }

  function Projection(rawState){
    Object.defineProperty(this, "maxFlightTime", {
      get: function(){
        return maxFlightDuration(rawState.flightHistory.concat(rawState.currentFlight));
      }
    });

    Object.defineProperty(this, "lastFlightTime", {
      get: function(){
        var lastFlight = rawState.flightHistory[rawState.flightHistory.length - 1];
        return maxFlightDuration([lastFlight]);
      }
    });

    Object.defineProperty(this, "lastFlightTimestamp", {
      get: function(){
        var lastFlight = rawState.flightHistory[rawState.flightHistory.length - 1];
        return lastFlight[lastFlight.length-1].timestamp;
      }
    });

    Object.defineProperty(this, "flightCount", {
      get: function(){
        return rawState.flightHistory.length;
      }
    });

    Object.defineProperty(this, "maxAltitude", {
      get: function(){
        return maxAltitude(rawState.flightHistory.concat(rawState.currentFlight));
      }
    });

    Object.defineProperty(this, "lastAltitude", {
      get: function(){
        var lastFlight = rawState.flightHistory[rawState.flightHistory.length - 1];
        return maxAltitude([lastFlight]);
      }
    });

    Object.defineProperty(this, "latestReading", {
      get: function(){
        return rawState.latestReading;
      }
    });

    Object.defineProperty(this, "hasThrow", {
      get: function(){
        return this.maxAltitude !== 0;
      }
    });

    Object.defineProperty(this, "hasOneThrow", {
      get: function(){
        return this.hasThrow && (rawState.flightHistory.length === 1);
      }
    });

    Object.defineProperty(this, "uplinkStatus", {
      get: function(){
        return rawState.uplinkStatus;
      }
    });
    Object.defineProperty(this, "channelName", {
      get: function(){
        return rawState.uplinkDetails.channelName;
      }
    });
    Object.defineProperty(this, "alert", {
      get: function(){
        return rawState.alert;
      }
    });
  }

  function project(app){
    return new Projection(app);
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

  var Thresholds = {
    peak: 18,
    trough: 4,
    stagnantMovementTime: 1000,
    stagnantMovementAmount: 7, /* expect at least this much movement in magnitude over stagnantMovementTime */
    flightPause: 2000, /* period we stop detecting throws after a throw has been made */
    peakTroughMinTime: 400, /* Min time we expect from the throw peak to the drop trough to consider this a valid throw */
    crossZeroPointBuffer: 40, /* Ignore some noise when falling / climbing for a few milliseconds that could cause it jump above & below zero point briefly */
    minFlightTime: 150 /* min flight time to be a viable throw */
  }

  var DebugThrows = false; /* Will output debugging info when false */
  var lastDebugArgs;

  function debug() {
    if (DebugThrows) {
      var argsString = Array.prototype.join.call(arguments, ",");
      if (lastDebugArgs === argsString) {
        return;
      }
      lastDebugArgs = argsString;

      console.debug.apply(console, arguments);
    }
  }

  /* Class that wraps a reading but has logic
     that allows it to be queried with a nice DSL */

  function PeakOrTrough(reading) {
    this.historicalReadings = [];
    this.updateReading(reading);
  }

  PeakOrTrough.prototype.exceedThreshold = function() {
    return (this.magnitude < Thresholds.trough) ||
      (this.magnitude > Thresholds.peak);
  };

  PeakOrTrough.prototype.isPeak = function() {
    return this.magnitude > 10;
  }

  PeakOrTrough.prototype.type = function() {
    return this.isPeak() ? 'peak' : 'trough';
  }

  /* If we sample the last X seconds of the readings,
     we expect to see reasonable movement in magnitude in one direction
     else it's probably no longer in flight */
  PeakOrTrough.prototype.isStagnant = function() {
    if (this.timestampEnd - this.timestampStart < Thresholds.stagnantMovementTime) {
      /* This peak or trough cannot be stagnant unless some time has passed first */
      return false;
    }

    var magnitudes = this.historicalReadings.filter(function(reading) {
      reading.timestamp >= Date.now() - Thresholds.stagnantMovementTime;
    }).map(function(reading) {
      return reading.magnitude;
    });

    if (magnitudes.length === 0) {
      return true;
    }

    var max = Math.max.apply(null, magnitudes),
        min = Math.min.apply(null, magnitudes);

    debug("isStagnant:", Math.abs(max - min) < Thresholds.stagnantMovementAmount, min, max);

    return Math.abs(max - min) < Thresholds.stagnantMovementAmount;
  }

  /* A trough of 3 is less than a trough  of 2
     and a peak of 19 is less than a peak of 22 */
  PeakOrTrough.prototype.isLessThan = function(newPeakOrTrough) {
    if (this.magnitude < 10) {
      return newPeakOrTrough.magnitude < this.magnitude;
    } else {
      return newPeakOrTrough.magnitude > this.magnitude;
    }
  };

  PeakOrTrough.prototype.updateReading = function(reading) {
    this.reading = reading;
    this.magnitude = reading.magnitude;
    if (!this.timestampStart) { this.timestampStart = reading.timestamp; }
    this.timestampEnd = reading.timestamp;
    this.historicalReadings.push(reading);
  };

  /* If this peak or trough has crossed the zero point (technically 10)
     i.e. it is now going in the opposite direction */
  PeakOrTrough.prototype.crossedZeroPoint = function() {
    this.crossedZeroPointTimestamp = Date.now();
  };

  PeakOrTrough.prototype.hasRecentlyCossedZeroPoint = function() {
    return this.crossedZeroPointTimestamp && (this.crossedZeroPointTimestamp < Date.now() - Thresholds.crossZeroPointBuffer);
  };

  PeakOrTrough.prototype.asJson = function() {
    return {
      magnitude: this.magnitude,
      readings: this.historicalReadings.map(function(reading) { return [reading.timestamp, reading.magnitude]; }),
      timestampStart: this.timestampStart,
      timestampEnd: this.timestampEnd
    };
  };

  function Flyer(state) {
    if ( !(this instanceof Flyer) ) { return new Flyer(state); }

    var flyer = this;
    var audio = new Audio();
    var peakOrTroughHistory = [];
    var currentFlightReadings = [];
    var lastThrowCompleted;

    state = FlyerState(state || {});
    flyer.state = state;

    flyer.uplinkAvailable = function(channelName) {
      if (flyer.state.uplinkStatus === 'INCOMPATIBLE') { return; }

      flyer.state = flyer.state.merge({
        "uplinkStatus": "TRANSMITTING",
        "uplinkDetails": channelName
      });
      flyer.logger.info("Uplink available, transmission commencing", channelName);
      showcase(flyer.state);
    };

    flyer.uplinkFailed = function(err) {
      if (flyer.state.uplinkStatus === 'INCOMPATIBLE') { return; }

      flyer.state = flyer.state.set("uplinkStatus", "FAILED");
      showcase(flyer.state);
      flyer.logger.error("Uplink failed", err);
    };

    flyer.uplinkDisconnected = function() {
      if (flyer.state.uplinkStatus === 'INCOMPATIBLE') { return; }

      flyer.state = flyer.state.set("uplinkStatus", "DISCONNECTED");
      showcase(flyer.state);
      flyer.logger.warn("Uplink disconnected, will attempt reconnect");
    };

    flyer.newReading = function(raw) {
      var reading = Reading({
        x: raw.dm.gx, /* raw.dm is devicemotion */
        y: raw.dm.gy,
        z: raw.dm.gz,
        timestamp: Date.now()
      });

      var orientation = raw.do;
      orientation.orientation = window.orientation;

      transmitReadingAndOrientation(reading, orientation);

      flyer.view.renderPhoneMovement(reading);
      flyer.view.renderPhoneOrientation(orientation);

      this.trackThrows(reading, function(currentFlight, peakOrTroughHistory) {
        var state = flyer.state.set("latestReading", reading);
        var flightHistory = state.flightHistory;

        flightHistory.push(currentFlight);
        flyer.state = state.set({
          "currentFlight": currentFlight,
          "flightHistory": flightHistory
        });

        showcase(flyer.state);

        audio.playDropSound();
        transmitFlightData(flyer.state, currentFlight, peakOrTroughHistory);
      });
    };

    /****

      Calls the callback with an Array of readings when
      a throw is detected

      A throw is typically a curve in the form
          ---      ---
      ----/   \    /   \-----
              \__/

      What we need to identify is two large peaks with an
      opposing peak/trough to work out how long the throw was

      Assumption is that throw is end of the first up curve i.e. it's stopped accelerating upwards,
      until the bottom of the following down curve when it starts decellerating.

    ****/
    flyer.trackThrows = function(reading, callback) {
      var currentPeakOrTrough = new PeakOrTrough(reading);
      var lastPeakOrTrough = peakOrTroughHistory[peakOrTroughHistory.length - 1];
      var freefallData;

      /* Prevent detection sometimes on bounce / catch */
      if (lastThrowCompleted && (lastThrowCompleted > Date.now() - Thresholds.flightPause)) {
        debug('Ignoring throw data due to previous throw', lastThrowCompleted);
        return;
      }

      /* Start recording peaks or troughs, update the extremes of the peaks or
         troughs, and when peak switches to trough or vice versa, add a new
         recorded peak or trough in history */
      if (currentPeakOrTrough.exceedThreshold()) {
        if (!lastPeakOrTrough) {
          /* We only start recording from a peak, never from a trough */
          if (currentPeakOrTrough.isPeak()) {
            debug('Detected first peak', reading.asJson());
            peakOrTroughHistory.push(currentPeakOrTrough);
          } else {
            debug('Trough so ignoring data', reading.asJson());
          }
        } else {
          if (currentPeakOrTrough.isPeak() === lastPeakOrTrough.isPeak()) {
            if (lastPeakOrTrough.isLessThan(currentPeakOrTrough)) {
              debug('In play ' + currentPeakOrTrough.type() + ' is greater than old peak', reading.asJson());
              lastPeakOrTrough.updateReading(reading);
            }
          } else {
            peakOrTroughHistory.push(currentPeakOrTrough);
            debug('New ' + currentPeakOrTrough.type() + ' detected. Now', peakOrTroughHistory.length, 'peaks or troughs.', reading.asJson());
            while (peakOrTroughHistory.length > 3) {
              debug('Truncating first peak and trough as new peaks and troughs detected');
              dropFirstPeakAndTrough();
            }
          }
        }
      } else {
        if (lastPeakOrTrough) {
          /* Current movement is up or down from last peak or trough i.e. crossed the 10 position */
          if (currentPeakOrTrough.isPeak() !== lastPeakOrTrough.isPeak()) {
            /* Record that the last peak has now crossed the zero point */
            lastPeakOrTrough.crossedZeroPoint();
          } else {
            /* The current position is of the same type as the previous peak/trough yet it has crozzed the zero point
               and has now come back without crossing a threshold. This is just noise or someone waving it up and down */
            if (lastPeakOrTrough.hasRecentlyCossedZeroPoint()) {
              debug('Last peak or trough has recently crossed zero point and has come back the other way now. Discarding everything', currentPeakOrTrough, lastPeakOrTrough, peakOrTroughHistory);
              /* This is not a valid throw, clear all history */
              peakOrTroughHistory = [];
              currentFlightReadings = [];
              return;
            }
          }
        }

        /* We are no longer exceeding a peak or trough
           and we have satisfied the requirements of three peaks */
        if (peakOrTroughHistory.length === 3) {
          debug('Total 3 peaks or troughs detected and now in middle ground.', reading.asJson());

          var peakToTroughDuration = peakOrTroughHistory[2].timestampEnd - peakOrTroughHistory[0].timestampStart;
          if (peakToTroughDuration < Thresholds.peakTroughMinTime) {
            debug('Peak to peak duration too low so skipping that peak & trough', peakToTroughDuration, peakOrTroughHistory);
            /*
              The peak and trough are too close togeher, person is probably just waving phone up and down.
              Lets keep this current peak and drop previous peak & trough
            */
            dropFirstPeakAndTrough();
          } else {
            lastThrowCompleted = Date.now();

            /* Only keep the flight data for the freefall, see Projection
               for a better explanation of why we only use freefall data */
            freefallData = filterFreefallData(currentFlightReadings);
            debug("Free fall data", freefallData);

            var flightTime = freefallData[freefallData.length - 1].timestamp - freefallData[0].timestamp;
            if (flightTime < Thresholds.minFlightTime) {
              debug("Flight too short", flightTime, "discarding");
            } else {
              callback(freefallData, peakOrTroughHistory);
            }

            peakOrTroughHistory = [];
            currentFlightReadings = [];
            return;
          }
        }
      }

      if (lastPeakOrTrough) {
        if (lastPeakOrTrough.isStagnant()) {
          debug('Last peak or trough stagnant. Discarding everything', lastPeakOrTrough, peakOrTroughHistory);
          /* This is not a valid throw, clear all history */
          peakOrTroughHistory = [];
          currentFlightReadings = [];
        } else {
          currentFlightReadings.push(reading);
        }
      }
    }

    flyer.closeAlert = function(){
      // DEBT untested
      flyer.state = flyer.state.set("alert", "");
      showcase(flyer.state);
    };

    flyer.accelerometerNotSupported = function() {
      flyer.state = flyer.state.merge({
        "alert": "Accelerometer not found for this device. Please try again on a different mobile",
        "uplinkStatus": "INCOMPATIBLE"
      });
      showcase(flyer.state);
    }

    function dropFirstPeakAndTrough() {
      peakOrTroughHistory.splice(0,2);
      currentFlightReadings = currentFlightReadings.filter(function(reading) {
        return reading.timestamp >= peakOrTroughHistory[0].timestamp;
      });
    }

    function filterFreefallData(flightData) {
      var freefallData = [],
          reading,
          lowestMagnitude,
          inFreefall;

      /* First get all data that is below stationery i.e. in freefall
         but only keep the points that are increasingly lower in magnitude.
         See Projection for more details on assumptions */
      for (var i = 0; i < flightData.length; i++) {
        reading = flightData[i];
        if (reading.magnitude >= 10) { continue; }

        if (!lowestMagnitude || (reading.magnitude < lowestMagnitude)) {
          lowestMagnitude = reading.magnitude;
          freefallData.push(reading);
        }

        if (lowestMagnitude < Thresholds.trough) {
          inFreefall = true;
        } else if (inFreefall && (reading.magnitude > Thresholds.trough)) {
          /* This throw is over */
          return freefallData;
        }
      }

      return freefallData;
    }

    function transmitReadingAndOrientation(reading, orientation) {
      if (flyer.state.uplinkStatus === "TRANSMITTING") {
        flyer.uplink.transmitReadingAndOrientation(reading, orientation);
      }
    }

    function transmitFlightData(state, flightData, peakOrTroughHistory) {
      if (flyer.state.uplinkStatus === "TRANSMITTING") {
        var projection = project(state);
        var data = {
          timestamp: projection.lastFlightTimestamp,
          flightTime: projection.lastFlightTime,
          altitude: projection.lastAltitude,
          flightSerialThisSession: projection.flightCount,
          peakInfo: peakOrTroughHistory.map(function(peak) { return peak.asJson(); })
        };
        flyer.uplink.transmitFlightData(data);
      }
    }

    function showcase(state){
      flyer.view.render(project(state));
    }

    // DEBT should be set separatly for Testing
    flyer.clock = window.Date;
  }
  Flyer.State = FlyerState;

  function Presenter(projection){

    Object.defineProperty(this, "maxFlightTime", {
      get: function(){
        return projection.maxFlightTime + "s";
      }
    });

    Object.defineProperty(this, "rawMaxFlightTime", {
      get: function(){
        return projection.maxFlightTime;
      }
    });

    Object.defineProperty(this, "lastFlightTime", {
      get: function(){
        return projection.lastFlightTime + "s";
      }
    });

    Object.defineProperty(this, "maxAltitude", {
      get: function(){
        return projection.maxAltitude + "m";
      }
    });

    Object.defineProperty(this, "rawMaxAltitude", {
      get: function(){
        return projection.maxAltitude;
      }
    });

    Object.defineProperty(this, "lastAltitude", {
      get: function(){
        return projection.lastAltitude + "m";
      }
    });

    Object.defineProperty(this, "hasThrow", {
      get: function(){
        return projection.hasThrow;
      }
    });

    Object.defineProperty(this, "hasOneThrow", {
      get: function(){
        return projection.hasOneThrow;
      }
    });

    Object.defineProperty(this, "lastHigherThanBefore", {
      get: function(){
        return projection.lastAltitude == projection.maxAltitude;
      }
    });

    Object.defineProperty(this, "uplinkStatus", {
      get: function(){
        return projection.uplinkStatus.toLowerCase();
      }
    });

    Object.defineProperty(this, "channelName", {
      get: function(){
        return projection.channelName;
      }
    });
  }

  function present(app){
    return new Presenter(app);
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

  /* This function class contains the logic for the presentation
     messaging in the view based on the state, but is weirdly not a
     view itself as their is a view, a projection, and a presenter? */

  function Display$1($root){
    var $leaderboardPanel = $root.find(".leaderboard"),
        $leaderboardSubmitPanel = $leaderboardPanel.find(".submit-panel"),
        $leaderboardSubmittedPanel = $leaderboardPanel.find(".submitted-panel"),
        $leaderboardForm = $leaderboardPanel.find("form"),
        $leaderBoardFormNickname = $leaderboardPanel.find("form input[name=nickname]"),
        $leaderBoardFormAltitude = $leaderboardPanel.find("form input[name=max-altitude]"),
        $leaderBoardFormFlightTime = $leaderboardPanel.find("form input[name=max-flight-time]"),
        $leaderBoardAltitudeMessage = $leaderboardPanel.find(".max-altitude-message"),
        $leaderBoardSubmittedAltitude = $leaderboardPanel.find(".max-altitude-message-submitted");

    var $message = $root.find(".message"),
        $uplinkStatus = $root.find(".uplink-status"),
        $loader = $root.find(".connecting-loader"),
        $connectionActive = $root.find(".connection-active");

    var alertDisplay = Display();

    var deviceType = new Device().deviceDescription();

    function init() {
      $leaderboardForm.on('submit', function(event) {
        event.preventDefault();

        var altitude = $leaderBoardFormAltitude.val(),
            flightTime = $leaderBoardFormFlightTime.val(),
            nickname = $leaderBoardFormNickname.val().replace(/^\s+|\s+$/g,""),
            data = {
              "max-altitude": altitude,
              "max-flight-time": flightTime,
              "nickname": nickname,
              "device": deviceType
            };

        if (nickname.length === 0) {
          alert("Sorry, you need to have a nickname to enter the leaderboard");
          $leaderBoardFormNickname.focus();
          return;
        }

        if (window.localStorage) {
          localStorage.setItem('nickname', nickname);
        }

        $leaderboardForm.find('submit').attr('disabled', 'disabled');

        $.post('/submit-flight', data).done(function() {
            alertDisplay.active = false;
            $leaderBoardSubmittedAltitude.text(altitude + "m");
            $leaderboardSubmitPanel.hide();
            $leaderboardSubmittedPanel.show();
          }).fail(function() {
            alertDisplay.message = "Oops, something went wrong submitting your lob to the leaderboard. Please try again";
            alertDisplay.active = true;
          }).always(function() {
            $leaderboardForm.find('submit').removeAttr('disabled');
          })
      });
    }

    function setLoading(isLoading) {
      if (isLoading) {
        $loader.show();
        $connectionActive.hide();
      } else {
        $loader.hide();
        $connectionActive.show();
      }
    }

    function showLeaderboard(altitude, flightTime) {
      $leaderboardPanel.show();
      $leaderboardSubmitPanel.show();
      $leaderboardSubmittedPanel.hide();
      $leaderBoardFormAltitude.val(altitude);
      $leaderBoardFormFlightTime.val(flightTime);
      $leaderBoardAltitudeMessage.text(Math.round(altitude * 100)/100 + "m");

      if (window.localStorage && window.localStorage.getItem('nickname')) {
        $leaderBoardFormNickname.val(window.localStorage.getItem('nickname'));
      }
    }

    function updateUplinkStatus(presentation) {
      switch(presentation.uplinkStatus.toLowerCase()) {
        case "connecting":
          $uplinkStatus.html("Hold on, we're establishing a realtime connection to stream your lob.");
          setLoading(true);
          break;
        case "disconnected":
          $uplinkStatus.html("Hold on, we've lost the realtime connection. Trying to reconnect now.");
          setLoading(true);
          break;
        case "failed":
          $uplinkStatus.html("Oops, we've failed to establish a realtime connection. Try reloading this app.");
          setLoading(true);
          break;
        case "incompatible":
          $uplinkStatus.html("Unfortunately no accelerometer was found on this device. Please try again on a different mobile");
          setLoading(true);
          break;
        case "transmitting":
          $uplinkStatus.html("<p class='title-with-hint'>Your unique Lob code is: <b>" + presentation.channelName + "</b></p>" +
            "<p class='hint'>Give this to others and they can watch your Lob live.<br><a href='/why-stream'>How does this work?</a>");
          setLoading(false);
          break;
        default:
          console.error('Unknown status', status);
      }
    }

    function renderNoThrows(presentation) {
      $message.html("<p>Are you ready?</p><p><b>Lob your phone in the air now.</b></p><p>Good luck!</p>");
      updateUplinkStatus(presentation);
    }

    function renderFirstThrow(presentation) {
      $message.html("<p>Great throw!</p>" +
        "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
        "<p>Go on, try again!</p>");
      updateUplinkStatus(presentation);
    }

    function renderMultipleThrows(presentation) {
      if (presentation.lastHigherThanBefore) {
        $message.html("<p>Superb, <b>that's your new record!</b></p>" +
          "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
          "<p>Your previous best was <b>" + presentation.maxAltitude + "</b> high</p>" +
          "<p>Go for glory, see if you can go higher!</p>");
        showLeaderboard(presentation.rawMaxAltitude, presentation.rawMaxFlightTime);
      } else {
        $message.html("<p>Not bad, but that's not your best so far.</p>" +
          "<p>You lobbed it <b>" + presentation.lastAltitude + "</b> for <b>" + presentation.lastFlightTime + "</b></p>" +
          "<p>Your previous best was <b>" + presentation.maxAltitude + "</b> high</p>" +
          "<p>Give it another go!</p>");
      }
      updateUplinkStatus(presentation);
    }

    this.render = function(presentation) {
      if (!presentation.hasThrow) {
        renderNoThrows(presentation);
      } else if (presentation.hasOneThrow) {
        renderFirstThrow(presentation);
        showLeaderboard(presentation.rawMaxAltitude, presentation.rawMaxFlightTime);
      } else {
        renderMultipleThrows(presentation);
      }
    }

    init();
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

  function Guage() {
    if ( !(this instanceof Guage) ) { return new Guage(); }
    var $guage = document.documentElement.querySelector('.guage-widget .needle');
    var prefixes = ["-webkit-", "-moz-", "-ms-", ""];

    this.setMomentum = function(reading) {
      /* momentum is stationery at 10, less than or greater than represents momentum */
      var normalizedReading = Math.abs(reading.magnitude - Config.gravityMagnitudeConstant);
      var boundedReading = Math.min(100, Math.max(0, normalizedReading));
      var angle = (boundedReading - 50) / 100 * 180;
      var cssText = '';

      for (var prefixIndex = 0; prefixIndex < prefixes.length; prefixIndex++) {
        var prefix = prefixes[prefixIndex];
        cssText += prefix + 'transform: translateX(-50%) translateY(-50%) rotate(' + angle + 'deg);'
      }

      $guage.style.cssText = cssText;
    }
  }

  function throttle(fn, threshhold, scope) {
    threshhold = threshhold;
    var last,
    deferTimer;
    return function () {
      var context = scope || this;
      var now = Date.now(), args = arguments;

      if (last && now < last + threshhold) {
        // hold on to it
        clearTimeout(deferTimer);
        deferTimer = setTimeout(function () {
          last = now;
          fn.apply(context, args);
        }, threshhold);
      } else {
        last = now;
        fn.apply(context, args);
      }
    };
  }

  function FlyerView() {
    var memoized = {};

    var getDisplay = function() {
      if (!memoized.display) {
        var $flyer = $('.flyer');
        memoized.display = new Display$1($flyer);
      }
      return memoized.display;
    }

    var getAlertDisplay = function() {
      if (!memoized.alertDisplay) {
        memoized.alertDisplay = Display();
      }
      return memoized.alertDisplay;
    }

    var getPhone = function() {
      if (!memoized.phone) {
        memoized.phone = new Phone();
      }
      return memoized.phone;
    }

    var getGuage = function() {
      if (!memoized.guage) {
        memoized.guage = new Guage();
      }
      return memoized.guage;
    }

    var renderPhoneMovement = function(reading) {
      getGuage().setMomentum(reading);
    }

    var renderPhoneOrientation = function(position) {
      getPhone().setOrientation(position);
    }

    this.render = function(projection) {
      var presentation = present(projection);
      var display = getDisplay();
      var alertDisplay = getAlertDisplay();

      display.render(presentation);

      var alertMessage = projection.alert;
      if (alertMessage) {
        alertDisplay.message = alertMessage;
        alertDisplay.active = true;
      } else {
        alertDisplay.active = false;
      }
    }

    this.renderPhoneMovement = throttle(renderPhoneMovement.bind(this), Config.readingPublishLimit);
    this.renderPhoneOrientation = throttle(renderPhoneOrientation.bind(this), Config.readingPublishLimit);
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

  var router = Router(window.location);

  var uplink = FlyerUplink({
    channelName: router.state.channelName
  }, window.console);

  var flyer = Flyer();

  flyer.logger = window.console;
  flyer.view = new FlyerView
  flyer.uplink = uplink;

  function AccelerometerController(global, flyer){
    var gn = new GyroNorm();
    var logger = function(data) {
      console.warn("Gyro log:", data);
    }
    gn.init({ frequency: 10, decimalCounts: 3, logger: logger }).then(function() {
      gn.start(function(data) {
        flyer.newReading(data);
      });
    }).catch(function(e) {
      /* DeviceOrientation or DeviceMotion is not supported by the browser or device */
      flyer.accelerometerNotSupported();
    });
  }

  var accelerometerController = new AccelerometerController(window, flyer);

  function UplinkController(uplink, application){
    uplink.onconnected = function(){
      application.uplinkAvailable({ channelName: uplink.channelName });
    }
    uplink.onconnectionFailed = function(){
      application.uplinkFailed();
    }
    uplink.onconnectionDisconnected = function(){
      application.uplinkDisconnected({ channelName: uplink.channelName });
    }
  }
  var uplinkController = new UplinkController(uplink, flyer);

  return flyer;

})();
//# sourceMappingURL=flyer.js.map