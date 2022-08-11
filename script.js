const button1 = document.querySelector("#button1");
const mainText = document.querySelector("#main-text");
const addressText = document.querySelector("#address-text");
const slider1 = document.querySelector("#slider1");
const arrowContainer = document.querySelector("#arrow-container");
const mainArrow = document.querySelector("#main-arrow");
const mapContainer = document.querySelector("#map-container");
const mapView = document.querySelector("#view-div");
const gothereButton = document.querySelector('#gothere-button');
const dashboardContainer = document.querySelector("#dashboard-container");

const updateInterval = 500;
const updatePositionInterval = 1000;

let localLatitude;
let localLongitude;
let targetLatitude;
let targetLongitude;
let currentAngle = 0;
let targetAngle = 0;
let dashAngle = 0;
let alpha;
let beta;
let gamma;
let position;
let distance = 0;
let distanceUnit = "km";
let highAccuracy = false;
let speed = 0;
let gyroReady = false;
let positionReady = false;
let targetReady = false;
let mapReady = false;
let apiReady = false;
let currentActiveObject = mapView;

// TOGLIERE STA MERDA
//document.querySelector("#input1").value = localStorage.getItem("api-key") ?? "";

// Attivo sensore orientamento dispositivo
const sensor = new AbsoluteOrientationSensor();
Promise.all([navigator.permissions.query({ name: "accelerometer" }),
             navigator.permissions.query({ name: "magnetometer" }),
             navigator.permissions.query({ name: "gyroscope" })])
       .then(results => {
         if (results.every(result => result.state === "granted")) {
           sensor.start();
           console.log("Permessi presenti");
         } else {
           console.log("No permissions to use AbsoluteOrientationSensor.");
         }
   });

dashboardContainer.addEventListener('click', function(e)
   {
        dashAngle = (dashAngle - 90) % 360;
        document.documentElement.style.setProperty("--dash-angle", dashAngle + "deg");
   });

// Routine di aggiornamento orientamento
window.addEventListener("deviceorientationabsolute", function(e) 
    {
        alpha = 360 - e.alpha;
        beta = e.beta;
        gamma = e.gamma;
        gyroReady = true;
    }, true);

// Recupero chiave mappa
const url = `/secrets/api.txt`;
let APIKey;
fetch(url)
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    return response.text();
  })
  .then((text) => {
    APIKey = text;
    apiReady = true;
    checkDisplayMap();
  })
  .catch((error) => console.log(error));

// Chiedo posizione per inizializzare mappa
navigator.geolocation.getCurrentPosition(
    (pos) => {
        position = pos;
        mapReady = true;
        checkDisplayMap();
    },  // Posizione trovata
    (error) => {console.log(error)}, // Posizione non trovata
    {enableHighAccuracy: false}
);

function checkDisplayMap()
{
    if(mapReady && apiReady)
        displayMap()
}

function displayMap()
{
    localLongitude = position.coords.longitude;
    localLatitude = position.coords.latitude;
    require(["esri/config","esri/Map", "esri/views/MapView", "esri/widgets/Search", 'esri/geometry/Extent'], function (esriConfig,Map, MapView, Search) {

        //esriConfig.apiKey = "";
        esriConfig.apiKey = APIKey;

        const map = new Map({
            basemap: "arcgis-navigation" // Basemap layer service
        });

        const view = new MapView({
            map: map,
            center: [localLongitude, localLatitude], // Longitude, latitude
            zoom: 14, // Zoom level
            container: "view-div", // Div element
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
            addressText.innerHTML = e.searchTerm;
            this.view.constraints = getConstraints(latitude, longitude);
            targetReady = true;
        });

        view.ui.add(search, "top-right"); //Add to the map
    });
    document.querySelector("#map-container").classList.add('opaque');
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
            minScale: 30000, // User cannot zoom out beyond a scale of 1:500,000
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
                Speed.get(localLongitude, localLatitude, updatePositionInterval);
                positionReady = true;
            },
            function(error) // Posizione non trovata
            {
                console.log(error);
                positionReady = false;
            },
            {enableHighAccuracy: highAccuracy}
        );
    }, updatePositionInterval);

