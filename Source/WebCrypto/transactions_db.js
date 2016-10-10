var IN_MEMORY_TREE_ORDER = 32;


var Teammate = function (name, versionFileLink, resourcesLink) {
    this.name = name;
    this.versionFileLink = versionFileLink;
    this.resourcesLink = resourcesLink;
};

function loadUsersOnTheTeam(cloudStorage, teamCatalog) {
    // TODO: Temporary, later load the list of users from the teamCatalog
    return Promise.resolve([]);
}

function getTimeStamp() {
    return Promise.resolve(Math.round(new Date().getTime()/1000.0));
    // return Promise(time);
}

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
    this.baseTree = null;

    // States of the database
    this.currentDBs = [];
    this.currentTrees = [];

    // Link factory is used as a decorator for Shared Files. This way, we can enable encryption
    // of the database without modification in the Transactions Manager.
    this.linkFactory = new SharedFileFactory();

    this.lock = new Lock();

    // Since a large part of the initialization code for the transaction manager relies on promises,
    // we use an initialize() method, which returns a promise which is resolved once initialization is
    // over.
    this.initialize = function() {
        var manager = this;

        return readMultipleSharedResourcesFromFile(manager.cloudStorage, manager.teamCatalog+"/links")
            .then(function (resources) {
                return resources["latestTransaction"].retrieve().then(function(lastTransact) {
                    manager.currentLastTransactionLink = manager.linkFactory.createFromBytes(lastTransact);

                    manager.baseTree = new BPlusTree(IN_MEMORY_TREE_ORDER);
                    return manager.loadOwnTransactionChain();
                    // return BPlusTree.readFromCloud(resources["transactionTree"], manager.linkFactory)
                    //     .then(function(tree) {
                    //         manager.baseTree = tree.withADifferentB(IN_MEMORY_TREE_ORDER);
                    //         return manager.loadOwnTransactionChain();
                    //     });
                });
            }, function(result){
                // if the file does not exist we assume that there's no transactions
                manager.baseTree = new BPlusTree(IN_MEMORY_TREE_ORDER);
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
                // apply the transactions from the chain, to determine the state of the database after
                // each transaction.
                var lastDB = new DB(); // manager.baseTree.getLast().DB;
                manager.currentDBs = [];
                manager.currentTrees[-1] = manager.baseTree;

                for (var i = 0; i < manager.currentChain.length; ++i) {
                    var transaction = manager.currentChain[i];
                    if (transaction.enabled)
                        transaction.applyOn(lastDB);
                    manager.currentDBs[i] = lastDB.clone();
                    var newTree = manager.currentTrees[i-1];
                    for (var j = 0; j < transaction.events.length; ++j) {
                        newTree = newTree.insert(""+transaction.owner+":"+transaction.initialIndex+":"+j,transaction.events[j]);
                    }
                    manager.currentTrees[i] = newTree;
                }
                return initializeVersionFile(manager.cloudStorage, manager.teamCatalog+"/version");
            }).then(function(versionFile) {
                manager.ownVersionFile = versionFile;
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

    this.addTransactionTree = function (newTransaction) {
        var newTree = this.currentTrees[this.currentTrees.length-1];
        for (var j = 0; j < newTransaction.events.length; ++j) {
            newTree = newTree.insert(""+newTransaction.owner+":"+newTransaction.initialIndex+":"+j,newTransaction.events[j]);
        }
        this.currentTrees.push(newTree);
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

        for (var i = 0; i < transactions.length; ++i) {
            var conditionsMet = transactions[i].checkConditionsForEvents(newChain, newDB);
            if (conditionsMet) {
                previousChain = newChain.slice(0);
                previousDB = newDB.clone();
                transactions[i].enabled = true;
                transactions[i].applyOn(newDB);
                newChain.push(transactions[i]);
            } else {
                // If the transaction did not have its conditions met, we want to try to swap it with
                // the transaction before
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

    // This method performs the merging with the other user's database - using the
    // accessor to that user's last transaction
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
    // and tries to solve it, by merging changes from 2 users and changing the transaction chain.
    this.solveDiff = function (diff) {
        // If no changes were present, we can skip the update
        if (diff.own.length == 0 && diff.foreign.length == 0)
            return Promise.resolve();
        var manager = this;
        var mergedTransactions = [];
        // copy of the own chain is used to easily find non-repeating transactions
        var own_copy = diff.own.slice(0);
        // If the same transaction repeats in both foreign and own chain, we want to find it,
        // and add it to the new chain just once
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
            // If we found a match for this transaction, we need to choose the earliest timestamps
            // from the two
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
        // right now all the foreign transactions are incoroporated in mergedTransactions,
        // and own_copy stores the non-repeating transactions from own chain
        // We need to add those transactions to the new chain
        for (var i = 0; i < own_copy.length; ++i) {
            mergedTransactions.push(Transaction.fromString(JSON.stringify(own_copy[i])))
        }

        // Sort transactions
        mergedTransactions = Transaction.sortTransactions(mergedTransactions);

        // check if all the transactions' conditions are met, and disable transactions
        // that cannot be a part of the current chain.
        manager.resolveConflicts(mergedTransactions, diff.indexOfFirstDifference);


        //----Now we'll put the newly created end of the chain, at the end of the transaction chain----

        if (mergedTransactions.length > 0)
            mergedTransactions[0].previousTransactionLink = null;

        // set new indices for transactions
        for (var i = 0; i < mergedTransactions.length; ++i) {
            mergedTransactions[i].index = diff.indexOfFirstDifference + i;
        }
        console.log2(mergedTransactions);

        // This method will upload the transactions to the chain
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

        // Find the last valid transaction of the current chain
        var uploadAfter = diff.indexOfFirstDifference < manager.currentChain.length ?
            manager.currentChain[diff.indexOfFirstDifference].previousTransactionLink :
            manager.currentLastTransactionLink;
        if (uploadAfter != null && !(uploadAfter instanceof Link))
            uploadAfter = manager.linkFactory.createFromBytes(encodeAscii(uploadAfter));
        var previousLastTransaction = manager.currentLastTransactionLink;

        // Upload the new transactions
        return uploadNext(0, uploadAfter).then(function (lastTransactionAccessor) {
            return manager.setNewLastTransaction(lastTransactionAccessor);
        }).then(function () {
            // remove old transactions
            return manager.removeTransactions(previousLastTransaction, uploadAfter);
        }).then(function () {
            // apply those changes in the TransactionManager itself
            manager.currentChain = manager.currentChain.slice(0, diff.indexOfFirstDifference).concat(mergedTransactions);
            var lastDB = (diff.indexOfFirstDifference > 0 ? manager.currentDBs[diff.indexOfFirstDifference-1].clone() : new DB());
            manager.currentDBs = manager.currentDBs.slice(0, diff.indexOfFirstDifference).
            concat(DB.makeDBChain(lastDB, mergedTransactions));
            console.log2(manager.userId, manager.currentChain);
            return Promise.resolve();
        });
    };

    this.copyTransactions = function(startIndex, newPreviousTransactionLink, numberToCopy) {
        var manager = this;

        function recursiveCopy(previousLink, index, numberToCopy) {
            if (numberToCopy == 0)
                return Promise.resolve(previousLink);
            return manager.uploadTransactionAfter(manager.currentChain[index], previousLink).then(function(link) {
                return recursiveCopy(link, index+1, numberToCopy-1);
            });
        }

        if (numberToCopy == 0)
            return Promise.resolve(null);

        manager.currentChain[startIndex].previousTransactionLink = newPreviousTransactionLink;
        return manager.uploadTransactionAfter(manager.currentChain[startIndex],
            startIndex != 0 ? manager.linkFactory.createFromBytes(encodeA(manager.currentChain[startIndex].previousTransactionLink))
                                : null).then(function(link) {
            return recursiveCopy(link, index+1, numberToCopy-1);
        });
    };

    this.putChainToTheTree = function(cutoffIndex) {
        if (cutoffIndex == 0)
            return Promise.resolve();

        var manager = this;
        return this.lock.lock(function() {
            var linkToCutoffTransaction = cutoffIndex < manager.currentChain.length ?
                manager.linkFactory.createFromBytes(encodeA(manager.currentChain[cutoffIndex].previousTransactionLink)) :
                manager.currentLastTransactionLink;

            // prepare new branch of the chain
            return manager.copyTransactions(cutoffIndex, null, manager.currentChain.length - cutoffIndex).then(function(link) {
                return manager.setNewLastTransaction(link);
            }).then(function() {
                // remove old transactions from the file system
                return manager.removeTransactions(linkToCutoffTransaction, null)
                    .then(function() {
                        // shorten the current chain
                        manager.currentChain.splice(0,cutoffIndex);

                        // shorten currentDBs
                        manager.currentDBs.splice(0,cutoffIndex);

                        // shorten currentTrees
                        var newBaseTree = manager.currentTrees[cutoffIndex-1];
                        manager.currentTrees.splice(0,cutoffIndex);
                        manager.currentTrees[-1] = newBaseTree;

                        // upload the new base tree
                        return newBaseTree.saveToCloud(manager.cloudStorage, manager.teamCatalog+"/tree");
                    }).then(function(linkToTree) {
                        return updateMultipleResourcesFile(manager.cloudStorage, manager.teamCatalog+"/links", "transactionTree", linkToTree);
                    }).then(function() {
                        // set up the new end of the chain
                        manager.currentChain[0].previousTransactionLink = null;
                    });
            });


        });
    };

    // this method removes the specified transactions from the chain
    // stored in the cloud
    this.removeTransactions = function(from, to) {
        if (from == null || (to != null && from.path == to.path)) {
            return Promise.resolve();
        }
        var manager = this;
        function recurrentRemove(from, to, removalPromises) {
            if (removalPromises == null)
                removalPromises = [];
            return from.retrieve().then(function (t_contents) {
                var t = Transaction.fromString(decodeAscii(t_contents));
                removalPromises.push(manager.cloudStorage.removeFile(from.path));
                if (t.previousTransactionLink == null)
                    return Promise.all(removalPromises);
                var nextToRemoveEncoded = encodeAscii(t.previousTransactionLink);
                var nextToRemove = manager.linkFactory.createFromBytes(nextToRemoveEncoded);
                if (to != null && nextToRemove.path == to.path) {
                    return Promise.all(removalPromises);
                } else {
                    return recurrentRemove(nextToRemove, to, removalPromises);
                }
            });
        }
        return recurrentRemove(from,to);
    };

    // this method updates the last_transact file, with a new
    // accessor to the last transaction
    this.setNewLastTransaction = function(newLastTransaction) {
        var manager = this;
        var linksFileResources = {};
        manager.currentLastTransactionLink = newLastTransaction;

        return manager.linkFactory.uploadAndShare(manager.cloudStorage, manager.teamCatalog + "/last_transact", newLastTransaction.encode())
            .then(function (linkToLastTransact) {
                return updateMultipleResourcesFile(manager.cloudStorage, manager.teamCatalog + "/links", "latestTransaction", linkToLastTransact);
            }).then(function() {
                return manager.ownVersionFile.advance();
            });
    };

    // This method returns a promise to a transaction chain whose last transaction
    // is linked to by lastTransactionLink.
    // Set timestamps indicates if the method should update the timestamps found
    // in the chain
    this.loadTransactionChain = function (lastTransactionLink, setTimestamps) {
        var manager = this;
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
                    var transactionJsonText = decodeAscii(transactionData);
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
                            return retrieveRestOfTheChain(manager.linkFactory.createFromBytes(
                                encodeAscii(t.previousTransactionLink)), transactionChain);
                        } else {
                            // if this is the last transaction, the chain may be returned
                            return Promise.resolve(transactionChain);
                        }
                    });
                }, function () {
                    // Download was not successful. By returning an empty chain, we force
                    // the program to try to fetch the changes again
                    return Promise.resolve([]);
                });
            }
            if (setTimestamps)
            // If this method is supposed to update the timestamp, we need to fetch
            // that timestamp
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
    // transaction in that user's chain. Returned is a promise with the chain.
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
                // if this was the last transaction we can exit the function
                if (transaction.previousTransactionLink != null)
                    return loadRestOfTheChain(manager.linkFactory.createFromBytes(
                        encodeAscii(transaction.previousTransactionLink)), manager);
                else
                    return returnDiffObject();
            }

            // retrieve the linked transaction
            return transactionLink.retrieve().then(function (data) {
                var transactionJsonText = decodeAscii(data);
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
                        // hashes are the same, so (most likely) the transactions are the same
                        return returnDiffObject()
                    } else {
                        // transactions are different, we need to proceed to the next transaction
                        ownTransactionChain.push(t);
                        return addTransactionAndProceed(currentTransaction);
                    }
                }
            }, function () {
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

    // This method will try to find an unused transaction name by picking a random number
    // and checking if the name t<random_number> is free
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

    // This method will modify the passed transaction so it points to the previous transaction
    // Also, the transaction will be uploaded, shared
    this.uploadTransactionAfter = function (transaction, linkToTransactionBefore) {
        var manager = this;
        function uploadAndShare(t) {
            var filename;
            return manager.findAFreeTransactionFileName().then(function(path) {
                filename = path;
                return manager.linkFactory.uploadAndShare(manager.cloudStorage, filename, t.exportToString());
            });
        }


        if (linkToTransactionBefore != null) {
            transaction.previousTransactionLink = decodeAscii(linkToTransactionBefore.encode());
            return linkToTransactionBefore.retrieve().then(function (transactionContents) {
                var contentsStringified = decodeAscii(transactionContents);
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

            return manager.uploadTransactionAfter(transaction, manager.currentLastTransactionLink).then(function (accessor) {
                manager.currentChain.push(transaction);
                var newDBState = (manager.currentDBs.length > 0 ?
                    manager.currentDBs[manager.currentDBs.length - 1].clone() : new DB());
                transaction.applyOn(newDBState);
                manager.currentDBs.push(newDBState);
                manager.addTransactionTree(transaction);
                return manager.setNewLastTransaction(accessor);
            }).then(function () {
                return Promise.resolve();
            });
        });
    };
};

// information about a given Event
var EventInfo = function(eventCode, eventParams, eventId) {
    this.code = eventCode;
    this.params = eventParams;
    this.id = eventId;
    this.condition = function(transactionChain, currentStateOfDb) {
        throw new AbstractMethodCallError("Called an abstract method", "EventInfo");
    };
    this.applyOn = function(dbState) {
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
        // TODO: either remove this line or add vector clocks later
        hashedString += this.timestamp;
        // I kept the murmur hash, because I don't like that crypto uses promises for everything
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

};

Transaction.compareTimeStamps = function (t1, t2) {
    if (t1.timestamp != t2.timestamp) {
        if (t1.timestamp == null)
            return 1;
        else if (t2.timestamp == null)
            return -1;
        return t1.timestamp - t2.timestamp;
    }
    return 0;
};

Transaction.compareOwners = function (t1, t2) {
    if (t1.owner < t2.owner)
        return -1;
    else
    if (t1.owner == t2.owner)
        return 0;
    else
        return 1;
};

Transaction.sortTransactions = function (transactions) {
    // if we have any transactions in which timestamps do not agree
    // with the initial indices, then we need to fix it
    var bucketsByOwners = sortBuckets([transactions], Transaction.compareOwners);
    for (var i = 0; i < bucketsByOwners.length; ++i) {
        var bucket = bucketsByOwners[i];

        for (var j = 0; j < bucket.length; ++j) {
            for (var k = 0; k < bucket.length; ++k) {
                if (j == k)
                    continue;
                else {
                    if (bucket[j].owner == bucket[k].owner && bucket[j].initialIndex <= bucket[k].initialIndex) {
                        if (bucket[j].timestamp > bucket[k].timestamp)
                            bucket[j].timestamp = bucket[k].timestamp;
                    }
                }
            }
        }
    }

    // sort in order
    return combinedSort(transactions, Transaction.compareTimeStamps, Transaction.compareOwners,
        function(t1,t2) {
            // compare initial indices
            return t1.initialIndex - t2.initialIndex;
        });
};

Transaction.retrieveLast = function(lastPointer) {
    return lastPointer.retrieve().then(function(fileContents) {
        return Promise.resolve(Transaction.fromString(decodeA(fileContents)));
    });
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

// This class will store the state of the task database
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
    // this method checks if it is possible to apply this event to the database
    this.condition = function(transactionChain, dbState) {
        var event = this;
        return (dbState.tasks.findIndex(function(t) { return t.id == event.id; }) == -1);
    };
    // this method indicates how this task affects the database
    this.applyOn = function(db) {
        db.tasks.push(new Task(this.params.name, this.id));
    };
};
TaskCreatedEvent.prototype = EventInfo.prototype;

var TaskCompletedEvent = function(userId, taskId) {
    EventInfo.call(this);
    this.code = "task_complete";
    this.params = {userId: userId, taskId: taskId};
    this.applyOn = function(db) {
        var event = this;
        var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
        if (taskIndex == -1)
            throw new NotFoundError("The task cannot be completed, since it does not exist");
        else {
            if (db.tasks[taskIndex].completedBy != null) {
                throw new Error("the task has already been completed");
            } else {
                db.tasks[taskIndex].completedBy = this.params.userId;
            }
        }
    };

    this.condition = function(chain, db) {
        var event = this;
        var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
        if (taskIndex == -1)
            return false;
        else {
            return db.tasks[taskIndex].completedBy == null;
        }
    };
};
TaskCompletedEvent.prototype = EventInfo.prototype;


var TaskRemovedEvent = function(taskId) {
    EventInfo.call(this);
    this.code = "task_remove";
    this.params = {id: taskId};
    this.applyOn = function(db) {
        var event = this;
        var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
        if (taskIndex == -1)
            throw new NotFoundError("The task cannot be removed, since it does not exist");
        else {
            db.tasks.splice(taskIndex,1);
        }
    };

    this.condition = function(chain, db) {
        var event = this;
        var taskIndex = db.tasks.findIndex(function(t) { return t.id == event.params.taskId; });
        return taskIndex != -1;
    };
};
TaskRemovedEvent.prototype = EventInfo.prototype;

function EventFactory(jsonObject) {
    var e;
    switch (jsonObject.code) {
        case "task_remove":
            e = new TaskRemovedEvent();
            break;
        case "task_create":
            e = new TaskCreatedEvent();
            break;
        case "task_complete":
            e = new TaskCompletedEvent();
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

// var DB = function(cloud, teamCatalog, userId) {
//     this.treePart = null;
//     this.chainPart = null;
//
//     this.cloud = cloud;
//     this.teamCatalog = teamCatalog;
//     this.userId = userId;
//     this.transactionManager = new TransactionManager(cloud, teamCatalog, userId);
//
//     this.loadFromCloud = function() {
//         return this.transactionManager.initialize();
//     };
//     this.loadFromCloud();
//
//     this.buildTreeIndex = function(owner, initialIndex) {
//         return '' + initialIndex + ':' + owner;
//     };
//
//     this.findTransaction = function(owner, initialIndex) {
//         var tree_lookup = this.treePart.get(this.buildTreeIndex(owner, initialIndex));
//         if (tree_lookup != null)
//             return tree_lookup;
//
//         for (var i = 0; i < this.chainPart.length; ++i) {
//             if (t.owner == owner && t.initialIndex == initialIndex)
//                 return t;
//         }
//     };
//
//     this.query = function(query) {
//
//     };
// };
//
// DB.new = function()
// {
//     return { next_entity_id: 0, txns: [] };
// };
//
// DB.new_entity = function( db )
// {
//     var rv = db.next_entity_id;
//     db.next_entity_id++;
//     return rv;
// };
//
// DB.build_datom = function( e, a, v )
// {
//     return { e:e, a:a, v:v };
// };
//
// DB.build_txn = function( conditions, datoms )
// {
//     return { conditions: conditions, datoms: datoms };
// };
//
// DB.apply_txn = function( db, txn )
// {
//     /* XXX check conditions */
//     db.txns = db.txns.concat( txn );
// };
//
// DB.query = function( db, q )
// {
//     var datoms = [];
//     function eatTxns( txn, i )
//     {
//         function eatDatoms( datom, j )
//         {
//             if( datom.a.startsWith( q ) )
//             {
//                 datoms.push( datom );
//             }
//         }
//         txn.datoms.map( eatDatoms );
//     }
//     db.txns.map( eatTxns );
//     return datoms;
// };
