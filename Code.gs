var oauth = {};

/** @const */
oauth.OAUTH_CLIENT_ID = 'xxxxx';

/** @const */
oauth.OAUTH_CLIENT_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/**
* This builds an OAuth2 service for connecting to Strava
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
  var authorized = getOAuthService().handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Successfully logged in to Strava');
  } else {
    return HtmlService.createHtmlOutput('Login denied by Strava. You may have entered the incorrect account information');
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

function getAuthType() {
  return { type: "OAUTH2" };
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
          semanticType: 'TEXT',
          dataType: 'STRING',
          defaultAggregationType: 'NONE',
          isReaggregatable: true
        }
      },
      {
        name: 'distance',
        label: 'Distance (m)',
        description: 'The distance travelled in metres.',
        dataType: 'NUMBER',
        semantics: {
          conceptType: 'METRIC',
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
  // YYYY-MM-DD to epoch https://developers.google.com/datastudio/connector/date-range
  var after  = new Date(request.dateRange.startDate).getTime() / 1000 
  var before = new Date(request.dateRange.endDate  ).getTime() / 1000 
  
  var url = 'https://www.strava.com/api/v3/athlete/activities?before=' + before + '&after=' + after
  
  var rows = [];
  var fetchNext = true;
  var response = UrlFetchApp.fetch(url, { headers: headers });
  response = JSON.parse(response);
  
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
      default:
        values.push('');
      }
    });
    rows.push({values: row});
  });
  
  const result = {
    schema: dataSchema,
    rows: rows
  };
  return result;
}