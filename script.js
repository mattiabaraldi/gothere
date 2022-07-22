const button1 = document.querySelector("#button1");
const label1 = document.querySelector("#label1");
const slider1 = document.querySelector("#slider1");

let localLatitude;
let localLongitude;
let targetLatitude;
let targetLongitude;
let alpha;
let beta;
let gamma;
let gyroReady = false;
let positionReady = false;
let targetReady = false;
// TOGLIERE STA MERDA
document.querySelector("#input1").value = localStorage.getItem("api-key") ?? "";

window.addEventListener("deviceorientation", function(e) 
    {
        alpha = 360 - e.alpha;
        beta = e.beta;
        gamma = e.gamma;
        gyroReady = true;
        document.querySelector("#label1").innerHTML = alpha + " " + beta + " " + gamma + " " + e.absolute;
    }, true);

// Chiedo posizione per inizializzare mappa
navigator.geolocation.getCurrentPosition(
    displayMap,  // Posizione trovata
    function(error) {console.log(error)}, // Posizione non trovata
    {enableHighAccuracy: false}
);

function displayMap(position)
{
    localLongitude = position.coords.longitude;
    localLatitude = position.coords.latitude;
    require(["esri/config","esri/Map", "esri/views/MapView", "esri/widgets/Search", 'esri/geometry/Extent'], function (esriConfig,Map, MapView, Search) {

        //esriConfig.apiKey = "";
        esriConfig.apiKey = localStorage.getItem("api-key");

        const map = new Map({
            basemap: "arcgis-navigation" // Basemap layer service
        });

        const view = new MapView({
            map: map,
            center: [localLongitude, localLatitude], // Longitude, latitude
            zoom: 13, // Zoom level
            container: "viewDiv", // Div element
            constraints: getConstraints(localLatitude, localLongitude),
            rotationEnabled: false // Disables map rotation
        });

        const search = new Search({  //Add Search widget
            view: view,
            maxSuggestions: 3
        });

        search.on("search-complete", function(e) {
            let latitude = e.results[0].results[0].feature.geometry.latitude;
            let longitude = e.results[0].results[0].feature.geometry.longitude;
            this.view.constraints = getConstraints(latitude, longitude);
            targetReady = true;
        });

        view.ui.add(search, "top-right"); //Add to the map
    });
}

function getConstraints(latitude, longitude)
{
    targetLatitude = latitude;
    targetLongitude = longitude;
    let latlongAllowance = 0.01;
    return {
            geometry:
            {
                type: "extent",
                xmin: longitude - latlongAllowance,
                ymin: latitude - latlongAllowance,
                xmax: longitude + latlongAllowance,
                ymax: latitude + latlongAllowance,
            },
            minScale: 50000, // User cannot zoom out beyond a scale of 1:500,000
            maxScale: 0, // User can overzoom tiles
        }
}

// Aggiorno posizione attuale
setInterval(function()
    {
        navigator.geolocation.getCurrentPosition(
            function(position) // Posizione trovata
            {
                localLongitude = position.coords.longitude;
                localLatitude = position.coords.latitude;
                positionReady = true;
            },
            function(error) // Posizione non trovata
            {
                console.log(error);
                positionReady = false;
            },
            {enableHighAccuracy: true}
        );
    }, 10000);

setInterval(function()
    {
        if(!positionReady)
            return;

        if(!targetReady)
            return;

        if(!gyroReady)
            return;

        angle = 360 * Math.tanh(Math.sqrt((localLatitude - targetLatitude)^2 + (localLongitude - targetLongitude)^2)) / (Math.PI * 2) - alpha;
        document.documentElement.style.setProperty("--angle", angle + "deg");

    }, 1000);

slider1.oninput = function()
{
    let angle = 360 * this.value / 100.0;
    label1.innerHTML = "Angle: " + angle + "deg";
    document.documentElement.style.setProperty("--angle", angle + "deg");
}

button1.addEventListener("click", clickButton1);
function clickButton1(event)
{
    localStorage.setItem("api-key", document.querySelector("#input1").value);
}