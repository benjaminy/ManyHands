// TODO: I redesigned the transaction system slightly. Since I was concerned for
// using the correct timestamp in the Transaction file (the timestamp for when the
// link to the last Transaction has been made available). Instead of current system
// I will use an additional file that stores timestamps of transactions.
// File system, S means shared:
// t1 (S), t2 (S), t3 (S), t4 (S), ... (S), timeStamps (S), lastTransactionNumber
// If we decide that downloading the timeStamps file all the time is inefficient,
// we can use the approach with the pointer to the next file.

// TODO: Get time stamp will need to use our own server to be able to bypass CORS requirements
// other options include relying on computer's built-in time or using clouds' data.

// This function retrieves the current timestamp from a time server. A promise with the timestamp
// is returned
function getTimeStamp() {
    return Promise.resolve(0);
    // return Promise(time);
}

// Class created to eliminate the need to pass cloudStorage and teamCatalog to functions working
// on the transaction system
var TransactionManager = function(_cloudStorage, _teamCatalog) {
    // properties used to access the data of a given team - cloud handle and the link to the team
    // catalog:
    this.cloudStorage = _cloudStorage;
    this.teamCatalog = _teamCatalog;

    // This method loads the transaction chain belonging to the current user (it fetches it from
    // the cloud to which TransactionManager is connected). Returns a promise with the transaction
    // chain
    this.loadOwnTransactionChain = function() {
        // We need to provide the manager to the promise resolvers, since we won't be able to use this
        function resolvePromises(manager) {
            var transactionChain = [];
            var lastTransactionNumber;

            // pull the index of the last transaction...
            return manager.getLastTransactionNumber().then(function (result) {
                lastTransactionNumber = result;
                var promises = [];
                //...and go through all of the transactions from 1 to that number, and fetch them
                for (var i = 0; i < lastTransactionNumber; ++i) {
                    promises[i] = manager.cloudStorage.downloadTextFile(manager.teamCatalog + "/t" + (i + 1));
                }
                return Promise.all(promises);
            }).then(function (transactionContents) {
                // export the downloaded data to Transaction objects
                for (var i = 0; i < lastTransactionNumber; ++i) {
                    transactionChain[i] = Transaction.fromString(transactionContents[i]);
                }
                return Promise.resolve(transactionChain);
            });
        }
        return resolvePromises(this);
    };

    // This method pulls the transaction chain of a different user using the link to the latest
    // transaction in that user's chain (an instance of SharedFile). Returned is a promise with
    // the chain.
    this.loadForeignTransactionChain = function(lastTransactionLink) {
        // this variable will hold the result
        var transactionChain = [];

        // this method is used to make recursion easier. It will load the transaction chain starting
        // from 1st transaction and ending at the transaction of which data is provided in
        // transactionData parameter. transactionData is the contents of the file representing the
        // transaction. transactionChain is the resultant variable, which will be edited in the method
        function retrieveRestOfTheChain(transactionData, transactionChain) {
            // Convert the file contents to a Transaction object
            var transactionJsonText = decodeASCIIString(transactionData);
            var t = Transaction.fromString(transactionJsonText);
            // Add the transaction to the chain
            transactionChain.unshift(t);

            // If there is more transactions in this chain fetch them
            if (t.previousTransactionLink != null) {
                return (new SharedFile(encodeASCIIString(t.previousTransactionLink))).retrieve().then(
                    function(data) {
                        return retrieveRestOfTheChain(data,transactionChain);
                    });
            } else {
                // if this is the last transaction, the chain may be returned
                return Promise.resolve(transactionChain);
            }
        }
        // calling the recursive method from above
        return lastTransactionLink.retrieve().then(function(data) {return retrieveRestOfTheChain(data,transactionChain)});
    };

    // This method checks through both user's and their teammate's transaction chain in order to
    // find differences between the chains and return them. Passed is the link to the latest
    // transaction in teammate's chain, returned is a promise with the differing part of the chain
    this.loadDifferencesFromForeignTransactionChain = function(lastTransactionLink) {
        // this variable will hold the results:
        var transactionChain = [];
        // this variable is used to preserve the currentTransaction between the promises
        var currentTransaction;

        // this method enables recurrence. It will reaturn a promise with a chain starting from
        // the first difference in chains and ending with the transaction to which transactionLink
        // points. manager is passed to enable using TransactionManager's features.
        function loadRestOfTheChain(transactionLink, manager) {
            // this function adds a given transaction to the resultant chain and goes on to the
            // next transaction in the chain
            function addTransactionAndProceed(transaction) {
                transactionChain.unshift(transaction);
                return loadRestOfTheChain(new SharedFile(encodeASCIIString(transaction.previousTransactionLink)),manager);
            }

            // retrieve the linked transaction
            return transactionLink.retrieve().then(function (data) {
                var transactionJsonText = decodeASCIIString(data);
                currentTransaction = JSON.parse(transactionJsonText);

                // download the corresponding transaction in user's chain
                return manager.cloudStorage.downloadTextFile(manager.teamCatalog + "/t" + (currentTransaction.index));
            }).then(function (contents) {
                // if the transaction exists check if hashes are the same
                var t = JSON.parse(contents);
                if (t.h == currentTransaction.h) {
                    // TODO: direct comparison of transactions
                    // hashes are the same, so (most likely) the transactions are the same
                    // process the chain so that it contains transaction objects, not JSON objects:
                    for (var i = 0; i < transactionChain.length; ++i) {
                        transactionChain[i] = Transaction.fromJSON(transactionChain[i]);
                    }
                    return Promise.resolve(transactionChain);
                } else {
                    // transactions are different, we need to proceed to the next transaction
                    return addTransactionAndProceed(currentTransaction);
                }
            }, function () {
                // transaction does not exist in user's chain, we need to proceed to the next transaction
                return addTransactionAndProceed(currentTransaction);
            });
        }

        // call the recursive method
        return loadRestOfTheChain(lastTransactionLink,this);
    };

    this.setLastTransactionNumber = function(newNumber) {
        return this.cloudStorage.uploadTextFile(""+newNumber, this.teamCatalog + "/lastTransactionNumber");
    };

    this.getLastTransactionNumber = function() {
        return this.cloudStorage.downloadTextFile(this.teamCatalog + "/lastTransactionNumber").then(
            function(fileText) {
                return Promise.resolve(parseInt(fileText));
            },
            function() {
                // if the file does not exist then we assume that the last Transaction was 0 (no transactions)
                return Promise.resolve(0);
            }
        );
    };

    // Deprecated
    this.addTransactionToTimestampsFile = function(transactionTimestamp, transactionNumber) {
        // We need to provide the manager to the promise resolvers:
        function resolvePromises(manager) {
            return manager.cloudStorage.downloadTextFile(manager.teamCatalog + "/transaction_timestamps").then(
                function (fileContents) {
                    // when the file is empty, make it parsable for JSON
                    if (fileContents == "")
                        fileContents = "{}";

                    var timestamps = JSON.parse(fileContents);
                    timestamps[transactionNumber] = transactionTimestamp;
                    return manager.cloudStorage.uploadTextFile(JSON.stringify(timestamps),
                        manager.teamCatalog + "/transaction_timestamps");
                },
                function () {
                    // file not found, create a new one
                    var timestamps = [];
                    timestamps[transactionNumber] = transactionTimestamp;
                    return manager.cloudStorage.uploadTextFile(JSON.stringify(timestamps),
                        manager.teamCatalog + "/transaction_timestamps");
                }
            )
        }
        return resolvePromises(this);
    };

    // uploads a given transaction to the user's chain. Returns a promise object which will finish
    // execution once the upload is finished
    this.uploadTransactionToChain = function(transaction) {
        // We need to provide the manager to the promise resolvers:
        function resolvePromises(manager) {
            var lastTransactionNumber;
            var linksFileResources = {};
            // first we need to fetch the current latest transaction link, since it will be previous
            // to the newly uploaded transaction
            return readMultipleSharedResourcesFromFile(manager.cloudStorage, manager.teamCatalog+"/links")
                .then(function (resources) {
                linksFileResources = resources;
                var linkToLastTransaction = resources["latestTransaction"];
                transaction.previousTransactionLink = decodeASCIIString(linkToLastTransaction.encode());

                return manager.getLastTransactionNumber();
            }, function(result){
                    // if the file does not exist this is the first transaction
                    transaction.previousTransactionLink = null;
                    return manager.getLastTransactionNumber();
                }).then(function (number) {
                // once we fetched the current number of transactions we can determine the
                // index of the new transaction
                lastTransactionNumber = number;
                transaction.index = number+1;
                return manager.cloudStorage.uploadTextFile(transaction.exportToString(),
                    manager.teamCatalog + "/t" + (lastTransactionNumber+1));
            }).then(function() {
                return manager.cloudStorage.shareFile(manager.teamCatalog + "/t" + (lastTransactionNumber+1));
            })
              .then(function (accessor) {
                linksFileResources["latestTransaction"] = accessor;
                shareMultipleResources(linksFileResources, manager.teamCatalog+"/links", manager.cloudStorage);
            })
              .then(function () {
                return getTimeStamp();
            }).then(function(timeStamp) {
                var promise1 = manager.addTransactionToTimestampsFile(timeStamp, lastTransactionNumber+1);
                var promise2 = manager.setLastTransactionNumber(lastTransactionNumber+1);
                return Promise.all([promise1,promise2]);
            }).then(function(){
                return Promise.resolve();
            });
        }
        return resolvePromises(this);
    };
};

