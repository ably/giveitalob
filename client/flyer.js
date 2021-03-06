/* jshint esnext: true */

import Projection from "./flyer/projection";
import Reading from "./lib/reading";
import Audio from "./lib/Audio";
import FlyerState from './flyer/state'
import { Config } from './config'

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

var lastDebugArgs;

function debug() {
  if (Config.debug) {
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

/* Detect spins and show a warning to the user that spinning whilst lobbing is disallowed
   as it adversely effects the readings */
function SpinDetector() {
  this.READINGS_FREQUENCY = 25; /* max readings stored per ms */
  this.READINGS_MAX_AGE = 2000; /* truncate if older than this in ms */
  this.RECENT_SPIN_CALLBACK_RATE = 500; /* don't trigger recently spun checks more than X milliseconds */
  this.ROTATIONS_ALLOWED_PER_SECOND = 0.75; /* full rotations allowed per second */
  this.MAX_READING_JUMP = 150; /* prevent readings such as 0 to 359 being seen as a rotation of 359 forwards instead of 1 degree back */

  this.readings = []
  this.readingsQueued = false;
}

/* private */
SpinDetector.prototype._pushReading = function(orientation) {
  this.readings.push({
    time: new Date().getTime(),
    alpha: orientation.alpha,
    beta: orientation.beta,
    gamma: orientation.gamma
  });
}

SpinDetector.prototype._truncateReadings = function(truncateAll) {
  var now = new Date().getTime();

  if (truncateAll) {
    this.readings = [];
    return;
  }

  while (this.readings.length && (this.readings[0].time < (now - this.READINGS_MAX_AGE))) {
    this.readings.shift();
  }
}

SpinDetector.prototype.addReading = function(orientation) {
  var that = this;

  if (this.readingsQueued) {
    this.nextReading = orientation;
  } else {
    this._pushReading(orientation);
    this.readingsQueued = true;

    setTimeout(function() {
      if (this.nextReading) {
        this._pushReading(orientation);
        this.nextReading = null;
      }
      that.readingsQueued = false;
    }, this.READINGS_FREQUENCY);

    this._truncateReadings();
  }
}

SpinDetector.prototype.recentlySpun = function(callback) {
  var readings = this.readings,
      now = new Date().getTime(),
      rotationsAllowedPerSecond = this.ROTATIONS_ALLOWED_PER_SECOND,
      that = this;

  if (this.lastSpunCheck && (this.lastSpunCheck > new Date().getTime() - this.RECENT_SPIN_CALLBACK_RATE)) {
    return;
  }
  this.lastSpunCheck = now;

  this._truncateReadings();

  'alpha beta gamma'.split(' ').forEach(function(axes) {
    var posChange = [], posLastVal = null,
        negChange = [], negLastVal = null,
        spinTotal,
        reading, readingIndex,
        MAX_READING_JUMP = that.MAX_READING_JUMP;


    for (readingIndex = 0; readingIndex < readings.length; readingIndex++) {
      var reading = readings[readingIndex],
          absReading = Math.abs(reading[axes]) % 360;

      if ((posLastVal === null) || (negLastVal === null)) {
        posLastVal = absReading;
        negLastVal = absReading;
      } else {
        /* Truncate movement readings from before threshold */
        [posChange, negChange].forEach(function(changeHistory) {
          while (changeHistory.length && (changeHistory[0].time < now - (1000 / rotationsAllowedPerSecond))) {
            changeHistory.shift();
          }
        });

        /* track positive movement on the axis */
        if ((absReading > posLastVal) && (absReading < posLastVal + MAX_READING_JUMP)) {
          posChange.push(absReading - posLastVal);
          posLastVal = absReading;
        } else if ( (posLastVal > (360-MAX_READING_JUMP/2)) && (absReading < (MAX_READING_JUMP/2)) ) { /* wrapped past 360 such as 340 -> 20 */
          posChange.push(360-posLastVal + absReading);
          posLastVal = absReading;
        }
        spinTotal = posChange.reduce(function(a,b) { return a+b; }, 0);
        if (spinTotal >= 180) {
          debug("Pos spin", axes, spinTotal, readings);
        }
        if (spinTotal >= 360) {
          debug("SpinDetector.recentlySpun: detected positive spin on axes " + axes + ": " + spinTotal);
          that._truncateReadings(true);
          callback();
          return;
        }

        /* track negative movement on the axis represented as a positive value */
        if ((absReading < negLastVal) && (absReading > negLastVal - MAX_READING_JUMP)) {
          negChange.push(negLastVal - absReading);
          negLastVal = absReading;
        } else if ( (negLastVal < (MAX_READING_JUMP/2)) && (absReading > (360-MAX_READING_JUMP/2)) ) { /* wrapped past 360 such as 20 -> 340 */
          negChange.push(negLastVal + 360-absReading);
          negLastVal = absReading;
        }
        spinTotal = negChange.reduce(function(a,b) { return a+b; }, 0);
        if (spinTotal >= 180) {
          debug("Neg spin", axes, spinTotal, readings);
        }
        if (spinTotal >= 360) {
          debug("SpinDetector.recentlySpun: detected negative spin on axes " + axes + ": " + spinTotal);
          that._truncateReadings(true);
          callback();
          return;
        }
      }
    }
  });
}

export default function Flyer(state) {
  if ( !(this instanceof Flyer) ) { return new Flyer(state); }

  var flyer = this;
  var audio = new Audio();
  var peakOrTroughHistory = [];
  var currentFlightReadings = [];
  var lastThrowCompleted;
  var spinDetector = new SpinDetector();
  var spinAlertInterval;

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
    spinDetector.addReading(orientation);

    spinDetector.recentlySpun(function() {
      if (spinAlertInterval) { clearInterval(spinAlertInterval); }
      console.warn("Stop spinning that phone, you're gonna break it");
      $('.spin-warning').show();
      spinAlertInterval = setTimeout(function() {
        $('.spin-warning').hide();
      }, 6000);
    });

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
      var projection = Projection(state);
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
    flyer.view.render(Projection(state));
  }

  // DEBT should be set separatly for Testing
  flyer.clock = window.Date;
}
Flyer.State = FlyerState;
