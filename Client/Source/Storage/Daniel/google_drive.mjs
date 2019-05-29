/* Top Matter */

import fs from "fs";
import readline from "readline";
import googleapis from 'googleapis';

const {google} = googleapis;
/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * ---
 *
 * Parts of this file originated from sample code originally written by
 * Google Inc., modified and adapted by Daniel Barnes for the purposes of
 * this project. The licence has been included here in order to comply
 * with its terms.
 */

function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_API_SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * NOTE: file_ptr has been removed, and instead will be returned by this function
 * assuming the promise is fulfilled.
 *
 * This file will throw an exception (the promise will fail) when something goes wrong, so we don't
 * have to deal with the status codes and checking against R_OK.
 *
 * This is not consistent with the rest of the codebase, but I would like this to be the standard.
 *
 * @param auth OAuth2 object given via authentication with Google's servers
 * @param options_u JavaScript object with request information. Must include {body, filename}
 * @returns {Promise<void>}
 */
async function uploadGoogleDrive( auth, options_u )
{
    const drive = google.drive({version: 'v3', auth});

    const file_metadata = {
        mimeType: 'application/octet-stream',
        name: options_u.filename // TODO if you change the root, will it still have the same id?
        // solution: provide the fp when you're updating the root file.
    };
    const media = {
        mimeType: 'application/octet-stream',
        body: options_u.body
    };

    return await drive.files.create({
            resource: file_metadata,
            media: media,
            fields: 'id'
        },
        {}).id;
    /*
    , function (err, file) {
        if (err) {
            throw Error("Some error occurred while uploading this file: " + err);
        } else {
            return {path: file.id}; // this is our file pointer! -- TODO: return ETag, timestamp
        }
    });
    */
}

/**
 * Given a particular file pointer, download the file and return its contents
 *
 * @param auth
 * @param file_ptr
 * @returns {Promise<void>}
 */
async function downloadGoogleDrive( auth, file_ptr )
{

    const drive = google.drive({version: 'v3', auth});

    drive.files.get({fileId: file_ptr.path, alt: 'media'}, {responseType: 'stream'},
        function(err, res){
            res.data
                .on('end', () => {
                    console.log('Done');
                })
                .on('error', err => {
                    console.log('Error', err);
                })
                .pipe(dest);
        }
    );
}

const GOOGLE_API_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const TOKEN_PATH = 'google_token.json';
const CREDENTIAL_PATH = 'google_credentials.json';

export default function init( )
{
    let credentials;

    try {
        credentials = JSON.parse(fs.readFileSync(CREDENTIAL_PATH)); // TODO no sync reading
    } catch(e){
        console.log('Error loading client secret file:', err);
    }

    const mstorage = {};
    mstorage.upload   = ( ...ps ) => authorize( credentials, (auth) =>   uploadGoogleDrive(auth, ...ps) );
    mstorage.download = ( ...ps ) => authorize( credentials, (auth) => downloadGoogleDrive(auth, ...ps) );

    mstorage.fpFromPlainData = async function fpFromPlainData( fp )
    {
        return { path: fp.path }; // TODO we would like the fp to have information about which service.
        // the fp returned from upload works across any person's google drive, but doesn't distinguish itself from
        // other services
    };

    mstorage.fpToPlainData = async function fpToPlainData( fp )
    {
        return { path: fp.path };
    };

    return mstorage;
}
