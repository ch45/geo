let csvData = 'http://' + location.hostname + ':8888/geo/data/gps_2021-09-15_Throop_Loop.csv';

let dataTypes = [
  {"include": false, "name": "Particulates <1um", "column": "PMS 1.0", "colour": "#5946B2"},
  {"include": false, "name": "Particulates <2.5um", "column": "PMS 2.5", "colour": "#9C51B6"},
  {"include": true, "name": "Particulates <10um", "column": "PMS 10.0", "colour": "#E936A7"},
  {"include": false, "name": "Carbon Monoxide (CO)", "column": "Gas Reducing", "colour": "#8FD400"},
  {"include": true, "name": "Nitrogen Dioxide (NO2)", "column": "Gas Oxidizing", "colour": "#319177"},
  {"include": false, "name": "Ammonia (NH3)", "column": "Gas NH3", "colour": "#4A646C"},
  {"include": false, "name": "Noise Low", "column":"Noise Low", "colour": "#000000"},
  {"include": false, "name": "Noise Mid", "column":"Noise Mid", "colour": "#000000"},
  {"include": false, "name": "Noise High", "column":"Noise High", "colour": "#000000"},
  {"include": false, "name": "Noise Total", "column":"Noise Total", "colour": "#000000"},
  {"include": false, "name": "Temperature", "column":"Temperature", "colour": "#000000"},
  {"include": false, "name": "Humidity", "column":"Humidity", "colour": "#000000"},
  {"include": false, "name": "Light", "column":"Lux", "colour": "#000000"},
];

const blobAlpha = 128;
const blobMaxRadius = 24;
let table;
let extents;
let centre;
let myMap;
let mappa = new Mappa('Leaflet');
let needToFit = true;
let mapChanged = false;
let legend;
let selectionChanged = false;
let selectLastId;
let selectLastChecked;


function preload() {
  table = loadTable(csvData, 'csv', 'header');
}


function setup() {
  let numRows = table.getRowCount();
  let numCols = table.getColumnCount();

  print("csv data numRows " + numRows + " numCols " + numCols);

  convertLatLong();
  extents = getExtents();
  centre = getCentre(extents);

  let options = {
    lat: centre.centreLat,
    lng: centre.centreLong,
    zoom: 7,
    style: "http://{s}.tile.osm.org/{z}/{x}/{y}.png"
  }

  // Create a canvas
  let canvas = createCanvas(windowWidth, windowHeight);

  // Create map
  myMap = mappa.tileMap(options);

  // Draw the map on the canvas
  myMap.overlay(canvas);

  // Only redraw when the map changes
  myMap.onChange(cbMapChanged);

  setupLegend();
}


function onClickHandler(input) {
  selectionChanged = true;
  selectLastId = input.id;
  selectLastChecked = input.checked;
}


function setupLegend() {
  legend = L.control({position: 'bottomright'});
  legend.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'legend');
    for (let j = 0; j < dataTypes.length; j++) {
      div.innerHTML += '<div><input type="checkbox" id="' + makeId(dataTypes[j].column) + '"' +
        ' onclick="onClickHandler(this);"' +
        (dataTypes[j].include ? ' checked' : '') + '>' +
        '<label for="' + makeId(dataTypes[j].column) + '">' + dataTypes[j].name + '</label></div>';
    }
    return div;
  };
}


function draw() {
  if (mapChanged) {
    mapChanged = false;
    clear();
    // noFill();

    for (let j = 0; j < dataTypes.length; j++) {
      if (!dataTypes[j].include) {
        continue;
      }
      fill(red(dataTypes[j].colour), green(dataTypes[j].colour), blue(dataTypes[j].colour), blobAlpha);
      stroke(red(dataTypes[j].colour), green(dataTypes[j].colour), blue(dataTypes[j].colour), blobAlpha);
      drawEnvironmental(dataTypes[j].column, dataTypes[j].name);
    }

    stroke(0, 0, 255);
    drawTrack();

    myMap.map.addControl(legend);
  }

  if (selectionChanged) {
    selectionChanged = false;
    for (let j = 0; j < dataTypes.length; j++) {
      if (makeId(dataTypes[j].column) !== selectLastId) {
        continue;
      }
      dataTypes[j].include = selectLastChecked;
      break;
    }
    mapChanged = true;
  }
}


function drawTrack() {
  let latCol = colFromName("Latitude");
  let longCol = colFromName("Longitude");
  let numRows = table.getRowCount();
  let moveToMode = true;
  let moveToX;
  let moveToY;

  for (let r = 0; r < numRows; r++) {
    let ptLat = table.get(r, latCol);
    let ptLong = table.get(r, longCol);
    let pos = myMap.latLngToPixel(ptLat, ptLong);
    if (pos.x >= 0 && pos.x <= windowWidth && pos.y >= 0 && pos.y <= windowHeight) {
      noFill();
      if (moveToMode) {
        moveToMode = false;
      } else {
        line(moveToX, moveToY, pos.x, pos.y);
      }
      moveToX = pos.x;
      moveToY = pos.y;
    } else {
      if (!moveToMode) {
        moveToMode = true;
      }
    }
  }
}


