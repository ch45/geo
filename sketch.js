let csvData = 'http://localhost:8888/geo/data/gps_2021-09-15_Throop_Loop.csv';

let dataTypes = [
  {"include": false, "name": "Particulates <1um ug/m3", "column": "PMS 1.0", "colour": "#5946B2"},
  {"include": false, "name": "Particulates <2.5um ug/m3", "column": "PMS 2.5", "colour": "#9C51B6"},
  {"include": true, "name": "Particulates <10um ug/m3", "column": "PMS 10.0", "colour": "#E936A7"},
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
let moveToMode = true;
let moveToX;
let moveToY;

// Lets change the map tiles to something with more contrast
let options = {
  lat: 51.476959895490396,
  lng: 0.0,
  zoom: 7,
  style: "http://{s}.tile.osm.org/{z}/{x}/{y}.png"
}


function preload() {
  table = loadTable(csvData, 'csv', 'header');
}


function setup() {
  let rows = table.getRowCount();
  let cols = table.getColumnCount();

  print("csv data rows " + rows + " cols " + cols);
  print("windowWidth " + windowWidth + " windowHeight " + windowHeight);

  convertLatLong();
  extents = getExtents();
  centre = getCentre(extents);

  options.lat = centre.centreLat;
  options.lng = centre.centreLong;

  // Create a canvas
  let canvas = createCanvas(windowWidth, windowHeight);

  // Create map
  myMap = mappa.tileMap(options);

  // Draw the map on the canvas
  myMap.overlay(canvas);

  // Only redraw when the map changes
  myMap.onChange(cbMapChanged);
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
      print(dataTypes[j].name);
      fill(red(dataTypes[j].colour), green(dataTypes[j].colour), blue(dataTypes[j].colour), blobAlpha);
      stroke(red(dataTypes[j].colour), green(dataTypes[j].colour), blue(dataTypes[j].colour), blobAlpha);
      drawEnvironmental(dataTypes[j].column);
    }

    stroke(0, 0, 255);
    drawTrack();
  }
}


function drawTrack() {
  let rows = table.getRowCount();
  for (let r = 0; r < rows; r++) {
    let ptLat = table.get(r, 0);
    let ptLong = table.get(r, 2);
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
  if (!moveToMode) {
    moveToMode = true;
  }
}


function drawEnvironmental(colName) {
  let min;
  let max = -1;
  let maxRadius = blobMaxRadius;
  let data = [];
  let rows = table.getRowCount();
  let col = colFromName(colName);
  if (!col) {
    return;
  }
  for (let r = 0; r < rows; r++) {
    let ptLat = table.get(r, 0);
    let ptLong = table.get(r, 2);
    let ptVal = parseFloat(table.get(r, col));
    let pos = myMap.latLngToPixel(ptLat, ptLong);
    if (pos.x >= 0 && pos.x <= windowWidth && pos.y >= 0 && pos.y <= windowHeight) {
      data.push([pos.x, pos.y, ptVal]);
      if (ptVal > max) {
        if (max === -1) {
          min = ptVal;
        }
        max = ptVal;
      }
      if (ptVal < min) {
        min = ptVal;
      }
    }
  }
  let step = Math.trunc(data.length / (99 + col) + 1);
  for (let j = 0; j < data.length; j += step) {
    let r = map(data[j][2], min, max, 0, maxRadius);
    ellipse(data[j][0], data[j][1], r, r);
  }
}

function colFromName(colName) {
  let cols = table.getColumnCount();
  for (var j = 0; j < cols; j++) {
    if (table.columns[j].trim() === colName) {
      break;
    }
  }
  if (j === cols) {
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
  let recentLat = 0;
  let recentLong = 0;
  let firstLat = 0;
  let firstLong = 0;
  let firstGPSRow = 0;
  let rows = table.getRowCount();

  for (let r = 0; r < rows; r++) {
    let inLat = table.getString(r, 0);
    let inHemi = table.getString(r, 1);
    let inLong = table.getString(r, 2);
    let inSide = table.getString(r, 3);
    if (inLat === "" && inLong === "") {
      if (recentLat > 0 && recentLong > 0) {
        table.set(r, 0, recentLat);
        table.set(r, 2, recentLong);
      }
    } else {
      let outLat = Math.floor(inLat/100) + Math.floor(inLat % 100)/60 + (inLat-Math.floor(inLat))*60/3600;
      if (inHemi === "S") {
        outLat = -outLat;
      }
      let outLong = Math.floor(inLong/100) + Math.floor(inLong % 100)/60 + (inLong-Math.floor(inLong))*60/3600;
      if (inSide === "W") {
        outLong = -outLong;
      }
      table.set(r, 0, outLat);
      table.set(r, 2, outLong);
      if (recentLat === 0 && recentLong === 0) {
        recentLat = outLat;
        recentLong = outLong;
        firstGPSRow = r;
      }
    }
  }
  for (let r = 0; r < firstGPSRow; r++) {
    table.set(r, 0, firstLat);
    table.set(r, 2, firstLong);
  }
}


function getExtents() {
  let rows = table.getRowCount();
  let leastLat = 90;
  let leastLong = 180;
  let greatestLat = -90;
  let greatestLong = -180;

  for (let r = 0; r < rows; r++) {
    let ptLat = table.get(r, 0);
    let ptLong = table.get(r, 2);
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
