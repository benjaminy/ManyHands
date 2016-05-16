// TODO: remove throws from promises

// A class implementing the cloudStorage interface. Appkey is the key
// provided for many_hands by dropbox.
var Dropbox = function(appkey) {
    this.appkey = appkey;
    this.accessToken = null; // access token will be provided by authenticate
    CloudStorage.call(this);

    // Authentication via Dropbox login page
    this.authenticate = function() {
        window.open('https://www.dropbox.com/1/oauth2/authorize?client_id='+encodeURIComponent(this.appkey)+
            '&response_type=token&redirect_uri='+encodeURIComponent(get_redirect_uri()), "_self");
    };

    this.downloadFile = function(downloadUrl) {
        // Promisifying the XMLHttpRequest
        return new Promise( function (resolve, reject) {
            var httpRequest = new XMLHttpRequest();
            var onDownloaded = function () {
                if (httpRequest.status == 200) {
                    resolve(encodeASCIIString(httpRequest.responseText));
                } else {
                    reject();
                }
            };

            httpRequest.addEventListener('load', onDownloaded, false);
            httpRequest.open("GET", "https://content.dropboxapi.com/2/files/download", true);
            httpRequest.setRequestHeader("Authorization"," Bearer " + this.accessToken);
            httpRequest.setRequestHeader("Dropbox-API-Arg", " {\"path\": \""+downloadUrl+"\"}");
            httpRequest.send(null);
        })
    };

    this.uploadFile = function(fileContents, fileUrl) {
        // Promisifying the XMLHttpRequest
        return new Promise( function (resolve, reject) {
            var httpRequest = new XMLHttpRequest();
            var onUploaded = function() {
                if (httpRequest.status == 200) {
                    resolve();
                } else {
                    reject(httpRequest.status);
                }
            };
            httpRequest.addEventListener("load", onUploaded, false);

            httpRequest.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+fileUrl+"?overwrite=true", true);
            httpRequest.setRequestHeader("Authorization"," Bearer "+ this.accessToken);
            httpRequest.send(decodeASCIIString(fileContents));
        });
    };

    this.shareFile = function (sharedFileUrl) {
        return new Promise ( function(resolve, reject) {
            var httpRequest = new XMLHttpRequest();

            var onShared = function () {
                if (httpRequest.status == 200) {
                    var response = JSON.parse(this.responseText);
                    var linkToResource = resp.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
                    linkToResource = new BytableString(linkToResource); // we need a Bytable object
                    resolve(new SharedFile(Dropbox, linkToResource));
                } else {
                    reject("Upload unsuccessful");
                }
            };
            httpRequest.addEventListener('load', onShared, false);

            httpRequest.open("POST", "https://api.dropbox.com/1/shares/auto/" + sharedFileUrl + "?short_url=false", true);
            httpRequest.setRequestHeader("Authorization", " Bearer " + this.accessToken);
            httpRequest.send(null);
        });
    }
};

Dropbox.retrieveSharedFile = function(accessData) {
    return new Promise(function(resolve,reject){
        var httpRequest = new XMLHttpRequest();

        var onFileRetrieved = function() {
            if (httpRequest.status == 200) {
                resolve(encodeASCIIString(httpRequest.response));
            } else {
                reject("Download unsuccessful");
            }
        };
        httpRequest.addEventListener('load', onFileRetrieved, false);

        httpRequest.open("GET", download_url, true);
        httpRequest.send(null)
    });
}

Dropbox.sharedDataAccessType = BytableString;
cloudStorages['Dropbox'] = Dropbox;