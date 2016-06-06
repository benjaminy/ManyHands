// TODO: I redesigned the transaction system slightly. Since I was concerned for
// using the correct timestamp in the Transaction file (the timestamp for when the
// link to the last Transaction has been made available). Instead of current system
// I will use an additional file that stores timestamps of transactions.
// File system, S means shared:
// t1 (S), t2 (S), t3 (S), t4 (S), ... (S), timeStamps (S), lastTransactionNumber
// If we decide that downloading the timeStamps file all the time is inefficient,
// we can use the approach with the pointer to the next file.

// DEBUG:
console.log2 = function() {
    var args = [];
    for(var i=0; i<arguments.length; i++) {
        args.push(JSON.parse(JSON.stringify(arguments[i])));
    }
    console.log.apply(console, args);
};

// TODO: Get time stamp will need to use our own server to be able to bypass CORS requirements
// other options include relying on computer's built-in time or using clouds' data.

// This function retrieves the current timestamp from a time server. A promise with the timestamp
// is returned
function getTimeStamp() {
    return Promise.resolve(Math.round(new Date().getTime()/1000.0));
    // return Promise(time);
}

var Teammate = function (name, versionFileLink, resourcesLink) {
    this.name = name;
    this.versionFileLink = versionFileLink;
    this.resourcesLink = resourcesLink;
};

function loadUsersOnTheTeam(cloudStorage, teamCatalog) {
    // TODO: Temporary, later load the list of users from the teamCatalog
    return Promise.resolve([]);
}

var Lock = function() {
    this.locked = false;
    this.waitingList = [];
    this.unlock = function() {
        console.log2("unlock");
        var thisLock = this;
        if (this.waitingList.length > 0) {
            var action = this.waitingList[0];
            var result = action.method();
            // check if result is a promise
            if (result.then != null) {
                result.then(function(r) {
                    thisLock.unlock();
                    action.resolve(r);
                }, function(r) {
                    thisLock.unlock();
                    action.reject(r);
                });
            } else {
                this.unlock();
                action.resolve(result);
            }
            this.waitingList.splice(0,1);
        } else {
            this.locked = false;
        }
    };

    this.lock = function(method) {
        var thisLock = this;
        if (!this.locked) {
            this.locked = true;
            var result = method();
            // check if result is a promise
            if (result.then != null) {
                return result.then(function(r) {
                    thisLock.unlock();
                    return Promise.resolve(r);
                }, function(r) {
                    thisLock.unlock();
                    return Promise.reject(r);
                });
            } else {
                this.unlock();
                return result;
            }
        } else {
            return new Promise(function(resolve, reject) {
                thisLock.waitingList.push({resolve: resolve, reject: reject, method: method});
            });
        }
    };
};


