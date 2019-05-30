/* Top Matter */

import fs from "fs";
import readline from "readline";
import googleapis from 'googleapis';
// TODO the googleapis package is not yet in the package.json
const {google} = googleapis;

async function authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    let token;
    try {
        token = fs.readFileSync(TOKEN_PATH);
    } catch (e) {
        return await getAccessToken(oAuth2Client);
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    return oAuth2Client;
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 */
async function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_API_SCOPES,
    });
    const code = await tokenPrompt(authUrl);
    const resp = await oAuth2Client.getToken(code);
    const token = resp.tokens;
    return new Promise(function(resolve, reject)
    {
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return reject(err);
            console.log('Token stored to', TOKEN_PATH);
        });
        return resolve(oAuth2Client);
    });
}

async function tokenPrompt(authUrl){
    return new Promise(function(resolve, reject) {
        console.log('Authorize this app by visiting this url:', authUrl);
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question('Enter the code from that page here: ', code => {
            resolve(code);
            rl.close();
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
 * @returns
 */
async function uploadGoogleDrive( auth, options_u )
{
    const authClient = await auth;
    const drive = google.drive({version: 'v2', auth: authClient});
    const file_metadata = {
        mimeType: 'application/octet-stream',
        title: options_u.filename // TODO if you change the root, will it still have the same id?
        // solution: provide the fp when you're updating the root file.
    };
    const media = {
        mimeType: 'application/octet-stream',
        body: options_u.body
    };

    const file_obj = await drive.files.insert({ // .create in v3
            resource: file_metadata,
            media: media,
            fields: '*'
        });

    return {
        path: file_obj.data.id,
        etag: file_obj.data.etag,
        timestamp: file_obj.data.modifiedDate
    };
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
    const authClient = await auth;
    const drive = google.drive({version: 'v2', auth: authClient});

    let data = "";

    return new Promise((success, error) => {
        drive.files.get({fileId: file_ptr.path, alt: 'media'}, {responseType: 'stream'},
            function(err, res){
                res.data
                    .on('data', (chunk) => {
                        data += chunk
                    })
                    .on('end', () => {
                        success(data);
                    })
                    .on('error', err => {
                        error(err);
                    });
            }
        );
    });
}

const GOOGLE_API_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const TOKEN_PATH = 'google_token.json';
const CREDENTIAL_PATH = 'google_credentials.json';

export default function init( )
{
    let credentials;

    try {
        credentials = JSON.parse(fs.readFileSync(CREDENTIAL_PATH)); // TODO no sync reading
    } catch(err){
        console.log('Error loading client secret file:', err);
    }

    const mstorage = {};
    mstorage.upload   = async ( ...ps ) =>   uploadGoogleDrive(authorize(credentials), ...ps);
    mstorage.download = async ( ...ps ) => downloadGoogleDrive(authorize(credentials), ...ps);

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
