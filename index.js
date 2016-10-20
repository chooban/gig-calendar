const _ = require('underscore'),
    moment = require('moment'),
    auth = require('./google-auth.js'),
    google = require('googleapis'),
    config = require('./config.json'),
    request = require('request-promise'),
    Bottleneck = require('bottleneck'),
    fs = require('fs'),
    limiter = new Bottleneck(1, 3000),
    SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret
});

spotifyApi.clientCredentialsGrant()
    .then((data) => {
        spotifyApi.setAccessToken(data.body['access_token']);
    })
    .then(getGigData)
    .catch((err) => {
        console.error(err);
    });

function getGigData() {
    auth.authorize()
        .then(listGigs)
        .then((allGigs) => (
          allGigs.reduce((acc, gig) => {
            if (acc[gig.artist]) {
              acc[gig.artist].gigs.push(gig);
            } else {
              acc[gig.artist] = {
                gigs: [gig]
              };
            }
            return acc;
          }, {})
        ))
        .then(writeGigsToFile)
        .catch((error) => {
            console.log("Could not authenticate")
            console.error(error);
        })
}

function listGigs(auth) {
    var calendar = google.calendar('v3'),
        gigs = {};

    return new Promise(function(resolve, reject) {
        calendar.events.list({
            auth: auth,
            calendarId: config.calendar,
            timeMin: '1997-01-01T23:59:00Z',
            timeMax: '2017-06-06T23:59:00Z',
            fields: "items(summary,start)"
        }, function(error, response) {
            if (error) {
                console.log("Error trying to retrieve gig list", err);
                return reject(error);
            }

            resolve(response.items.map(function(event) {
                return {
                    artist: event.summary,
                    date: moment(event.start.date || event.start.dateTime).format('YYYY-MM-DD')
                };
            }));
        });
    });
}

function writeGigsToFile(gigs) {
    fs.writeFileSync(
        "gig-data.json", JSON.stringify(gigs, null, 2), 'utf8', {
            'flags': 'w+'
        }
    )
}
