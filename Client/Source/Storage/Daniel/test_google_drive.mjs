import google_drive from "./google_drive.mjs";

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
                    console.log(`data: ${data}`);
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