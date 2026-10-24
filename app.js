import {showMsgBox, hideMsgBox, setMsg, getFilters, 
    showNextBtn, hideNextBtn, getLocationFromEvent,
} from './app-util.js';

// TODO Replace with sheets URL
const sheetCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTzDq_NyP0Ivf1LrqqreaP9QL97QcX940Lokw8h-iv8PvaswgBL4dROUW1yGjcz2kqKyiI9gD2rwA8u/pub?gid=1405018077&single=true&output=csv';

// Initialize Map
const mapOptions = {
    maxBounds : L.latLngBounds([-90, -180], [90, 180]),
    maxBoundsViscosity: 0.7,
    minZoom: 2,
    renderer: L.canvas({ tolerance: 10}), // Extra touch radius
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

map.createPane('areaPane');
map.getPane('areaPane').style.zIndex = 450; // Above tiles, below markers

map.createPane('pointPane');
map.getPane('pointPane').style.zIndex = 460;

const pointOptions = {
    radius: 5,
    color: '#000000',
    weight: 2,
    fillColor: '#1409f6',
    fillOpacity: 1,
    pane: 'pointPane',
    interactive: true
}

const areaOptions = {
    color: '#000000',
    weight:2,
    fillColor: '#FF0000',
    fillOpacity: 0.3,
    pane: 'areaPane',
    interactive: true
}

/** Enum for game state */
const GAME_STATES = Object.freeze({
    VIEWING: 'VIEWING',
    IN_GAME: 'IN_GAME',
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

setMsg("Loading...");
showMsgBox();

// Fetch and parse the CSV data
Papa.parse(sheetCsvUrl, {
    download: true,
    header: true,
    complete: function(results) {
        setMsg("Finished loading");
        console.log("Results arr:", results);
        // Filter out empty rows
        locations = results.data.filter(row => row.name && row.lat && row.lng);
        // Store display object as a field
        locations.forEach((location) => {
            try {
                // TODO: Make it so that floats are stored as floats
                for (const key in location) {
                    location[key] = location[key].toLowerCase();
                }
                let display = null;
                // TODO Pull this data to get finer res
                if(location['border'] != "") {
                    let points = JSON.parse(location['border']);
                    display = L.polygon(points, areaOptions);
                } else {
                    let coords = [parseFloat(location['lat']),parseFloat(location['lng'])]
                    display = L.circleMarker(coords, pointOptions);
                }
                display.options.location = location;
                display.bindTooltip(location.name, {direction: 'top'});
                display.on('click', onLocationClick);
                location['display'] = display;
            } catch (error) {
                console.error("An error happened:", error.message);
                setMsg("Display loading error encountered for ",location['name'], "Please check the sheet format");
                process.exit(1);
            } 
        });
        locationSet = locations.slice(); 
        console.log("Locations:", locations);
        switchToView();
    }
});

window.switchToPlay = switchToPlay;
window.switchToView = switchToView;
window.nextQuestion = nextQuestion;
window.onFilterUpdate = onFilterUpdate;
window.flashTips = flashTips;

/**
 * Start game button callback function
 * Refreshes locations if coming from previous game
 * Else just keeps the filters that were on view
 * Zeros starting state and begins to show questions
 * TODO Disable tooltips
 */
function switchToPlay() {
    if (locations.length === 0) {
        setMsg("No locations found!");
        showMsgBox();
        return;
    }

    // Load filters if loading new game from game, else keep view filters
    // Due to filters not being applied if game active
    let prevState = gameState;
    gameState = GAME_STATES.IN_GAME; // Block filter click updates
    if(prevState == GAME_STATES.IN_GAME) {
        refreshLocationSet();
    }
    if(locationSet == null || locationSet.length == 0) {
        console.log("SWITCHING TO VIEW LOCATION SET EMPTY");
        switchToView(); 
        return;
    }
    disableTooltips();
    locationSet.sort(() => Math.random() - 0.5);

    console.log("Game start locations:", locationSet);
    currentIndex = 0;
    score = 0;
    
    showMsgBox();
    showQuestion();
    // Listen for user clicks on the map(Not current but later with hide features filter)
    // map.on('click', onMapClick);
}

/**
 * View locations button callback function
 * Prepares state for viewing mode
 * Refreshes locations with all filters checked during play
 * Hides away quiz message
 * Removes map markers
 * TODO: Enable tooltips
 */
function switchToView() {
    if (locations.length === 0) {
        setMsg("No locations found!");
        showMsgBox();
        return;
    }
    refreshLocationSet();
    if(locationSet == null || locationSet.length == 0) {
        console.log("NO ITEMS TO VIEW");
        return;
    }
    enableTooltips();
    hideMsgBox();
    gameState = GAME_STATES.VIEWING;
    if(activeMarker) map.removeLayer(activeMarker);
    if(guessMarker) map.removeLayer(guessMarker);
    // Get filters, plot locations, randomize
    console.log("Location set: ", locationSet);
}

/**
 * Main quiz function.
 * On View:
 *  Drops a pin onto the clicked location
 * On Game:
 *  Drops pin onto clicked location
 *  Checks if location is correct
 *  Adds to score, shows guessed location if wrong
 *  Allow next button to be pressed
 */
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
    } else if(gameState == GAME_STATES.IN_GAME && activeMarker == null){
        let wantedLocation = locationSet[currentIndex];
        let pos = [parseFloat(wantedLocation.lat), parseFloat(wantedLocation.lng)];
        activeMarker = L.marker(pos, {interactive:true}).addTo(map)
                        .bindPopup(`Answer: <b>${wantedLocation.name}</b>`)
                        .openPopup();
        // TODO add getitng user mouse pos
        if(wantedLocation == location) {
            score++;
            setMsg("Correct!", `${score}/${locationSet.length}`)
        } else {
            setMsg("Incorrect!", `${score}/${locationSet.length}`);
            let pos2 = [parseFloat(location.lat), parseFloat(location.lng)];
            guessMarker = L.marker(pos2, {interactive:true}).addTo(map)
                        .bindPopup(`You guessed: <b>${location.name}</b>`);
        }
        showNextBtn();
    }
}

/**
 * Updates view state on filter change. Leaves alone
 * in quiz to not interrupt current quiz.
 */
function onFilterUpdate(checkbox) {
    if(gameState == GAME_STATES.VIEWING) {
        let checked = checkbox.checked;
        let value = checkbox.value;
        let name = checkbox.name;
        console.log("Checked:", checked, "Value:", value, "Name:", name);
        let filters = getFilters();
        if(checked) {
            // Added this filter, look for all that are valid with the new 
            // value in its section e.g. continent/tag AND also in already
            // applied filter of other section
            let additions = [];
            if(name == 'continents') {
                additions = locations.filter(location =>
                    location.continent == value && filters.tags.includes(location.tag)
                );
            } else if(name == 'tags'){
                additions = locations.filter(location =>
                    location.tag == value && filters.continents.includes(location.continent)
                );
            }
            locationSet.push(...additions);
            plotGivenArr(additions);
        } else {
            let toRemove = null;
            if(name == 'continents') {
                console.log("Removing continent:", value);
                toRemove = locationSet.filter(location => 
                    !filters.continents.includes(location.continent)
                );
                locationSet = locationSet.filter(location => 
                    filters.continents.includes(location.continent)
                );
                console.log("New location set:", locationSet);
            } else if(name == 'tags'){
                toRemove = locationSet.filter(location => 
                    !filters.tags.includes(location.tag)
                );
                locationSet = locationSet.filter(location => 
                    filters.tags.includes(location.tag)
                );
            }
            console.log("LocationSet:", locationSet);
            console.log("Removing:",toRemove);
            hideGivenArr(toRemove);
        }
    }
}

function plotLocations() {
    let areas = locationSet.filter(location => location.border != "");
    let points = locationSet.filter(location => location.border == "");
    console.log("Areas:", areas);
    console.log("Points: ", points);

    try {
        areas.forEach(area => area.display.addTo(map));
        points.forEach(point => point.display.addTo(map));
    } catch (error) {
        setMsg("Display error!", "Please check sheet format and let me know if issue continues");
        showMsgBox();
        process.exit(1);
    }
    
}

function plotGivenArr(arr) {
    if(!arr) return;
    arr.forEach(location => {
        location.display.addTo(map);
    });
}

function hideGivenArr(arr) {
    if(!arr) return;
    arr.forEach(location => {
        console.log("Location removed:", location);
        console.log("Display:", location.display);
        map.removeLayer(location.display);
    });
}

function refreshLocationSet() {
    hideVisibleLocations();
    let filters = getFilters();
    console.log("Game filters:", filters);
    locationSet = locations.filter(location => 
        filters.continents.includes(location.continent) && filters.tags.includes(location.tag)
    );
    plotLocations();
}

/**Displays current question to screen */
function showQuestion() {
    if (activeMarker) {map.removeLayer(activeMarker); activeMarker=null;}
    if(guessMarker) {map.removeLayer(guessMarker); guessMarker=null;}
    hideNextBtn();
    setMsg(`Find: ${locationSet[currentIndex].name}`, `${score}/${locationSet.length}`);
}

/**NExt button callback. Moves quiz forward to next question */
function nextQuestion() {
    currentIndex++;
    if (currentIndex < locationSet.length) {
        showQuestion();
    } else {
        setMsg(`Game Over! Final Score: ${score}/${locationSet.length}`);
        hideNextBtn();
        // map.off('click', onMapClick); // Disable map clicks
    }
}

function hideVisibleLocations() {
    if(!locationSet) return;
    locationSet.forEach(location => map.removeLayer(location.display));
}

function disableTooltips() {
    locationSet.forEach(location => {
        if(location.display.getTooltip()){
            location.display.unbindTooltip();
        }
    });
}

function enableTooltips() {
    locations.forEach(location => location.display.bindTooltip(location.name, {direction: 'top'}));
}

function flashTips() {
    locationSet.forEach(location => location.display.openTooltip());
}