function drawEnvironmental(colName, enviroName) {
  let min;
  let max = -Number.MAX_VALUE;
  let maxRadius = blobMaxRadius;
  let maxLat;
  let maxLong;
  let maxPtTime;
  let data = [];
  let latCol = colFromName("Latitude");
  let longCol = colFromName("Longitude");
  let numRows = table.getRowCount();
  let envCol = colFromName(colName);
  if (!envCol) {
    return;
  }
  for (let r = 0; r < numRows; r++) {
    let ptLat = table.get(r, latCol);
    let ptLong = table.get(r, longCol);
    let ptVal = parseFloat(table.get(r, envCol));
    let pos = myMap.latLngToPixel(ptLat, ptLong);
    if (pos.x >= 0 && pos.x <= windowWidth && pos.y >= 0 && pos.y <= windowHeight) {
      data.push([pos.x, pos.y, ptVal]);
      if (ptVal > max) {
        if (max === -Number.MAX_VALUE) {
          min = ptVal;
        }
        max = ptVal;
        maxLat = ptLat;
        maxLong = ptLong;
        maxPtTime = table.getString(r, colFromName("Time"));
      }
      if (ptVal < min) {
        min = ptVal;
      }
    }
  }
  let step = Math.trunc(data.length / (99 + envCol) + 1);
  for (let j = 0; j < data.length; j += step) {
    let r = map(data[j][2], min, max, 0, maxRadius);
    ellipse(data[j][0], data[j][1], r, r);
  }
  if (max > -1) {
    var html = '<p>' + enviroName + '<br />' + fmtValueSigFig(max, 4) + '<br />' + fmtTime(maxPtTime) + '</p>';
    var popup = L.popup().setLatLng([maxLat, maxLong]).setContent(html);
    popup.addTo(myMap.map);
  }
}

function colFromName(colName) {
  let numCols = table.getColumnCount();
  for (var j = 0; j < numCols; j++) {
    if (table.columns[j].trim() === colName) {
      break;
    }
  }
  if (j === numCols) {
    return;
  }
  return j;
}


function cbMapChanged() {
  mapChanged = true;

  if (needToFit) {
    needToFit = false;
    myMap.map.fitBounds([[extents.leastLat, extents.leastLong], [extents.greatestLat, extents.greatestLong]]);
  }
}


function convertLatLong() {
  let recentLat;
  let recentLong;
  let recentSet = false;
  let firstLat;
  let firstLong;
  let firstGPSRow;
  let firstSet = false;
  let latCol = colFromName("Latitude");
  let hemiCol = latCol + 1;
  let longCol = colFromName("Longitude");
  let sideCol = longCol + 1;
  let numRows = table.getRowCount();

  for (let r = 0; r < numRows; r++) {
    let ptLat = table.getString(r, latCol);
    let ptHemi = table.getString(r, hemiCol);
    let ptLong = table.getString(r, longCol);
    let ptSide = table.getString(r, sideCol);
    if (ptLat === "" && ptLong === "") {
      if (recentSet) {
        table.set(r, latCol, recentLat);
        table.set(r, longCol, recentLong);
      }
    } else {
      let convertedLat = Math.floor(ptLat/100) + Math.floor(ptLat % 100)/60 + (ptLat-Math.floor(ptLat))*60/3600;
      if (ptHemi === "S") {
        convertedLat = -convertedLat;
      }
      let convertedLong = Math.floor(ptLong/100) + Math.floor(ptLong % 100)/60 + (ptLong-Math.floor(ptLong))*60/3600;
      if (ptSide === "W") {
        convertedLong = -convertedLong;
      }
      table.set(r, latCol, convertedLat);
      table.set(r, longCol, convertedLong);
      if (!recentSet) {
        recentSet = true;
        recentLat = convertedLat;
        recentLong = convertedLong;
      }
      if (!firstSet) {
        firstSet = true;
        firstLat = convertedLat;
        firstLong = convertedLong;
        firstGPSRow = r;
      }
    }
  }
  for (let r = 0; r < firstGPSRow; r++) {
    table.set(r, latCol, firstLat);
    table.set(r, longCol, firstLong);
  }
}


function getExtents() {
  let latCol = colFromName("Latitude");
  let longCol = colFromName("Longitude");
  let numRows = table.getRowCount();
  let leastLat = 90;
  let leastLong = 180;
  let greatestLat = -90;
  let greatestLong = -180;

  let ptLat = table.get(0, latCol);
  let ptLong = table.get(0, longCol);
  leastLat = ptLat;
  leastLong = ptLong;
  greatestLat = ptLat;
  greatestLong = ptLong;

  for (let r = 0; r < numRows; r++) {
    ptLat = table.get(r, latCol);
    ptLong = table.get(r, longCol);
    if (ptLat < leastLat) {
      leastLat = ptLat;
    }
    if (ptLong < leastLong) {
      leastLong = ptLong;
    }
    if (ptLat > greatestLat) {
      greatestLat = ptLat;
    }
    if (ptLong > greatestLong) {
      greatestLong = ptLong;
    }
  }

  return { "leastLat": leastLat, "leastLong": leastLong, "greatestLat": greatestLat, "greatestLong": greatestLong };
}


function getCentre(extents) {
  return { "centreLat": (extents.leastLat + extents.greatestLat) / 2, "centreLong": (extents.leastLong + extents.greatestLong) / 2 };
}


function makeId(x) {
  return x.replace(' ', '-');
}


function fmtValueSigFig(num, sigFig) {
  return num.toLocaleString(undefined, { maximumSignificantDigits: sigFig });
}


function fmtTime(time) {
  return time.substring(0, 2) + ':' + time.substring(2, 4) + ':' + time.substring(4, 6);
}