// Class created to eliminate the need to pass cloudStorage and teamCatalog to functions working
// on the transaction system
var TransactionManager = function(_cloudStorage, _teamCatalog, _userId) {
    // properties used to access the data of a given team - cloud handle and the link to the team
    // catalog:
    this.cloudStorage = _cloudStorage;
    this.teamCatalog = _teamCatalog;
    this.userId = _userId;

    // current vector clock in TransactionManager's frame
    this.ownVectorClock = null;

    // Data about teammates
    this.usersOnTheTeam = null;
    this.ownVersionFile = null;

    // Data from the cloud stored locally
    this.currentChain = [];
    this.currentLastTransactionLink = null;

    // States of the database
    this.currentDBs = [];

    this.lock = new Lock();

    // Since a large part of the initialization code for the transaction manager relies on promises,
    // we use an initialize() method, which returns a promise which is resolved once initialization is
    // over.
    this.initialize = function() {
        var manager = this;
        return readMultipleSharedResourcesFromFile(manager.cloudStorage, manager.teamCatalog+"/links")
            .then(function (resources) {
                manager.currentLastTransactionLink = resources["latestTransaction"];
                return manager.loadOwnTransactionChain();
            }, function(result){
                // if the file does not exist we assume that there's no transactions
                manager.currentLastTransactionLink = null;
                // chain is going to be empty now
                return Promise.resolve([]);
            }).then(function(chain) {
            manager.currentChain = chain;
            // Fetch the vector clock
            // Get the first transaction and check its timestamp
            if (chain.length == 0) {
                manager.ownVectorClock = {};
            } else {
                manager.ownVectorClock = chain[chain.length - 1].ownVectorClock;
            }
            var lastDB = new DB();
            manager.currentDBs = [];
            for (var i = 0; i < manager.currentChain.length; ++i) {
                if (manager.currentChain[i].enabled)
                    manager.currentChain[i].applyOn(lastDB);
                manager.currentDBs[i] = lastDB.clone();
            }
            return initializeVersionFile(manager.cloudStorage, manager.teamCatalog+"/version");
        }).then(function(versionFile) {
            manager.ownVersionFile = versionFile;
            // Get the first transaction and check its timestamp
            return loadUsersOnTheTeam(manager.cloudStorage, manager.teamCatalog);
        }).then(function(users) {
            manager.usersOnTheTeam = users;
            for (var i = 0; i < users.length; ++i) {
                var teammate = users[i];
                startUpdateCheck(teammate.versionFileLink, 3000, function(){
                    manager.onOtherUserUpdate(teammate);
                });
            }
        });
    };

    // This method loads the transaction chain belonging to the current user (it fetches it from
    // the cloud to which TransactionManager is connected). Returns a promise with the transaction
    // chain
    this.loadOwnTransactionChain = function() {
        return this.loadTransactionChain(this.currentLastTransactionLink, false);
    };

    // This method modifies the chain to resolve any present conflicts
    this.resolveConflicts = function(transactions, indexOfTheFirstChange) {
        // Make a working copy of the database
        var newDB = (indexOfTheFirstChange > 0 ? this.currentDBs[indexOfTheFirstChange-1].clone() : new DB());
        var newChain = this.currentChain.slice(0,indexOfTheFirstChange);

        // those variables will hold the state of the DB before the last change
        var previousDB = newDB.clone();
        var previousChain = newChain.slice(0);

        // TODO: remove this line when function seems to work
        //transactions = transactions.slice(0);

        for (var i = 0; i < transactions.length; ++i) {
            var conditionsMet = transactions[i].checkConditionsForEvents(newChain, newDB);
            if (conditionsMet) {
                previousChain = newChain.slice(0);
                previousDB = newDB.clone();
                transactions[i].enabled = true;
                transactions[i].applyOn(newDB);
                newChain.push(transactions[i]);
            } else {
                transactions[i].enabled = false;
                if (i > 0) {
                    // restore previous state, and try reverse order
                    newDB = previousDB.clone();
                    newChain = previousChain.slice(0);

                    var swapWorks = true;
                    if (swapWorks = transactions[i].checkConditionsForEvents(newChain, newDB)) {
                        newChain.push(transactions[i]);
                        transactions[i].applyOn(newDB);
                    }
                    if (swapWorks = swapWorks & transactions[i-1].checkConditionsForEvents(newChain, newDB)) {
                        transactions[i-1]. applyOn(newDB);
                        newChain.push(transactions[i-1]);

                        // Everything worked out - enable both transactions and swap them
                        transactions[i].enabled = true;
                        var temp = transactions[i];
                        transactions[i] = transactions[i-1];
                        transactions[i-1] = temp;
                    }
                    if (!swapWorks) {
                        // restore original order
                        newDB = previousDB.clone();
                        newChain = previousChain.slice(0);
                        transactions[i-1].applyOn(newDB);
                        newChain.push(transactions[i-1]);
                        newChain.push(transactions[i]);
                    }
                }
            }
        }
        console.log2(transactions);
        console.log2(this.currentDBs);
    };

    this.updateFromOtherUser = function(lastForeignTransactionAccessor) {
        var manager = this;
        return manager.lock.lock(function() {
            return manager.loadDifferencesFromForeignTransactionChain(lastForeignTransactionAccessor).then(
                function(diff) {
                    return manager.solveDiff(diff);
                }
            )
        });
    };
    // This method takes an object returned by loadDifferencesFromForeignTransactionChain
    // and tries to solve it and change the chain
    this.solveDiff = function (diff) {
        if (diff.own.length == 0 && diff.foreign.length == 0)
            return Promise.resolve();
        var manager = this;
        var mergedTransactions = [];
        var own_copy = diff.own.slice(0);
        for (var i = 0; i < diff.foreign.length; ++i) {
            var newTransaction = Transaction.fromString(JSON.stringify(diff.foreign[i]));
            var ownMatch = null;
            for (var j = 0; j < diff.own.length; ++j) {
                if (diff.own[j].owner == diff.foreign[i].owner &&
                    diff.own[j].initialIndex == diff.foreign[i].initialIndex) {
                    ownMatch = diff.own[j];
                    // remove from the array
                    var index = own_copy.indexOf(ownMatch);
                    own_copy.splice(index, 1);
                    break;
                }
            }
            if (ownMatch != null) {
                if (diff.foreign[i].timestamp == null)
                    newTransaction.timestamp = ownMatch.timestamp;
                else if (ownMatch.timestamp == null)
                    newTransaction.timestamp = diff.foreign[i].timestamp;
                else
                    newTransaction.timestamp = (ownMatch.timestamp < diff.foreign[i].timestamp ?
                        ownMatch.timestamp : diff.foreign[i].timestamp);
            }
            mergedTransactions.push(newTransaction);
        }
        for (var i = 0; i < own_copy.length; ++i) {
            mergedTransactions.push(Transaction.fromString(JSON.stringify(own_copy[i])))
        }

        // Sort transactions
        mergedTransactions.sort(function cmp(t1, t2) {
            return t1.compareChronology(t2);
        });

        //manager.resolveConflicts(mergedTransactions, diff.indexOfFirstDifference);

        if (mergedTransactions.length > 0)
            mergedTransactions[0].previousTransactionLink = null;

        // set new indexes for transactions
        for (var i = 0; i < mergedTransactions.length; ++i) {
            mergedTransactions[i].index = diff.indexOfFirstDifference + i;
        }
        console.log2(mergedTransactions);

        // Upload the transactions to the chain
        function uploadNext(i, uploadAfter) {
            if (i >= mergedTransactions.length)
                return Promise.resolve(null);
            return manager.uploadTransactionAfter(mergedTransactions[i], uploadAfter)
                .then(function (accessor) {
                    if (i >= mergedTransactions.length - 1)
                        return Promise.resolve(accessor);
                    return uploadNext(i + 1, accessor);
                });
        }

        var uploadAfter = diff.indexOfFirstDifference < manager.currentChain.length ?
            manager.currentChain[diff.indexOfFirstDifference].previousTransactionLink :
            manager.currentLastTransactionLink;
        if (uploadAfter != null && !(uploadAfter instanceof SharedFile))
            uploadAfter = new SharedFile(encode(uploadAfter));
        var previousLastTransaction = manager.currentLastTransactionLink;

        return uploadNext(0, uploadAfter).then(function (lastTransactionAccessor) {
            return manager.setNewLastTransaction(lastTransactionAccessor);
        }).then(function () {
            return manager.removeTransactions(previousLastTransaction, uploadAfter);
        }).then(function () {
            manager.currentChain = manager.currentChain.slice(0, diff.indexOfFirstDifference).concat(mergedTransactions);
            var lastDB = (diff.indexOfFirstDifference > 0 ? manager.currentDBs[diff.indexOfFirstDifference-1].clone() : new DB());
            manager.currentDBs = manager.currentDBs.slice(0, diff.indexOfFirstDifference).
                concat(DB.makeDBChain(lastDB, mergedTransactions));
            console.log2(manager.userId, manager.currentChain);
            return Promise.resolve();
        });
    };

    this.removeTransactions = function(from, to, removalPromises) {
        if (from == null || (to != null && from.path == to.path)) {
            return Promise.resolve();
        }
        var manager = this;
        function recurrentRemove(from, to, removalPromises) {
            if (removalPromises == null)
                removalPromises = [];
            return from.retrieve().then(function (t_contents) {
                var t = Transaction.fromString(decode(t_contents));
                removalPromises.push(manager.cloudStorage.removeFile(from.path));
                if (t.previousTransactionLink == null)
                    return Promise.all(removalPromises);
                var nextToRemoveEncoded = encode(t.previousTransactionLink);
                var nextToRemove = new SharedFile(nextToRemoveEncoded);
                if (to != null && nextToRemove.path == to.path) {
                    return Promise.all(removalPromises);
                } else {
                    return recurrentRemove(nextToRemove, to, removalPromises);
                }
            });
        }
        return recurrentRemove(from,to);
    };

    this.setNewLastTransaction = function(newLastTransaction) {
        var manager = this;
        var linksFileResources = {};
        manager.currentLastTransactionLink = newLastTransaction;
        return readMultipleSharedResourcesFromFile(manager.cloudStorage, manager.teamCatalog + "/links")
            .then(function (resources) {
                linksFileResources = resources;
                linksFileResources["latestTransaction"] = newLastTransaction;
                return shareMultipleResources(linksFileResources, manager.teamCatalog + "/links", manager.cloudStorage);
            }, function (accessor) {
                linksFileResources["latestTransaction"] = newLastTransaction;
                return shareMultipleResources(linksFileResources, manager.teamCatalog + "/links", manager.cloudStorage);
            }).then(function () {
                return manager.ownVersionFile.advance();
            });
    };

    this.loadTransactionChain = function (lastTransactionLink, setTimestamps) {
        var timestamp = null;
        return this.lock.lock(function() {
            // this variable will hold the result
            var transactionChain = [];

            // this method is used to make recursion easier. It will load the transaction chain starting
            // from 1st transaction and ending at the transaction of which data is provided in
            // transactionLink parameter. transactionLink is a link to the transaction file that can later be
            // retrieved. transactionChain is the resultant variable, which will be edited in the method
            function retrieveRestOfTheChain(transactionLink, transactionChain) {
                return transactionLink.retrieve().then(function (transactionData) {
                    // Convert the file contents to a Transaction object
                    var transactionJsonText = decode(transactionData);
                    var t = Transaction.fromString(transactionJsonText);
                    // set up the timestamp of this transaction
                    var promise;
                    if (setTimestamps) {
                        if (t.timestamp == null) {
                            t.timestamp = timestamp;
                        }
                        return Promise.resolve();
                    }
                    else {
                        promise = Promise.resolve();
                    }

                    return promise.then(function () {
                        transactionChain.unshift(t);
                        // If there is more transactions in this chain fetch them
                        if (t.previousTransactionLink != null) {
                            return retrieveRestOfTheChain(new SharedFile(encode(t.previousTransactionLink)), transactionChain);
                        } else {
                            // if this is the last transaction, the chain may be returned
                            return Promise.resolve(transactionChain);
                        }
                    });
                }, function () {
                    // TODO: file download was unsuccessful, try again
                    return Promise.resolve([]);
                });
            }
            if (setTimestamps)
                return getTimeStamp().then(function (stamp) {
                    timestamp = stamp;
                }).then(function() {
                    // calling the recursive method from above
                    return retrieveRestOfTheChain(lastTransactionLink, transactionChain);
                });
            else {
                return retrieveRestOfTheChain(lastTransactionLink, transactionChain);
            }
        });
    };

    // This method pulls the transaction chain of a different user using the link to the latest
    // transaction in that user's chain (an instance of SharedFile). Returned is a promise with
    // the chain.
    this.loadForeignTransactionChain = function(lastTransactionLink) {
        return this.loadTransactionChain(lastTransactionLink, true);
    };

    // This method checks through both user's and their teammate's transaction chain in order to
    // find differences between the chains and return them. Passed is the link to the latest
    // transaction in teammate's chain, returned is a promise with the differing part of the chain
    this.loadDifferencesFromForeignTransactionChain = function(lastTransactionLink) {
        var timestamp = null;
        if (lastTransactionLink == null) {
            return Promise.resolve({own: [], foreign: [], indexOfFirstDifference: 0})
        }
        var manager = this;
        // those variables will hold the results:
        var foreignTransactionChain = [];
        var ownTransactionChain = [];
        // this variable is used to preserve the currentTransaction between the promises
        var currentTransaction;


        // this method enables recurrence. It will return a promise with a chain starting from
        // the first difference in chains and ending with the transaction to which transactionLink
        // points. manager is passed to enable using TransactionManager's features.
        function loadRestOfTheChain(transactionLink, manager) {
            function returnDiffObject() {
                // process the chain so that it contains transaction objects, not JSON objects:
                for (var i = 0; i < foreignTransactionChain.length; ++i) {
                    foreignTransactionChain[i] = Transaction.fromJSON(foreignTransactionChain[i]);
                }
                console.log2(lastTransactionLink.owned_by, manager.userId, {
                    foreign: foreignTransactionChain, own: ownTransactionChain,
                    indexOfFirstDifference: manager.currentChain.length - ownTransactionChain.length
                });
                return Promise.resolve({
                    foreign: foreignTransactionChain, own: ownTransactionChain,
                    indexOfFirstDifference: manager.currentChain.length - ownTransactionChain.length
                });
            }

            // this function adds a given transaction to the resultant chain and goes on to the
            // next transaction in the chain
            function addTransactionAndProceed(transaction) {
                // set the timestamp of the read transaction
                if (transaction.timestamp == null) {
                    transaction.timestamp = timestamp;
                }

                foreignTransactionChain.unshift(transaction);
                if (transaction.previousTransactionLink != null)
                    return loadRestOfTheChain(new SharedFile(encode(transaction.previousTransactionLink)), manager);
                else
                    return returnDiffObject();
            }

            // retrieve the linked transaction
            return transactionLink.retrieve().then(function (data) {
                var transactionJsonText = decode(data);
                currentTransaction = JSON.parse(transactionJsonText);

                // if this is the first call to our recursive function
                if (transactionLink == lastTransactionLink) {
                    // if the foreign chain is shorter than ours:
                    for (var i = currentTransaction.index+1; i < manager.currentChain.length; ++i) {
                        ownTransactionChain.push(manager.currentChain[i]);
                    }
                }

                // check the corresponding transaction in user's chain
                var t = manager.currentChain[currentTransaction.index];
                if (t == null) {
                    // transaction does not exist in user's chain, we need to proceed to the next transaction
                    return addTransactionAndProceed(currentTransaction);
                } else {
                    if (t.h == currentTransaction.h) {
                        // TODO: direct comparison of transactions
                        // hashes are the same, so (most likely) the transactions are the same
                        return returnDiffObject()
                    } else {
                        // transactions are different, we need to proceed to the next transaction
                        ownTransactionChain.push(t);
                        return addTransactionAndProceed(currentTransaction);
                    }
                }
            }, function () {
                // TODO: retrieval was unsuccessful
                console.log2(lastTransactionLink.owned_by, manager.userId, {own: [], foreign: [], indexOfFirstDifference: 0});
                return Promise.resolve({own: [], foreign: [], indexOfFirstDifference: 0});
            });
        }

        return getTimeStamp().then(function (stamp) {
            timestamp = stamp;
        }).then(function() {
            // call the recursive method
            return loadRestOfTheChain(lastTransactionLink, manager);
        });
    };

    this.findAFreeTransactionFileName = function () {
        var manager = this;
        var randInt = Math.round(Math.random()*1000000000);
        var path = this.teamCatalog+"/t"+randInt;

        // check for file existence
        return this.cloudStorage.downloadFile(path).then(function() {
            return manager.findAFreeTransactionFileName(); // try again
        }, function() {
            // the file does not exist
            return Promise.resolve(path);
        });
    };

    this.uploadTransactionAfter = function (transaction, linkToTransactionBefore) {
        var manager = this;
        function uploadAndShare(t) {
            var filename;
            return manager.findAFreeTransactionFileName().then(function(path) {
                filename = path;
                return manager.cloudStorage.uploadTextFile(t.exportToString(), filename)
            }).then(function(){
                return manager.cloudStorage.shareFile(filename);
            });
        }


        if (linkToTransactionBefore != null) {
            transaction.previousTransactionLink = decode(linkToTransactionBefore.encode());
            return linkToTransactionBefore.retrieve().then(function (transactionContents) {
                var contentsStringified = decode(transactionContents);
                var t = Transaction.fromString(contentsStringified);
                transaction.index = t.index + 1;
                if (transaction.initialIndex == null)
                    transaction.initialIndex = transaction.index;
                transaction.h = transaction.hash(t.h);
                return uploadAndShare(transaction);
            });
        } else {
            transaction.previousTransactionLink = null;
            transaction.index = 0;
            if (transaction.initialIndex == null)
                transaction.initialIndex = transaction.index;
            transaction.h = transaction.hash();
            return uploadAndShare(transaction);
        }
    };

    // uploads a given transaction to the user's chain. Returns a promise object which will finish
    // execution once the upload is finished
    this.uploadTransactionToChain = function(transaction) {
        var manager = this;
        return this.lock.lock(function() {
            transaction.owner = manager.userId;
                var lastTransactionNumber;
                var linksFileResources = {};
                // first we need to fetch the current latest transaction link, since it will be previous
                // to the newly uploaded transaction
                return readMultipleSharedResourcesFromFile(manager.cloudStorage, manager.teamCatalog + "/links")
                    .then(function (resources) {
                        linksFileResources = resources;
                        var linkToLastTransaction = resources["latestTransaction"];
                        return manager.uploadTransactionAfter(transaction, linkToLastTransaction);
                    }, function () {
                        return manager.uploadTransactionAfter(transaction, null);
                    }).then(function (accessor) {
                        manager.currentChain.push(transaction);
                        var newDBState = (manager.currentDBs.length > 0 ?
                            manager.currentDBs[manager.currentDBs.length - 1].clone() : new DB());
                        transaction.applyOn(newDBState);
                        manager.currentDBs.push(newDBState);
                        linksFileResources["latestTransaction"] = accessor;
                        return shareMultipleResources(linksFileResources, manager.teamCatalog + "/links", manager.cloudStorage);
                    }).then(function () {
                        return Promise.resolve();
                    });
        });
    };
};

