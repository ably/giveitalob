import { Config } from './config';

$(function() {
  var $mobileSupported = $('.mobile-ready'),
      $mobileNotSupported = $('.mobile-not-ready'),
      $channelName = $(this).find('input[name=channel-name]');

  var gn = new GyroNorm();
  gn.init().then(function() {
    if (gn.isAvailable(GyroNorm.DEVICE_ORIENTATION) || gn.isAvailable(GyroNorm.ACCELERATION_INCLUDING_GRAVITY)) {
      $mobileSupported.show();
      $mobileNotSupported.hide();
    }
  });

  $('form.track-flight').on('submit', function(event) {
    if ($channelName.val().replace(/^\s+|\s+$/g,"").length === 0) {
      event.preventDefault();
      $(this).find('input[name=channel-name]').focus();
      alert("Please enter a valid live Lob code from another device");
    }
  });

  var ably = new Ably.Realtime({ authUrl: '/token' }),
      broadcastChannel = ably.channels.get(Config.broadcastNewChannelName),
      $recentLobs = $('div.recent-lobs'),
      $lobHistory = $('ul.lob-history'),
      recentChannels = {}

  function pruneAndPresentChannelData() {
    var activeChannelMessages = [],
        activeChannelIDs = {},
        $channelList = $('<ul>');

    for (var channel in recentChannels) {
      activeChannelMessages.push(recentChannels[channel])
    }

    activeChannelMessages.
      sort(function(a, b) { return b.timestamp - a.timestamp; }).
      slice(0,15).
      forEach(function(message) {
        activeChannelIDs[message.data.channel] = true;
        var link = $('<a>').text(message.data.channel).attr('href', '/track/' + message.data.channel);
        $channelList.append($("<li>").append(link));
      });

    for (var channel in recentChannels) {
      if (!activeChannelIDs[channel]) {
        delete recentChannels[channel];
      }
    }

    if ($channelList.find('li').length) {
      $lobHistory.find('li').remove();
      $lobHistory.append($channelList.find('li'));
      $recentLobs.show();
    }
  }

  broadcastChannel.attach(function(err) {
    if (err) {
      console.error("Could not attach to broadcast channel", err);
      return;
    }

    broadcastChannel.subscribe("new", function(message) {
      recentChannels[message.data.channel] = message;
      pruneAndPresentChannelData();
    });

    broadcastChannel.history(function(err, historyPage) {
      if (err) {
        console.warn("Could not retrieve broadcast history:", err);
        return;
      }
      historyPage.items.forEach(function(message) {
        recentChannels[message.data.channel] = message;
      });
      pruneAndPresentChannelData();
    });
  });
});
