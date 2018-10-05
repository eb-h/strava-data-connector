var oauth = {};

/** @const */
oauth.OAUTH_CLIENT_ID = 'xxxxx';

/** @const */
oauth.OAUTH_CLIENT_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/**
* This builds an OAuth2 service for connecting to Spotify
* https://developers.strava.com/docs/authentication/
*
* @return {OAuth2Service}
*/
function getOAuthService() {
  // This is where we pull out the "client id" and "client secret" from the
  // Script Properties.
  var scriptProps = PropertiesService.getScriptProperties();
  var clientId = scriptProps.getProperty(oauth.OAUTH_CLIENT_ID);
  var clientSecret = scriptProps.getProperty(oauth.OAUTH_CLIENT_SECRET);
  return OAuth2.createService('strava')
  .setAuthorizationBaseUrl('https://www.strava.com/oauth/authorize')
  .setTokenUrl('https://www.strava.com/oauth/token')
  .setClientId(oauth.OAUTH_CLIENT_ID)
  .setClientSecret(oauth.OAUTH_CLIENT_SECRET)
  .setPropertyStore(PropertiesService.getUserProperties())
  .setScope('view_private')
  .setCallbackFunction('authCallback');
}

/**
* The callback that is invoked after a successful or failed authentication
* attempt.
*
* @param {object} request
* @return {OAuth2Service}
*/
function authCallback(request) {
  console.log(request);
  var authorized = getOAuthService().handleCallback(request);
  if (authorized) {
    console.log('successfully authorised');
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    console.log('unable to authorise');
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

/**
* @return {boolean} `true` if the user has successfully authenticated and false
* otherwise.
*/
function isAuthValid() {
  var service = getOAuthService();
  if (service == null) {
    return false;
  }
  return service.hasAccess();
}

/**
* Resets the OAuth2 service. This will allow the user to reauthenticate with
* the external OAuth2 provider.
*/
function resetAuth() {
  var service = getOAuthService();
  service.reset();
}

/**
* Used as a part of the OAuth2 flow.
*
* @return {string} The authorization url if service is defined.
*/
function get3PAuthorizationUrls() {
  var service = getOAuthService();
  if (service == null) {
    return '';
  }
  return service.getAuthorizationUrl();
}

// Just let data studio connector 
function getAuthType() {
  Logger.log('got auth type')
  return { type: "OAUTH2" };
}

function getData(request) {
  Logger.log('tried to get data')
}

function isAdminUser() {
  return true; // I am the admin and I am the only user I guess
}

function getConfig() {
  // may modify to receive user details if required
  return {
    dateRangeRequired: true
  };
}

function getSchema() {
  return {
    schema: [
      {
        name: 'run_name',
        label: 'Run Name',
        dataType: 'STRING',
        semantics: {
          conceptType: 'DIMENSION',
          isReaggregatable: true
        }
      },
      {
        name: 'distance',
        label: 'Distance',
        description: 'The distance travelled in metres.',
        dataType: 'NUMBER',
        semantics: {
          conceptType: 'METRIC',
          semanticType: 'NUMBER',
          semanticGroup: 'NUMERIC',
          isReaggregatable: true
        }
      },
      {
        name: 'start_date',
        label: 'Start Date',
        description: 'Date time when activity started',
        dataType: 'STRING',
        semantics: {
          conceptType: 'DIMENSION',
          semanticType: 'YEAR_MONTH_DAY',
          semanticGroup: 'DATETIME',
          isReaggregatable: true
        }
      }
    ]
  }
}

function getData(request) {
  var headers = {
    Authorization: 'Bearer ' + getOAuthService().getAccessToken()
  }
  
  var url = 'https://www.strava.com/api/v3/athlete/activities?'
  
  var rows = [];
  var fetchNext = true;
  var response = UrlFetchApp.fetch(url, { headers: headers });
  response = JSON.parse(response);
  Logger.log(response.length); // 'RESPONSE SIZE', 
  
  // Prepare the schema for the fields requested.
  var dataSchema = [];
  var fixedSchema = getSchema().schema;
  request.fields.forEach(function(field) {
    for (var i = 0; i < fixedSchema.length; i++) {
      if (fixedSchema[i].name == field.name) {
        dataSchema.push(fixedSchema[i]);
        break;
      }
    }
  });
  
  // only respond with requested values
  response.forEach(function(v) {
    var row = []
    dataSchema.forEach(function(field) {
      switch (field.name) {
        case 'run_name':
          row.push(v['name']);
          break;
        case 'distance':
          row.push(v['distance']);
          break;
        case 'start_date':
          row.push(v['start_date']);
          break;
      }
    });
    rows.push({values: row});
  });
  
  const result = {
    schema: dataSchema,
    rows: rows
  };
  Logger.log(result);
  return result;
}