var EventInfo = function(eventCode, eventParams, eventId) {
    this.code = eventCode;
    this.params = eventParams;
    this.id = eventId;
    this.condition = function(transactionChain, currentStateOfDb) {
        return true;
        throw new AbstractMethodCallError("Called an abstract method", "EventInfo");
    };
    this.applyOn = function(dbState) {
        return;
        throw new AbstractMethodCallError("Called an abstract method", "EventInfo");
    }
};

// previousTransactionLink is null for the first Transaction in the chain
var Transaction = function(events) {
    this.events = events;
    this.timestamp = null;
    this.previousTransactionLink = null;
    this.index = null;
    this.initialIndex = null;
    this.ownVectorClock = null;
    this.viewerVectorClock = null;
    this.enabled = true;
    this.owner = null;
    this.h = null;

    this.checkConditionsForEvents = function(transactionChain, currentDbState) {
        var allEventsPassedTheTest = true;
        var db = currentDbState.clone();
        for (var j = 0; j < this.events.length; ++j) {
            var event = this.events[j];
            if (event.condition(transactionChain, db)) {
                event.applyOn(db);
                continue;
            } else {
                allEventsPassedTheTest = false;
                break;
            }
        }
        return allEventsPassedTheTest;
    };

    this.applyOn = function(db) {
        for (var i = 0; i < this.events.length; ++i) {
            this.events[i].applyOn(db);
        }
    };

    //this.nextTransactionLink = null;
    this.exportToString = function() {
        //this.h = this.hash();
        var result = JSON.stringify(this);
        //this.h = undefined;
        return result;
    };

    this.hash = function(additionalData) {
        // we need to make sure that the hashed string is same for two agreeing transactions
        // we can't just use exportToString
        // TODO: https://github.com/substack/json-stable-stringify (it will also be useful for direct
        // comparison later in the project as well)
        var hashedString = "";
        if (additionalData != null)
            hashedString += additionalData;
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
        hashedString += this.owner+";";
        hashedString += this.initialIndex;
        // TODO: either remove this line or add vector locks later
        hashedString += this.timestamp;
        return murmurHash3.x86.hash128(hashedString);
    };

    function compareTransactionsChronology(t1, t2) {
        var t1vectorClockGreater = false;
        var t2vectorClockGreater = false;/*
         for (var key in mergeUnique(Object.keys(t1.ownVectorClock), Object.keys(t2.ownVectorClock))) {
         var t1value = t1.ownVectorClock[key];
         var t2value = t2.ownVectorClock[key];
         // if the values are not integers (for example if a given vector clock doesn't have
         // a specified key) assume that the value is 0 (there have been no preceding transactions
         // associated with the given key)
         if (!Number.isInteger(t1value))
         t1value = 0;
         if (!Number.isInteger(t2value))
         t2value = 0;
         // Check which value is greater, and check for inconsistencies (i.e. when the vector clock
         // does not determine the order)
         if (t1value < t2value) {
         t2vectorClockGreater = true;
         if (t1vectorClockGreater)
         break;
         }
         else if (t2value < t1value) {
         t1vectorClockGreater = true;
         if (t2vectorClockGreater)
         break;
         }
         }
         if ((t1vectorClockGreater && t2vectorClockGreater) || !(t1vectorClockGreater || t2vectorClockGreater)) {
         // Vector clock test has been inconclusive
         // compare timestamps*/
        if (t1.owner == t2.owner && t1.initialIndex != t2.initialIndex)
            return t1.initialIndex - t2.initialIndex;
        if (t1.timestamp != t2.timestamp) {
            if (t1.timestamp == null)
                return 1;
            else if (t2.timestamp == null)
                return -1;
            return t1.timestamp - t2.timestamp;
        } else {
            if (t1.owner < t2.owner)
                return -1;
            else
            if (t1.owner == t2.owner)
                return 0;
            else
                return 1;
        }/*
         } else {
         if (t1vectorClockGreater)
         return 1;
         else
         return -1;
         }*/
    }
    this.compareChronology = function (differentTransaction) {
        return compareTransactionsChronology(this, differentTransaction);
    };
};

