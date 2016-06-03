// TODO: remove throws from promises

// A class implementing the cloudStorage interface. Appkey is the key
// provided for many_hands by dropbox.
var Dropbox = function(appkey) {
    this.appkey = appkey;
    this.accessToken = null; // access token will be provided by authenticate
    CloudStorage.call(this);

    // authentication requires access token which can be received from the
    // DropBox login page
    this.authenticate = function(accessToken) {
        this.accessToken = accessToken;
    };

    this.removeFile = function(filePath) {
        // Wrapper is used to pass the access token down to the promise
        function wrapper(accessToken) {
            // Promisifying the XMLHttpRequest
            return new Promise(function (resolve, reject) {
                var httpRequest = new XMLHttpRequest();
                var onUploaded = function () {
                    if (httpRequest.status == 200) {
                        resolve(httpRequest);
                    } else {
                        reject(httpRequest.status);
                    }
                };
                httpRequest.addEventListener("load", onUploaded, false);

                httpRequest.open("POST", "https://api.dropboxapi.com/1/fileops/delete?"+
                    "root=auto&path="+encodeURIComponent(filePath), true);
                httpRequest.setRequestHeader("Authorization", " Bearer " + accessToken);
                httpRequest.send();
            });
        }
        return wrapper(this.accessToken);
    };

    this.downloadFile = function(downloadUrl) {
        // Wrapper is used to pass the access token down to the promise
        function wrapper(accessToken) {
            // Promisifying the XMLHttpRequest
            return new Promise(function (resolve, reject) {
                var httpRequest = new XMLHttpRequest();
                var onDownloaded = function () {
                    if (httpRequest.status == 200) {
                        resolve(encode(httpRequest.responseText));
                    } else {
                        reject();
                    }
                };

                httpRequest.addEventListener('load', onDownloaded, false);
                httpRequest.open("GET", "https://content.dropboxapi.com/1/files/auto/"+downloadUrl, true);
                httpRequest.setRequestHeader("Authorization", " Bearer " + accessToken);
                httpRequest.send(null);
            });
        }
        return wrapper(this.accessToken);
    };

    this.uploadFile = function(fileContents, fileUrl) {
        // Wrapper is used to pass the access token down to the promise
        function wrapper(accessToken) {
            // Promisifying the XMLHttpRequest
            return new Promise(function (resolve, reject) {
                var httpRequest = new XMLHttpRequest();
                var onUploaded = function () {
                    if (httpRequest.status == 200) {
                        resolve(httpRequest);
                    } else {
                        reject(httpRequest.status);
                    }
                };
                httpRequest.addEventListener("load", onUploaded, false);

                httpRequest.open("POST", "https://content.dropboxapi.com/1/files_put/auto/" + fileUrl + "?overwrite=true", true);
                httpRequest.setRequestHeader("Authorization", " Bearer " + accessToken);
                httpRequest.send(decode(fileContents));
            });
        }
        return wrapper(this.accessToken);
    };

    this.shareFile = function (sharedFileUrl) {
        // Wrapper is used to pass the access token down to the promise
        function wrapper(accessToken) {
            return new Promise(function (resolve, reject) {
                var httpRequest = new XMLHttpRequest();

                var onShared = function () {
                    if (httpRequest.status == 200) {
                        var response = JSON.parse(this.responseText);
                        var linkToResource = response.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
                        linkToResource = new BytableString(linkToResource); // we need a Bytable object
                        resolve(new SharedFile(Dropbox, linkToResource, sharedFileUrl));
                    } else {
                        reject("Upload unsuccessful");
                    }
                };
                httpRequest.addEventListener('load', onShared, false);

                httpRequest.open("POST", "https://api.dropbox.com/1/shares/auto/" + sharedFileUrl + "?short_url=false", true);
                httpRequest.setRequestHeader("Authorization", " Bearer " + accessToken);
                httpRequest.send(null);
            });
        }
        return wrapper(this.accessToken);
    }
};
Dropbox.prototype = CloudStorage.prototype;

Dropbox.retrieveSharedFile = function(fileUrl) {
    return new Promise(function(resolve,reject){
        var httpRequest = new XMLHttpRequest();

        var onFileRetrieved = function() {
            if (httpRequest.status == 200) {
                resolve(encode(httpRequest.response));
            } else {
                reject("Download unsuccessful");
            }
        };
        httpRequest.addEventListener('load', onFileRetrieved, false);

        httpRequest.open("GET", fileUrl, true);
        httpRequest.send(null)
    });
};

Dropbox.sharedDataAccessType = BytableString;
cloudStorages['Dropbox'] = Dropbox;