var EventInfo = function(eventCode, eventParams, eventId) {
    this.code = eventCode;
    this.params = eventParams;
    this.id = eventId;

    // TODO: this will probably not be useful
    /*this.exportToString = function() {
     return JSON.stringify(this);
     }*/
};

// previousTransactionLink is null for the first Transaction in the chain
var Transaction = function(events, timestamp, previousTransactionLink) {
    this.events = events;
    this.timestamp = timestamp;
    this.previousTransactionLink = previousTransactionLink;
    this.exportToString = function() {
        this.h = this.hash();
        var result = JSON.stringify(this);
        this.h = undefined;
        return result;
    };

    this.hash = function() {
        // we need to make sure that the hashed string is same for two agreeing transactions
        // we can't just use exportToString
        // TODO: https://github.com/substack/json-stable-stringify (it will also be useful for direct
        // comparison later in the project as well)
        var hashedString = "";
        var events = this.events.slice(0);
        events = events.sort(function(a,b) {
            if (a == b)
                return 0;
            return (a.id < b.id ? -1 : 1);
        });
        for (var i = 0; i < events.length; ++i) {
            var e = events[i];
            hashedString += ""+e.code+e.id;
        }
        return murmurHash3.x86.hash128(hashedString);
    }
};

Transaction.fromString = function(string){
    var transactionJson = JSON.parse(string);
    return Transaction.fromJSON(transactionJson);
};

Transaction.fromJSON = function(transactionJson) {
    for (var i = 0; i < transactionJson.events.length; ++i) {
        var e = transactionJson.events[i];
        transactionJson.events[i] = new EventInfo(e.code,e.params, e.id);
    }
    return new Transaction(transactionJson.events, transactionJson.timestamp,
        transactionJson.previousTransactionLink);
};