Transaction.fromString = function(string){
    var transactionJson = JSON.parse(string);
    return Transaction.fromJSON(transactionJson);
};

Transaction.fromJSON = function(transactionJson) {
    for (var i = 0; i < transactionJson.events.length; ++i) {
        var e = transactionJson.events[i];
        transactionJson.events[i] = EventFactory(e);
    }
    var result = new Transaction(transactionJson.events);

    // Copy all other properties from the JSON
    for (var key in transactionJson) {
        if (key == "events")
            continue;
        result[key] = transactionJson[key];
    }
    return result;
};

var DB = function() {
    this.tasks = [];
    this.clone = function() {
        var newDB = new DB();
        for (var i = 0; i < this.tasks.length; ++i) {
            var newTask = new Task(this.tasks[i].name,this.tasks[i].id);
            newTask.completedBy = this.tasks[i].completedBy;
            newDB.tasks.push(newTask);
        }
        return newDB;
    };
    this.deriveFromChain = function(chain) {
        for (var i = 0; i < chain.length; ++i) {
            for (var j = 0; j < chain[i].events.length; ++j) {
                chain[i].events[j].applyOn(this);
            }
        }
    };
};

DB.makeDBChain = function(previousDB, transactions) {
    var newDBs = [];
    for (var i = 0; i < transactions.length; ++i) {
        var newDB = previousDB.clone();
        if (transactions[i].enabled)
            transactions[i].applyOn(newDB);
        newDBs.push(newDB);
        previousDB = newDB;
    }
    return newDBs;
};

