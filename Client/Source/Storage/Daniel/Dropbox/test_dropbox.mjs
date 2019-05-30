import dropbox from "./dropbox.mjs";

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
