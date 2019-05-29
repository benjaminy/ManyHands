# Cloud Providers

In order to accomplish decentralization, the goal is that each user will have some sort of server where their tree of data is stored. The tree will be completely public, but, for the most part, encrypted.

It is not reasonable to expect each user to spin up and configure a VPS or some other cloud server, since our goal is to make our service as accessible and easy to set up as its unencrypted/centralized counterpart.

In order to accomplish this, interfacing with existing and well-known cloud services is paramount. There are several requirements we expect of our cloud services, and this document intends to detail the abilities and shortcomings of these cloud services to fit our requirements.

## Requirements

 - Authenticated upload of files
 - Public (unauthenticated) download and traversal of files
 - Server timestamping of uploaded files
 - Conditional requests/headers (ETag, `If-Match` and  `If-None-Match`)

## Cloud Providers

Follows is a list of cloud providers and some information about accomplishing these requirements through their particular APIs.

### Google Drive

 - [x] Authenticated upload of files

The initial setup is a little bit frustrating, but not impossible. The user must complete several steps to authenticate at first, but then their application should work for the future.

The user must first visit [the Google API Console](https://console.developers.google.com/), where they must create a new project. It should be noted that the user may only have 12 projects at a time before they may request an increase. 

The [Google Drive API](https://console.developers.google.com/apis/library/drive.googleapis.com) must then be enabled. You must then generate the credentials (selecting "Web server" for the source of the requests, and "Application data" for what data will be accessed, and "No" to Google's App Engine). A `json` file will be downloaded, which has credentials that can be used to log into the application.

All of these previous steps may be done in one step by clicking on the "Enable the Drive API" button on [this page](https://developers.google.com/drive/api/v3/quickstart/nodejs).

After this is completed, the user must, one last time, authorize that they are allowing this application to work in order to gain an authorization token. This may be generated on the first run of the program.

 - [x] Public (unauthenticated) download and traversal of files

From the Google API `authorizing` [guide](https://developers.google.com/sheets/api/guides/authorizing):

 > If the request doesn't require authorization (such as a request for public data), then the application must provide either the API key or an OAuth 2.0 token, or both—whatever option is most convenient for you.

This means every user must have an API key of some sort in order to have a user on their team using Google Drive for storage.

One unintuitive step we have to take is using each file pointer by its opaque id, as **files may not be accessed by their name**. The file pointer is a universal ID which may point to a file owned by anybody, and as long as the file permissions are set correctly, you may download it (and thus follow the pointers inside).

 - [x] Server timestamping of uploaded files
 - [x] Conditional requests/headers (ETag, `If-Match` and  `If-None-Match`)

### Dropbox

