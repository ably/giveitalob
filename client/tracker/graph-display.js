import { Config } from '../config';

export default function GraphDisplay(trackDivId) {
  if ( !(this instanceof GraphDisplay) ) { return new GraphDisplay(trackDivId); }

  var chart,
      context,
      data = [],
      lineDataTemplate = function() { return {
        labels: [],
        datasets: [
          {
            title: "Magnitude",
            strokeColor: "rgba(151,187,205,1)",
            fillColor: "rgba(255,255,255,0)",
            data: [],
            xPos: [],
            axis: 1
          },
          {
            title: "Throw",
            fillColor: "rgba(220,0,0,0.4)",
            strokeColor: "rgba(220,0,0,1)",
            data: [],
            xPos: [],
            axis: 2
          }
        ]
      }; },
      chartOptions = {
        datasetFill: true,
        animation: false,
        pointDot : false,
        showToolTips: false,
        scaleOverride: true,
        scaleStartValue: -10,
        scaleSteps: 8,
        scaleStepWidth: 10,
        scaleLabel: "<%=value%>",
        responsive: false,
        yAxisLabel: "LobForce™",
        showXLabels: 5,
        scaleXGridLinesStep: 5,
        fmtXLabel : "fmttime ss",
        extrapolateMissingData: false,
        inGraphDataShow: true,
        inGraphDataTmpl: "<%=((v1 == 'Throw') && (v3 > 0) ? 'Lob ' + Math.round(v3*100)/100 + 'm' : '')%>",
        inGraphDataAlign: "left",
        inGraphDataVAlign: "bottom",
        inGraphDataPaddingX: 20,
        inGraphDataPaddingY: -15,
        inGraphDataFontColor: "rgba(220,0,0,1)",
        graphSpaceAfter: 0,
        spaceBottom: 0
      };

  var $trackerGraph = $('#tracker-graph'),
      $canvas = $trackerGraph.find('canvas'),
      listenerAdded = false;

  var lineData;

  function initialize(lineData) {
    setDimensions();
    context = $canvas[0].getContext("2d");
    chart = new Chart(context).Line(lineData, chartOptions);

    if (!listenerAdded) {
      listenerAdded = true;
      $(window).on('resize', function() { /* catches orientation changes and window resizing */
        var oldCanvas = $trackerGraph.find('canvas');
        oldCanvas.after('<canvas>');
        oldCanvas.remove();
        $canvas = $trackerGraph.find('canvas');
        chart = undefined;
        prepareAndTruncateData(); /* this will create a new graph */
      });
    }
  }

  function setDimensions() {
    $canvas.attr('width', $trackerGraph.width());
    $canvas.attr('height', $trackerGraph.height());
  }

  function maxTimestampFromData() {
    return Math.max.apply(null, data.map(function(elem) { return elem.date; }));
  }

  /* Ensuring that each data point falls cleanly on a label entry the charts
     no longer present weird curves that match the data entry points.  This is a ChartNew.js
     bug, but this works around that problem */
  function clipToDateLabel(date, labels) {
    var closestTime,
        dateTime = date.getTime();

    labels.forEach(function(label) {
      var labelTime = label.getTime();
      if ((!closestTime) || (Math.abs(dateTime - labelTime) < Math.abs(dateTime - closestTime))) {
        closestTime = labelTime;
      }
    });

    return closestTime;
  }

  /*
    Sort data, then delete old data, cut off point of Config.trackingGraphTimePeriod
  */
  function prepareAndTruncateData() {
    var minDateOnGraph = maxTimestampFromData() - Config.trackingGraphTimePeriod,
        minDate, maxDate, labels = [];

    lineData = lineDataTemplate(),

    data = data.filter(function(point) {
      return point.date > minDateOnGraph;
    }).sort(function(a,b) {
      return a.date - b.date;
    });

    minDate = data[0].date.getTime();
    maxDate = data[data.length - 1].date.getTime();
    for (var dtLabel = minDate; dtLabel <= maxDate; dtLabel += Config.readingPublishLimit) {
      labels.push(new Date(dtLabel));
    }
    lineData.labels = labels;

    var magnitudeData = data.filter(function(point) { return !isNaN(parseInt(point.value)) });
    lineData.datasets[0].data = magnitudeData.map(function(point) {
      return point.value;
    });
    lineData.datasets[0].xPos = magnitudeData.map(function(point) {
      return clipToDateLabel(point.date, labels);
    });

    var flightData = data.filter(function(point) { return isNaN(parseInt(point.value)) });
    lineData.datasets[1].data = flightData.map(function(point) {
      return point.altitude;
    });
    lineData.datasets[1].xPos = flightData.map(function(point) {
      return clipToDateLabel(point.date, labels);
    });
    if (!lineData.datasets[1].xPos.length) {
      delete lineData.datasets[1].xPos;
    }

    if (!chart) {
      initialize(lineData);
    } else {
      updateChart(context, lineData, chartOptions);
    }
  }

  this.addPoint = function(point) {
    var lobForce = Math.round((point.magnitude - Config.gravityMagnitudeConstant) * 100) / 100; /* LobForce is stationery at 0 */
    data.push({
      date: new Date(point.timestamp),
      value: lobForce
    });
    prepareAndTruncateData();
  }

  this.addFlight = function(flightData) {
    var start = flightData.peakInfo[0].timestampStart;
    var end = flightData.peakInfo[flightData.peakInfo.length-1].timestampEnd;
    var altitude = flightData.altitude;
    var midpointDate = (start + end) / 2;

    data.push({
      date: new Date(start),
      altitude: undefined
    });
    data.push({
      date: new Date(start+1),
      altitude: 0
    });
    data.push({
      date: new Date(midpointDate),
      altitude: altitude
    });
    data.push({
      date: new Date(end-1),
      altitude: 0
    });
    data.push({
      date: new Date(end),
      altitude: undefined
    });

    prepareAndTruncateData();
  }
}
