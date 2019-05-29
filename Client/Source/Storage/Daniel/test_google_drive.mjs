import google_drive from "./google_drive.mjs";

/* call init */
let storage = google_drive();

storage.upload({body: 'this is the data', filename: 'root'});
