
import fs from 'fs';
import fetch from 'isomorphic-fetch';
import Dropbox from 'dropbox';

async function uploadDropbox( token, options_u ){
    const client = new Dropbox.Dropbox({ accessToken: token, fetch: fetch });

    return new Promise((success, failure) => {
        client.filesUpload({ path: '/' + options_u.filename, contents: options_u.body }
        ).then( data => {
            success({
                path: data.id,
                timestamp: data.server_modified
            });
        }, err => {
            failure(err);
        });
    });
}

async function downloadDropbox( token, file_ptr )
{
    const client = new Dropbox.Dropbox({ accessToken: token, fetch: fetch });

    return new Promise((success, failure) => {
        client.filesDownload(
            { path: file_ptr.path }
        ).then(data => {
            // returns a buffer
            success(data.fileBinary);
        }, err => {
            failure(err);
        });
    });
}

const CREDENTIAL_PATH = 'access.token';

export default function init( )
{
    let token;

    try {
        token = fs.readFileSync(CREDENTIAL_PATH).toString('ascii').replace(/[^a-zA-Z0-9_]/g, '');
    } catch(err){
        console.log('Error loading client token file:', err);
        return;
    }

    const mstorage = {};
    mstorage.upload   = async ( ...ps ) =>   uploadDropbox(token, ...ps);
    mstorage.download = async ( ...ps ) => downloadDropbox(token, ...ps);

    mstorage.fpFromPlainData = async function fpFromPlainData( fp )
    {
        return { path: fp.path };
    };

    mstorage.fpToPlainData = async function fpToPlainData( fp )
    {
        return { path: fp.path };
    };

    return mstorage;
}
