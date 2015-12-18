var _ = require('underscore')
  , moment = require('moment')
  , auth = require('./google-auth.js')
  , google = require('googleapis')
  , config = require('./config.json')

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
    var events = _.sortBy(mapResponse(response.items), _.property('date'))
    console.log(_.groupBy(events, 'artist'))
  })

  function mapResponseEvent(event) {
    return {
      artist: event.summary.trim()
    , date: moment(event.start.date || event.start.dateTime)
    }
  }

}
