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

export function project(app){
  return new Projection(app);
}
export default project;
