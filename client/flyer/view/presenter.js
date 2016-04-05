/* jshint esnext: true */

export function format(i){
  var fixed = i.toFixed(2);
  var signed = i < 0 ? fixed : "+" + fixed;
  var short = "+00.00".length - signed.length;
  var padded = (short == 1) ? signed.replace(/[\+\-]/, function(sign){ return sign + "0"; }) : signed;
  return padded;
}

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

export function present(app){
  return new Presenter(app);
}
export default present;
