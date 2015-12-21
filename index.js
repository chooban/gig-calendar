var _ = require('underscore')
  , moment = require('moment')
  , auth = require('./google-auth.js')
  , google = require('googleapis')
  , config = require('./config.json')
  , request = require('request-promise')
  , Bottleneck = require('bottleneck')
  , fs = require('fs')
  , limiter = new Bottleneck(1, 3000)
  , Q = require('q')

auth.authorize(listGigs)

function listGigs(auth) {
  var calendar = google.calendar('v3')
    , gigs = {}

  calendar.events.list({
    auth: auth
  , calendarId: config.calendar
  , timeMin: '1997-01-01T23:59:00Z'
  , timeMax: '2015-12-31T23:59:00Z'
  , fields: "items(summary,start)"
  }, function(err, response) {
    if (err) {
      console.log("Error trying to retrieve gig list", err)
      return
    }
    var events = response.items
      , promises = []
      , artists = _.uniq(_.map(events, _.property('summary')))
      , i = 0

    _.each(artists, function(artistName) {
      var options = {
          uri: 'http://developer.echonest.com/api/v4/artist/search'
        , method: 'GET'
        , qs: {
            api_key: config.echonestkey
          , name: artistName
          , bucket: 'genre'
          , format: 'json'
          }
        , json: true
        }

      promises.push(limiter.schedule(echonestRequest))

      function echonestRequest() {
        console.log("Getting artist data for", artistName)
        return request(options)
                .then(mapEchonestResponse)
                .catch(function(err) {
                  console.log("Promise errored")
                  console.log(err)
                })
      }

      function mapEchonestResponse(response) {
        var artistData = response.response.artists[0]
          , artistId = artistData.id

        gigs[artistName] = {
          echonestId: artistId
        , genres: _.map(artistData.genres, _.property('name'))
        , gigs: _.map(_.where(events, { summary: artistName }), toGig)
        }

        function toGig(event) {
          return {
            date: moment(event.start.date || event.start.dateTime)
          }
        }
      }

    })

    Q.allSettled(promises).then(writeGigsToFile)

    function writeGigsToFile() {
      fs.writeFileSync(
        "gig-data.json"
      , JSON.stringify(gigs, null, 2)
      , 'utf8'
      , {'flags': 'w+'}
      )
    }
  })
}