// Event types:
var TaskCreatedEvent = function(taskName, id) {
    EventInfo.call(this);
    this.code = "task_create";
    this.params = {name: taskName};
    this.id = id;
    // this.condition = function(transactionChain, dbState) {
    //     var event = this;
    //     return (dbState.tasks.findIndex(function(t) { return t.id == event.id; }) == -1);
    // };
    // this.applyOn = function(db) {
    //     db.tasks.push(new Task(this.params.name, this.id));
    // };
};
TaskCreatedEvent.prototype = EventInfo.prototype;

var TaskCompletedEvent = function(userId, taskId) {
    EventInfo.call(this);
    this.code = "task_complete";
    this.params = {userId: userId, taskId: taskId};
    // this.applyOn = function(db) {
    //     var event = this;
    //     var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
    //     if (taskIndex == -1)
    //         throw new NotFoundError("The task cannot be completed, since it does not exist");
    //     else {
    //         if (db.tasks[taskIndex].completedBy != null) {
    //             throw new Error("the task has already been completed");
    //         } else {
    //             db.tasks[taskIndex].completedBy = this.params.userId;
    //         }
    //     }
    // };
    //
    // this.condition = function(chain, db) {
    //     var event = this;
    //     var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
    //     if (taskIndex == -1)
    //         return false;
    //     else {
    //         return db.tasks[taskIndex].completedBy == null;
    //     }
    // };
};
TaskCompletedEvent.prototype = EventInfo.prototype;


var TaskRemovedEvent = function(taskId) {
    EventInfo.call(this);
    this.code = "task_remove";
    this.params = {id: taskId};
    // this.applyOn = function(db) {
    //     var event = this;
    //     var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
    //     if (taskIndex == -1)
    //         throw new NotFoundError("The task cannot be removed, since it does not exist");
    //     else {
    //         db.tasks.splice(taskIndex,1);
    //     }
    // };
    //
    // this.condition = function(chain, db) {
    //     var event = this;
    //     var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
    //     return taskIndex != -1;
    // };
};
TaskRemovedEvent.prototype = EventInfo.prototype;

function EventFactory(jsonObject) {
    var e;
    switch (jsonObject.code) {
        case "task_remove":
            e = new TaskRemovedEvent();
            break;
        case "task_create":
            var e = new TaskCreatedEvent();
            break;
        case "task_complete":
            var e = new TaskCompletedEvent();
            break;
        default:
            throw new InputValueError("Provided event code is invalid");
            break;
    }
    e.params = jsonObject.params;
    e.id = jsonObject.id;
    return e;
}

var Task = function(name, id) {
    this.name = name;
    this.id = id;
    this.completedBy = null;
};