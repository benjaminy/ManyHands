// A class implementing cloudStorage interface. ClientId is provided for
// the app by Google
var GoogleDrive = function (clientId) {
    this.clientId = clientId;
    this.accessToken = null; // access token will be provided by authenticate
    CloudStorage.call(this);

    // A function used to escape characters for json strings when used in body of
    // a request
    function escapeSpecialChars(string) {
        return string.replace(/\\n/g, "\\n")
            .replace(/\\'/g, "\\'")
            .replace(/\\"/g, '\\"')
            .replace(/\\&/g, "\\&")
            .replace(/\\r/g, "\\r")
            .replace(/\\t/g, "\\t")
            .replace(/\\b/g, "\\b")
            .replace(/\\f/g, "\\f");
    }

    // This function creates a file with a given name in the appDataFolder
    // Returned is a promise object for when the upload is finished
    this.createFile = function(name) {
        var boundary = name+"_boundary";
        var requestBody = '--'+boundary+'\n' +
            'Content-Type: application/json; charset=UTF-8\n' +
            '\n' +
            '{\n' +
            '"name": "'+name+'",\n' +
            '"parents": [ "appDataFolder"]\n' +
            '}\n' +
            '\n' +
            '--'+boundary+'\n' +
            "Content-Type: text/plain\n" +
            "--"+boundary+"--";
        var request = gapi.client.request({
            'path': '/upload/drive/v3/files?uploadType=multipart',
            'method': 'POST',
            'headers': {
                'Content-Type': 'multipart/related; boundary='+boundary
            },
            'body': requestBody});
        return new Promise(function (resolve, reject) {
            return request.then(resolve, reject);
        });
    };

    // this function find the file with a given name in the appDataFolder
    // returns a promise with the id of the file. If the file doesn't exist
    // promise will reject.
    var findFileId = function(name) {
        var request = gapi.client.request({
            'path': '/drive/v3/files',
            'method': 'GET',
            'params': {
                'corpus': 'user',
                'pageSize': 1,
                'spaces': 'appDataFolder',
                'fields': 'files',
                // TODO: ask Ben if this escape is necessary
                'q': 'name="'+escapeSpecialChars(name)+'"'
            }
        });

        return request.then(function(resp) {
            var files = resp.result.files;
            if (files && files.length > 0) {
                return Promise.resolve(files[0].id);
            } else
                return Promise.reject("File not found");
        });
    };

    // this function places "newContents" in the file with the given id
    // returned is a promise file
    this.updateFileContents = function (id, newContents) {
        var request = gapi.client.request({
            'path': '/upload/drive/v2/files/'+id,
            'method': 'PUT',
            'params': {
                'uploadType': 'media'
            },
            'body': newContents
        });
    };

    // returns a promise file with contents of a file with a given id
    this.getFileContentsById = function (id) {
        return gapi.client.request({
            'path': '/drive/v2/files/' + id + '?alt=media',
            'method': 'GET'
        }).then(function(result) {
            if (result.status == 200)
                return Promise.resolve(result.body);
            else
                return Promise.reject(result);
        });
    };

    // authentication requires access token which can be received from the
    // Google login page
    this.authenticate = function(accessToken) {
        this.accessToken = accessToken;
    };

    this.downloadFile = function(downloadPath) {
        return findFileId(downloadPath).then(function(id) {
            return getFileContentsById(id);
        });
    };

    this.uploadFile = function(fileContents, filePath) {
        return this.findFileId(filePath).then(function (id) {
            // file exists
            return this.updateFileContents(id, fileContents);
        }, function () {
            // file does not exist, so create it first
            return this.createFile(filePath).then(function(){
                return uploadFile(fileContents, filePath);
            })
        });
    };

    this.shareFile = function (sharedFilePath) {

    };
};
GoogleDrive.prototype = CloudStorage.prototype;

GoogleDrive.retrieveSharedFile = function(fileUrl) {

};

GoogleDrive.sharedDataAccessType = BytableString;
cloudStorages['GDrive'] = GoogleDrive;