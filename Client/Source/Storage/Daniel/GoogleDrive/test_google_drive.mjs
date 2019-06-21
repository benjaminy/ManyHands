import google_drive from "./google_drive.mjs";

// NOTE: To run these tests, follow these steps:

// DO ONCE:
// - Create your application credentials here:
//   https://developers.google.com/drive/api/v3/enable-drive-api
//   OR try this streamlined option in step 1 of here:
//       https://developers.google.com/drive/api/v3/quickstart/nodejs
// - Save the resulting downloaded file as google_credentials.json in the
//   current directory
// - Run this file: it will prompt you to visit a web resource where you will
// generate an auth token.
// - Provide the auth token to stdin, and it will create google_token.json which
//   will work for future runs

// Once these steps are completed, these tests will run seamlessly each time the
// file is executed.

/* call init */
const storage = google_drive();

storage.upload(
    {
        body: 'this is the data',
        filename: 'root'
    }).then(
        fp => {
            console.log(`file id: ${fp.path}, uploaded at ${fp.timestamp} with etag ${fp.etag}`);
            storage.download(fp).then(
                data => {
                    console.log(`data: ${data}`); // TODO this should preferably be a buffer for when we deal with encrypted data
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
