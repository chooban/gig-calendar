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
    , mapResponse = _.partial(_.map, _, mapResponseEvent)

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
    var events =
      _.mapObject(
        _.groupBy(mapResponse(response.items), 'artist')
      , function(val, key) {
        return { gigs: val }
      })

    var promises = []
    _.each(Object.keys(events), function(artistName) {
      var options = {
          uri: 'http://developer.echonest.com/api/v4/artist/search'
        , method: 'GET'
        , qs: {
            api_key: config.echonestkey
          , name: artistName
          , format: 'json'
          }
        , json: true
        }
      , getGenres = _.partial(genresForArtist, artistName, _)

      promises.push(limiter.schedule(echonestRequest))

      function echonestRequest() {
        console.log("Getting artist data for", artistName)
        return request(options)
                .then(getGenres)
                .catch(function(err) {
                  console.log("Promise errored")
                  console.log(err)
                })
      }

      function genresForArtist(artistName, response) {
        var artistData = response.response.artists[0]
          , artistId = artistData.id
          , options = {
              uri: 'http://developer.echonest.com/api/v4/artist/genres'
            , method: 'GET'
            , qs: {
                api_key: config.echonestkey
              , id: artistId
              , format: 'json'
              }
            , json: true
            }

        console.log("Getting genre data for", artistName)

        if (artistName !== artistData.name) {
          events[artistData.name] = events[artistName]
          delete events[artistName]
          artistName = artistData.name
        }
        events[artistName].echonestId = artistId
        limiter.schedule(function() { return request(options).then(addGenresToArtist) })

        function addGenresToArtist(genresResponse) {
          events[genresResponse.response.name].genres = _.values(genresResponse.response.terms)
        }
      }
    })

    Q.allSettled(promises).then(function(data) {
      fs.writeFileSync("gig-data.json", JSON.stringify(events, null, 2), 'utf8')
    })
  })

  function mapResponseEvent(event) {
    return {
      artist: event.summary.trim()
    , date: moment(event.start.date || event.start.dateTime)
    }
  }

}
