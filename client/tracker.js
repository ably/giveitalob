/* jshint esnext: true */

// IMPORTS
import "./utils/polyfill";
import Tracker from "./tracker/tracker";
import Router from "./router";
import UplinkController from "./tracker/uplink-controller";
import ConsoleView from "./tracker/console-view";
import Showcase from "./tracker/showcase";
import Reading from "./lib/reading";
import AlertDisplay from "./alert/display";
import Phone from "./lib/phone";
import GraphDisplay from "./tracker/graph-display";
import { ready } from "./utils/dom";

// GENERAL CONFIGURATION
window.Tracker = Tracker;
window.Tracker.Reading = Reading;

var router = Router(window.location);
console.log('Router:', 'Started with initial state:', router.state);

var tracker = new Tracker();
tracker.logger = window.console;
tracker.showcase = Showcase(window);

var uplinkController = new UplinkController(router.state, tracker);

function uplinkStatusMessageFromProjection(projection) {
  var message = projection.uplinkStatus;
  if (message === 'AVAILABLE') {
    return "<p>We're connected, but waiting for data from phone <strong>" + projection.uplinkChannelName + '</strong>.</p>' +
      "<p>As soon as the phone sends its stats, we'll show you the live lob dashboard.</p>";
  } else if (message === 'STREAMING') {
    return 'Live lob dashboard for ' + (projection.uplinkDevice ? projection.uplinkDevice : "mobile") + " phone:" +
      '<span class="code">' + projection.uplinkChannelName + "</span>";
  } else if (message === 'FAILED') {
    return 'Oops, it looks like we cannot connect to the phone. Are you sure you have an Internet connection available?';
  } else if (message === 'DISCONNECTED') {
    return "Hold on, we've just been disconnected. We'll try and reconnect now...";
  } else {
    return "Oops, something bad has happened, and it's our fault. Please try and reload the page.";
  }
}

ready(function(){
  var $uplinkStatusMessage = $('.uplink-status-message'),
      $uplinkUpIcon = $('.uplink-up'),
      $graphAndPhone = $('.graph-and-phone'),
      $preloader = $('.connecting-loader'),
      $flightHistory = $('.flight-history'),
      $flightHistoryTable = $flightHistory.find('table');

  var alertDisplay = AlertDisplay(),
      phone = new Phone(),
      graphDisplay;

  var paused = false;

  var mainView = {
    render: function(projection) {
      $uplinkStatusMessage.html(uplinkStatusMessageFromProjection(projection));
      if ((projection.uplinkStatus === 'AVAILABLE') || (projection.uplinkStatus === 'STREAMING')) {
        $uplinkUpIcon.show();
      } else {
        $uplinkUpIcon.hide();
      }

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

export default tracker;

