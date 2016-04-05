export var Config = {
  readingPublishLimit: 200, // ms
  flightPublishLimit: 1000, // ms
  trackingGraphTimePeriod: 8000, // ms - time to keep points in visible graph
  gravityMagnitudeConstant: 10, // default gravity magnitude value from accelerometer
  broadcastNewChannelName: 'broadcast:channel' /* replicated in app.rb */
};
