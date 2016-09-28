var Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    readline = require('readline'),
    _ = require('underscore'),
    googleAuth = require('google-auth-library'),
    SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'],
    TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/',
    TOKEN_PATH = TOKEN_DIR + 'drive-nodejs-quickstart.json'

function readSecret(done) {
    return fs.readFileAsync('client-secret.json')
        .then(function(content) {
            return JSON.parse(content)
        })
        .catch(function(err) {
            console.log('Error loading client secret file: ' + err)
            throw err
        })
}

/**
 * Create an OAuth2 client with the given credentials.
 *
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials) {
    var clientSecret = credentials.installed.client_secret,
        clientId = credentials.installed.client_id,
        redirectUrl = credentials.installed.redirect_uris[0],
        auth = new googleAuth(),
        oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl)

    return fs.readFileAsync(TOKEN_PATH)
        .then(function(token) {
            oauth2Client.credentials = JSON.parse(token)
            return oauth2Client
        })
        .catch(function(err) {
            return getNewToken(oauth2Client)
        })
}


/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 */
function getNewToken(oauth2Client) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    })
    console.log('Authorize this app by visiting this url: ', authUrl)
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    return new Promise(function(resolve, reject) {
        rl.question('Enter the code from that page here: ', function(code) {
            rl.close()
            oauth2Client.getToken(code, function(err, token) {
                if (err) {
                    console.log('Error while trying to retrieve access token', err)
                    reject(err)
                }
                oauth2Client.credentials = token
                storeToken(token)
                resolve(oauth2Client)
            })
        })
    })
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') throw err
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token))
    console.log('Token stored to ' + TOKEN_PATH)
}

module.exports = {
    authorize: function() {
        return readSecret().then(authorize)
    }
}
