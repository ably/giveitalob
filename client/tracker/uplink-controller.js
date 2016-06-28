// RESPONSIBILITY - Drive the tracker application in response to messages from the Ably uplink
import Reading from "../lib/reading";
import { Config } from "../Config";

/* jshint esnext: true */
export default function UplinkController(options, tracker){
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
      });
    }
  });

  if (Config.debug) {
    /* Debug flight info channel when enabled in the publisher phone */
    var debugChannel = realtime.channels.get("debug:" + channelName);
    console.warn("Running in debug mode - this mode may consume a lot of memory for flight data stored in window.debugFlightMetrics");
    console.warn("Calling dumpFlightMetrics(clear: bool) will export flightMetricsData as a CSV, or copyFlightMetrics(clear: bool) to copy to clipboard");

    debugChannel.subscribe(function(flightMetricsMsg) {
      if (!window.debugFlightMetrics) { window.debugFlightMetrics = [] }
      flightMetricsMsg.data.forEach(function(flightMetric) {
        window.debugFlightMetrics.push(flightMetric);
      });
    });

    function flightMetricsCsv() {
      var outputs = ["time,timeHuman,readingX,readingY,readingZ,orientationAlpha,orientationBeta,orientationGamma"];

      window.debugFlightMetrics.forEach(function(flightMetric) {
        outputs.push([flightMetric.time, flightMetric.timeHuman,
                     flightMetric.reading.x, flightMetric.reading.y, flightMetric.reading.z,
                     flightMetric.orientation.alpha, flightMetric.orientation.beta, flightMetric.orientation.gamma].join(","));
      });

      return outputs.join("\n");
    }

    function clearMetrics() {
      window.debugFlightMetrics = [];
      console.warn("Metrics truncated");
    }

    window.dumpFlightMetrics = function(clear) {
      console.log(flightMetricsCsv());
      if (clear) { clearMetrics(); }
    }

    window.copyFlightMetrics = function(clear) {
      copy(flightMetricsCsv());
      console.log("Flight metrics copied to clipboard");
      if (clear) { clearMetrics(); }
    }
  }
}
