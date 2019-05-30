import dropbox from "./dropbox.mjs";

// TO RUN:

// Register a new app at the following link: https://www.dropbox.com/developers/apps
// When you have registered an app, click on Settings and find the OAuth2 row
// Under "Generate Access Token", click "Generate", and then copy the generated token
// The token provided must be inserted into a new file, 'access.token'

// Once these steps are completed, this file should sample an upload and download of a sample file.

/* call init */
const storage = dropbox();

storage.upload(
    {
        body: 'this is the data',
        filename: 'root'
    }).then(
        fp => {
            console.log(`file id: ${fp.path}, uploaded at ${fp.timestamp}`);
            storage.download(fp).then(
                data => {
                    console.log(`data: ${data.toString()}`);
                },
                err => {
                    console.log("An error occurred while downloading: " + err);
                }
            );
        },
        err => {
            console.log("An error occurred while uploading: " + err);
        }
    );
