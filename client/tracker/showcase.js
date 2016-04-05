/* jshint esnext: true */

function isLive(projection){
  return !projection.flightSnapshot;
}

export default function TrackerShowcase(window){
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
