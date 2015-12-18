var _ = require('underscore')
  , moment = require('moment')
  , auth = require('./google-auth.js')
  , google = require('googleapis')
  , config = require('./config.json')
  , request = require('request-promise')
  , Bottleneck = require('bottleneck')
  , limiter = new Bottleneck(1, 3000)
  , Q = require('q')

auth.authorize(listGigs)

function listGigs(auth) {
  var calendar = google.calendar('v3')
    , mapResponse = _.partial(_.map, _, mapResponseEvent)

  calendar.events.list({
    auth: auth
  , calendarId: config.calendar
  , timeMin: '2001-01-01T23:59:00Z'
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
          }
        }

      promises.push(limiter.schedule(echoNestRequest))

      function echoNestRequest() {
        console.log("Scheduling")
        return request(options).then(function(data) {
          console.log(data)
        }).catch(function(err) {
          console.log("Promise errored")
          console.log(err)
        })
      }
    })

    Q.allSettled(promises).then(function(data) {
      _.each(events, function(e) {
        //console.log(e)
      })
    })
  })

  function mapResponseEvent(event) {
    return {
      artist: event.summary.trim()
    , date: moment(event.start.date || event.start.dateTime)
    }
  }

}
