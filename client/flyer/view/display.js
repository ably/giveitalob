/* jshint esnext: true */

import AlertDisplay from "../../alert/display";
import Device from "../../lib/device";

/* This function class contains the logic for the presentation
   messaging in the view based on the state, but is weirdly not a
   view itself as their is a view, a projection, and a presenter? */

function Display($root){
  var $leaderboardPanel = $root.find(".submit-to-leaderboard"),
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
      $lobCode = $root.find(".lob-code"),
      $loader = $root.find(".connecting-loader"),
      $connectionActive = $root.find(".connection-active"),
      $lobHeight = $root.find(".last-reading .height"),
      $lobAirtime = $root.find(".last-reading .airtime");

  var alertDisplay = AlertDisplay();

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
        $uplinkStatus.show().html("Hold on, we're now establishing a connection to stream your lob live.");
        setLoading(true);
        break;
      case "disconnected":
        $uplinkStatus.show().html("Oops, we seem to have been disconnected. Trying to reconnect now.");
        setLoading(true);
        break;
      case "failed":
        $uplinkStatus.show().html("Oops, it looks like we cannot connect to the phone. Are you sure you have an Internet connection available?");
        setLoading(true);
        break;
      case "incompatible":
        $uplinkStatus.show().html("Unfortunately an accelerometer was not found on this device. Please try with a more modern mobile phone.");
        setLoading(true);
        break;
      case "transmitting":
        $uplinkStatus.hide();
        setLoading(false);
        break;
      default:
        console.error('Unknown status', status);
    }
  }

  function renderNoThrows(presentation) {
    $message.html('<p class="prompt">Ready?</b></p><p>Lob your phone in the air and don\'t forget to catch it!</p>');
    updateUplinkStatus(presentation);
  }

  function renderFirstThrow(presentation) {
    $message.html('<p class="prompt">Great throw!</p>' +
      "<p>Go on, try again!</p>");
    $lobHeight.text(presentation.lastAltitude);
    $lobAirtime.text(presentation.lastFlightTime + ' Airtime');
    updateUplinkStatus(presentation);
  }

  function renderMultipleThrows(presentation) {
    if (presentation.lastHigherThanBefore) {
      $message.html('<p class="prompt">Superb, that\'s your new record!</p>' +
        "<p>Go for glory, see if you can go higher!</p>");
      $lobHeight.text(presentation.lastAltitude);
      $lobAirtime.text(presentation.lastFlightTime + ' Airtime');
      showLeaderboard(presentation.rawMaxAltitude, presentation.rawMaxFlightTime);
    } else {
      $message.html('<p class="prompt">Not bad, but not your best so far.</p>' +
        "<p>Give it another go!</p>");
      $lobHeight.text(presentation.lastAltitude);
      $lobAirtime.text(presentation.lastFlightTime + ' Airtime');
    }
    updateUplinkStatus(presentation);
  }

  this.render = function(presentation) {
    $lobCode.text(presentation.channelName);

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

export function create($root){ Display($root); }

export default Display;
