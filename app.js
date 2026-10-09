// TODO Replace with sheets URL
const sheetCsvUrl = 'locations.csv';

// Initialize Map
const mapOptions = {
    maxBounds : L.latLngBounds([-90, -180], [90, 180]),
    maxBoundsViscosity: 0.7,
    minZoom: 2,
    renderer: L.canvas({ tolerance: 5}), // Extra touch radius
}
const map = L.map('map', mapOptions).setView([20, 0], 2); // Default global view

var Stadia_StamenTonerBackground = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_background/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
});
var Stadia_StamenTonerLines = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
});

// Stadia_StamenTonerLines.addTo(map) TODO add if wanted
Stadia_StamenTonerBackground.addTo(map);

const pointOptions = {
    radius: 4,
    color: '#000000',
    weight:2,
    fillColor: '#1409f6',
    fillOpacity: 1,
    interactive:true
}

const areaOptions = {
    color: '#000000',
    weight:2,
    fillColor: '#FF0000',
    fillOpacity: 0.3,
    interactive:true
}

const msg = document.getElementById("quiz-box");

/** Enum for game state */
const GAME_STATES = Object.freeze({
    VIEWING: 'VIEWING',
    IN_GAME: 'IN_GAME',
    GAME_OVER: 'GAME_OVER',
});

/** ALL Locations with all fields and display */ 
let locations = [];
/** Active working set of locations */
let locationSet = [];
/** Index that is being tested, should just iterate up after set sorted */ 
let currentIndex = 0;
/** Current game score */
let score = 0;
/** Marker over the correct area */
let activeMarker = null;
/** Marker that user guessed */
let guessMarker = null;
/** Current game state */
let gameState = GAME_STATES.VIEWING;

// Fetch and parse the CSV data
Papa.parse(sheetCsvUrl, {
    download: true,
    header: true,
    complete: function(results) {
        console.log("Results arr:", results);
        // Filter out empty rows
        locations = results.data.filter(row => row.name && row.lat && row.lng);
        // Store display object as a field
        locations.forEach((location) => {
            display = null;
            if(location['border'] != "") {
                points = JSON.parse(location['border']);
                display = L.polygon(points, areaOptions);
            } else {
                coords = [parseFloat(location['lat']),parseFloat(location['lng'])]
                display = L.circleMarker(coords, pointOptions);
            }
            display.options.location = location;
            display.bindTooltip(location.name, {direction: 'top'});
            display.on('click', onLocationClick);
            location['display'] = display;
        });
        locationSet = locations.slice(); 
        console.log("Locations:", locations);
        switchToView();
    }
});

function switchToPlay() {
    if (locations.length === 0) {
        document.getElementById('prompt').innerText = "No locations found!";
        return;
    }
    msg.style.display = 'block';
    clearLocations();
    currentIndex = 0;
    score = 0;
    // Get filters, plot locations, randomize
    let filter = document.getElementById('filter-region').value;
    if(filter == "all") {
        locationSet = locations.slice();
    } else {
        locationSet = locations.filter(location => location.continent == filter);
    }
    console.log("Location set: ", locationSet);
    plotLocations();
    locations.sort(() => Math.random() - 0.5);

    // TODO Should load borders first and then points
    // Make so that on click event on these areas validates
    // Should not be every on click activating through html
    // Add logic to reset the state of score, index, etc with reset_game()
    // Add clear_areas() to wipe slate if filters changed
    // Add support for toggles like seeing previous guesses or not
    
    showQuestion();
    
    // Listen for user clicks on the map(Not current but later with hide features)
    // map.on('click', onMapClick);
}

function plotLocations() {
    let areas = locationSet.filter(location => location.border != "");
    let points = locationSet.filter(location => location.border == "");
    console.log("Areas:", areas);
    console.log("Points: ", points);

    areas.forEach(area => area.display.addTo(map));
    points.forEach(point => point.display.addTo(map));
}

function showQuestion() {
    if (activeMarker) map.removeLayer(activeMarker);
    if(guessMarker) map.removeLayer(guessMarker);
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('prompt').innerText = `Find: ${locations[currentIndex].name}`;
}

function nextQuestion() {
    currentIndex++;
    if (currentIndex < locations.length) {
        showQuestion();
    } else {
        document.getElementById('prompt').innerText = `Game Over! Final Score: ${score}/${locationSet.length}`;
        document.getElementById('next-btn').style.display = 'none';
        map.off('click', onMapClick); // Disable map clicks
    }
}

function onLocationClick(event) {
    console.log("Click event: ", event);
    let location = getLocationFromEvent(event);
    console.log("Clicked location: ", location);

    if(gameState == GAME_STATES.VIEWING) {
        if(activeMarker) map.removeLayer(activeMarker);

        let pos = [parseFloat(location.lat), parseFloat(location.lng)];
        activeMarker = L.marker(pos, {interactive:true}).addTo(map)
        .bindPopup(`<b>${location.name}</b>`)
        .openPopup();
    } else {

    }
}

// View Locations button callback
function switchToView() {
    if (locations.length === 0) {
        document.getElementById('prompt').innerText = "No locations found!";
        return;
    }
    msg.style.display = 'none';
    clearLocations();
    currentIndex = 0;
    score = 0;
    // Get filters, plot locations, randomize
    let filter = document.getElementById('filter-region').value;
    if(filter == "all") {
        locationSet = locations.slice();
    } else {
        locationSet = locations.filter(location => location.continent == filter);
    }
    console.log("Location set: ", locationSet);
    plotLocations();
    // locationSet.forEach(location => location.display.openTooltip());
    locations.sort(() => Math.random() - 0.5);
}

function getLocationFromEvent(event) {
    return event.target.options.location;
}

function clearLocations() {
    if(!locationSet) return;
    locationSet.forEach(location => map.removeLayer(location.display));
}

function updateFilter() {

}