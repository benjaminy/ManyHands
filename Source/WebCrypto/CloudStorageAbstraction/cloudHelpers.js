// set of functions that use the CloudStorage interface in order to achieve functionalities
// required by Many Hands

var VersionFile = function(path, versionNumber, sharedResourceAccessor, cloudStorage) {
    this.path = path;
    this.sharedResourceAccessor = sharedResourceAccessor;

    // This method advanced the versionNumber by 1, and uploads the change to the
    // version number file. It returns a promise object for the end of upload
    // operation.
    this.advance = function() {
        // check for int overflow
        var previousVersionNumber = versionNumber;
        versionNumber++;
        if (previousVersionNumber == versionNumber) {
            versionNumber = 0;
        }
        return cloudStorage.uploadTextFile(""+versionNumber, path);
    }
};

// Creates a version file (or opens and existing one) to allow for changing the version
// Returns a promise object with the VersionFile object.
function initializeVersionFile(cloudStorage, pathToVersionFile) {
    var versionNumber;
    // try to retrieve the file, if it's impossible create it
    return cloudStorage.downloadTextFile(pathToVersionFile).then(
            function(fileContents) {
                return new Promise( function(resolve, reject) {
                    // check if the string is a number
                    if (Number(~~fileContents).toString() == fileContents) {
                        versionNumber = Number(fileContents);
                        resolve(versionNumber);
                    }
                    else
                        reject(new InputValueError("Supplied version file contains a nonnumerical value"));
                })
            },
            function () {
                versionNumber = 0;
                return cloudStorage.uploadTextFile("0", pathToVersionFile);
            }
        ).then(
            function() {
                return cloudStorage.shareFile(pathToVersionFile);
            }
        ).then(
            function(accessor) {
                return new VersionFile(pathToVersionFile, versionNumber, accessor, cloudStorage);
            }
        )
}


// This function will run continuously in the background to check if the give versionFile has been updated
// It will check every <timeBetweenChecks> milliseconds, and call <callbackOnUpdate> whenever the version
// changedCount.
function startUpdateCheck(versionFileAccessor, timeBetweenChecks, callbackOnUpdate, lastVersion) {
    if (typeof lastVersion != "string")
        lastVersion = "-1";
    versionFileAccessor.retrieve().then(
        function(versionFileContents) {
            var contentsStringified = decodeAscii(versionFileContents);
            if (contentsStringified != lastVersion) {
                callbackOnUpdate();
                lastVersion = contentsStringified;
            }
            setTimeout(function() {
                startUpdateCheck(versionFileAccessor,timeBetweenChecks,callbackOnUpdate,lastVersion);
            }, timeBetweenChecks);
        }
    );
}

// This function will create a file on the file server that contains all the resources specified
// in the resources parameter (an associative array with keys being names of resources, and
// values being their accessors).
// Function returns a promise object with an accessor to the file with all the resources
function shareMultipleResources(resources, pathToStore, cloudStorage) {
    var accessFileContents = ""; // Access file is a file containing links to all resources
    for (var key in resources) {
        // we need to escape the delimiter (\n), since resources are binary data, and might
        // contain "\n" in them
        if (resources[key] != null) {
            accessFileContents += key + "\n" + decodeAscii(resources[key].encode()).
                replace("\\", "\\\\").replace("\n", "\\n") + "\n";
        }
    }
    // cut the excessive last "\n"
    accessFileContents = accessFileContents.slice(0, -1);

    return cloudStorage.uploadTextFile(accessFileContents,pathToStore).
        then(function() {
            return cloudStorage.shareFile(pathToStore);
        });
}

// helper function which reverts character escapes \\, and \n
// The parameter escapedString is the string in which escapes need to be reverted
function revertEscapeCharacters(escapedString) {
    var resultantString = "";
    for (var i = 0; i < escapedString.length; ++i) {
        if (escapedString.charAt(i) == "\\") {
            ++i;
            if (escapedString.charAt(i) == "n")
                resultantString += "\n";
            else if (escapedString.charAt(i) == "\\")
                resultantString += "\\";
            else
                resultantString += escapedString.charAt(i);
        } else {
            resultantString += escapedString.charAt(i);
        }
    }
    return resultantString;
}

// An inverse function to shareMultipleResources(). Given the resourcesAccessor returns a
// promise object with an associative array of resources (keys are names of resources, and
// values are their accessors).
function readMultipleSharedResourcesFromAccessor(resourcesAccessor) {
    return resourcesAccessor.retrieve().then(function(accessFileContents) {
        var contentsStringified = decodeAscii(accessFileContents);
        return Promise.resolve(readMultipleSharedResourcesFromText(contentsStringified));
    });
}

function readMultipleSharedResourcesFromText(contentsStringified) {
    var records = contentsStringified.split("\n");
    var result = [];
    for (var i = 0; i < records.length; i+=2) {
        records[i] = revertEscapeCharacters(records[i]);
        records[i+1] = revertEscapeCharacters(records[i+1]);
        result[records[i]]= new SharedFile(encodeAscii(records[i+1]));
    }
    return result;
}

// function used to read multiple resources on the user's cloud storage.
// This means that instead of operating on an accessor, this function
// uses a file path to find a file containing the shared resources links
function readMultipleSharedResourcesFromFile(cloudStorage, pathToFile) {
    return cloudStorage.downloadTextFile(pathToFile).then(function(fileContents) {
        return Promise.resolve(readMultipleSharedResourcesFromText(fileContents));
    });
}