// Update grafica
setInterval(function()
    {
        if(!positionReady)
            return;

        if(!targetReady)
            return;

        if(!gyroReady)
            return;
        
        currentAngle = targetAngle;

        if(targetLatitude != localLatitude)
            targetAngle = 90 -  Math.atan2((targetLatitude - localLatitude), (targetLongitude - localLongitude)) * (180 / Math.PI) - alpha;
        else
            targetAngle = 0;

        let delta = ((((targetAngle - currentAngle) % 360) + 540) % 360) - 180;
        targetAngle = currentAngle + delta;

        document.documentElement.style.setProperty("--angle", targetAngle + "deg");
        Distance.get();
        document.querySelector("#distance").innerHTML = distance + distanceUnit;
        document.querySelector("#speed").innerHTML = speed + "km/h";

    }, updateInterval);

function transitionToArrow()
{
    arrowContainer.classList.toggle('transition');
}

gothereButton.addEventListener("click", function(e)
{
    if(targetReady)
    {
        mapContainer.classList.toggle('opaque');
        arrowContainer.classList.toggle('opaque');
        dashboardContainer.classList.toggle('opaque');
        mapContainer.classList.toggle('transparent');
        arrowContainer.classList.toggle('transparent');
        dashboardContainer.classList.toggle('transparent');
    }
});

class Speed {
    
    static latlongCoeff = 111.32 * 3600; // km in 1 grado latlong * secondi in un'ora * millisecondi in un secondo
    static lastX = null;
    static lastY = null;
    static lastSpeed = 0;
    static cooldownFilter = 3;
    static totalDeltaT;

    constructor() {}

    static get(newX, newY, dt) { 
        if(this.lastX != null)
        {
            if((speed == 0) || ((this.lastX != newX) || (this.lastY != newY)))
            {
                this.cyclesNumber = 1;
                //dt /= 1000.0;
                //dt *= this.cyclesNumber;
                let diffXSquared = (this.lastX - newX)**2;
                let diffYSquared = (this.lastY - newY)**2;
                let tempSquaredDistance = diffXSquared + diffYSquared;
                let tempDistance = Math.sqrt(tempSquaredDistance);
                let newSpeed = Math.floor(this.latlongCoeff * tempDistance / this.totalDeltaT);

                this.lastX = newX;
                this.lastY = newY;

                speed = newSpeed;
            }
            else
            {
                this.totalDeltaT += dt / 1000.0;
            }

            /*if(newSpeed > 0) {
                if(this.countdownFilter == 0) {
                    speed = newSpeed;
                    debugger;
                } else if(this.countdownFilter > 0) {
                    this.countdownFilter--;
                    debugger;
                }
            } else {
                speed = 0;
                this.countdownFilter = 3;
            }*/

            /*let acceleration = (newSpeed - this.lastSpeed) / dt;
            if(acceleration > 10 || ((speed == 0) && (0 < newSpeed < 10)))
            {
                this.lastSpeed = Math.floor((4 * this.lastSpeed + newSpeed) / 5);
            }
            else
            {
                this.lastSpeed = newSpeed;
                speed = newSpeed;
            }*/
        }
        else
        {
            this.lastX = newX;
            this.lastY = newY;
        }
    }

    static setPosition(X, Y) {
        this.lastX = X;
        this.lastY = Y;
    }
}

class Distance {

    constructor() {}

    static get() {

        //SOURCE: https://www.movable-type.co.uk/scripts/latlong.html
        const piCoeff = Math.PI/180;
        const R = 6371e3; // metres
        const φ1 = localLatitude * piCoeff; // φ, λ in radians
        const φ2 = targetLatitude * piCoeff;
        const Δφ = (targetLatitude-localLatitude) * piCoeff;
        const Δλ = (targetLongitude-localLongitude) * piCoeff;

        const a =   Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        let d = R * c; // in metres
        
        if(d >= 1000)
        {
            highAccuracy = false;
            distanceUnit = "km";
            d /= 1000.0;
            if(d >= 100)
                d = Math.floor(d);
            else if(d >= 10)
                d = d.toFixed(1);
            else
                d = d.toFixed(2);
        }
        else
        {
            highAccuracy = true;
            distanceUnit = "m";
            d = Math.floor(d);
        }
        
        distance = d;
    }

}
