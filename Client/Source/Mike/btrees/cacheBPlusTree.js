function binarySearch(treeStructure, key, startIndex, lastIndex) {
    if (startIndex == lastIndex) {
        if (treeStructure.getKey(startIndex) == key)
            return { index: startIndex, found: true };
        else if (treeStructure.getKey(startIndex) > key)
            return { index: startIndex, found: false };
        else
            return { index: startIndex+1, found: false };
    }
    var midIndex = Math.floor((lastIndex - startIndex + 1)/2) + startIndex;
    if (treeStructure.getKey(midIndex) == key)
        return { index: midIndex, found: true };
    else if (treeStructure.getKey(midIndex) > key) {
        if (startIndex == midIndex)
            return binarySearch(treeStructure, key, startIndex, midIndex);
        return binarySearch(treeStructure, key, startIndex, midIndex-1);
    } else {
        if (lastIndex == midIndex)
            return binarySearch(treeStructure, key, midIndex, lastIndex);
        return binarySearch(treeStructure, key, midIndex+1, lastIndex);
    }
}

var changeEntry = {
    node: null,
    apply: function() {
        throw new AbstractMethodCallError("Called an abstract method", "changeEntry");
    }
};

var saveEntry = function(node) {
    this.node = node;

    this.apply = function() {
        var linkFactory = new SharedFileFactory();
        var cloud = SFS;
        var thisNode = this.node;
        var toSave = this.node.serialize();
        var path = "treeNode";
        return Promise.resolve().then(function() {
            if (thisNode.link == null) {
                return findFreeFileName(cloud, path, "").then(function (path) {
                    return linkFactory.uploadAndShare(cloud, path, toSave);
                });
            } else {
                return linkFactory.uploadAndShare(cloud, thisNode.link.path, toSave);
            }
        }).then(function (link) {
            thisNode.link = link;
            return Promise.resolve();
        });
    }
};

var removeEntry = function(node) {
    this.node = node;

    this.apply = function() {
        cloud = SFS;
        return cloud.removeFile(this.node.link.path);
    }
};

var changeLog = function(previous) {
    if (previous == null)
        previous = null;
    this.changes = [];
    this.previous = previous;

    this.flattenChanges = function(changes) {
        var fromLast = 1;
        var currentIndex = changes.length - fromLast;
        while (currentIndex >= 0) {
            var change = changes[currentIndex];
            var thisRemoved = false;
            var node = change.node;
            for (var j = currentIndex-1; j >= 0; --j) {
                if (changes[j].node == node) {
                    var removedChange = changes[j];
                    if (removedChange instanceof saveEntry) {
                        if (removedChange.link == null && change instanceof removeEntry && !thisRemoved) {
                            // if this is a new node that has to be deleted afterwards, we don't want to create it
                            // or remove it
                            changes.splice(currentIndex, 1);
                        }
                    }
                    changes.splice(j, 1);
                }
            }
            currentIndex = changes.length - fromLast;
        }
    };

    this.addChange = function(change) {
        this.changes.push(change);
    };

    this.process = function() {
        function retrieveAll(changeLog) {
            var changes = [];
            if (changeLog.previous != null) {
                changes = retrieveAll(changeLog.previous).concat(changes);
            }
            changes = changes.concat(changeLog.changes);
            changeLog.changes = [];
            return changes;
        }
        var changes = this.flattenChanges(retrieveAll(this));

        return promiseLoop(changes.map(function(change) { return function() { change.apply() }; }));
    }
};

var SFS = new SimpleFileServer("Janet");
var FSBPlusTree = function(order) {
    this.root = new fsLeafNode(order);
    this.changeLog = new changeLog();

    this.prepareRoot = function() {
        var thisNode = this;
        return Promise.resolve().then(function() {
            if (thisNode.root instanceof unresolvedNode)
                return thisNode.root.resolve().then(function(node) { thisNode.root = node; });
            else
                return Promise.resolve();
        })
    };

    this.insert = function(key, value) {
        var thisNode=this;
        return this.prepareRoot().then(function() {
            return thisNode.root.insert(key, value).then(function (result) {
                if (result == null) {
                    return Promise.resolve(null); // no changes
                }
                if (result.getKeysCount() > result.maxValues) {
                    var newRoot = new fsBranchNode(result.maxChildren);
                    return result.removeFile().then(function () {
                        return result.split();
                    }).then(function (splitChild) {
                        newRoot.keys = [splitChild.separator];
                        newRoot.children = [splitChild.left, splitChild.right];
                        var savePromises = [splitChild.left.save(), splitChild.right.save()];
                        return Promise.all(savePromises).then(function () {
                            return newRoot.save();
                        }).then(function () {
                            thisNode.root = newRoot;
                            return Promise.resolve(newRoot);
                        });
                    });
                } else {
                    return result.save().then(function () {
                        return Promise.resolve(result);
                    });
                }
            });
        });
    };

    this.get = function(key) {
        var thisTree = this;
        if (!(this.root instanceof unresolvedNode))
            return this.root.get(key, null);
        return this.root.resolve().then(function(node) {
            // cache the root
            thisTree.root = node;
            return node.get(key, null);
        });
    };

    this.remove = function(key) {
        var thisNode = this;
        return this.prepareRoot().then(function() {
            return thisNode.root.remove(key).then(function(result){
                if (result == null)
                    return Promise.resolve(null); // no changes
                if (result.keys && result.keys.length == 0) {
                    return thisNode.root.removeFile().then(function() {
                        thisNode.root = result.children[0];
                        return Promise.resolve(true);
                    });
                } else if (result.keyValuePairs && result.keyValuePairs.length == 0) {
                    return thisNode.root.removeFile().then(function() {
                        return Promise.resolve(true);
                    });
                } else {
                    return Promise.resolve(true);
                }
            });
        });
    };
};

FSBPlusTree.fromRoot = function(root) {
    var newTree = new FSBPlusTree(5); // we can use any number, since it will be replaced by the new root
    newTree.root = root;
    return newTree;
};

var fsBPTreeStructure = function (order, link) {
    this.maxChildren = order;
    this.maxValues = order-1;
    this.minValues = Math.floor(this.maxValues/2);
    this.children = null;
    this.link = link;
    this.owner = null;

    this.insert = function(key, value) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.find = function(key) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.get = function(key) {
        return this.find(key).then(function(position) {
            if (position.index == null)
                return Promise.resolve(null);
            else
                return Promise.resolve(position.leaf.keyValuePairs[position.index].value);
        });
    };

    this.getKey = function(index) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.getKeysCount = function() {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.remove = function(key) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.serialize = function() {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.removeFile = function(cloud) {

    };

    this.save = function(linkFactory, cloud) {

    }
};

fsBPTreeStructure.decodeTreeNode = function (contents) {
    if (JSON.parse(contents).keys != null)
        return fsBranchNode.fromSerialized(contents);
    else
        return fsLeafNode.fromSerialized(contents);
};

var fsBranchNode = function(order) {
    // call base constructor
    fsBPTreeStructure.call(this, order);
    this.keys = [];
    this.children = [];

    this.retrieveChild = function(index) {
        var children = this.children;
        var childNode = this.children[index];
        if (! (childNode instanceof unresolvedNode)) {
            return Promise.resolve(childNode);
        }
        return childNode.resolve().then(function(node) {
            // cache the child
            children[index] = node;
            return Promise.resolve(node);
        });
    };

    this.getKeysCount = function() {
        return this.keys.length;
    };


    this.clone = function() {
        var clone = new fsBranchNode(this.maxChildren);
        for (var i = 0; i < this.keys.length; ++i) {
            clone.keys[i] = this.keys[i];
        }
        for (var i = 0; i < this.children.length; ++i) {
            clone.children[i] = this.children[i];
        }
        return clone;
    };

    this.insert = function(key, value) {
        var thisNode = this;

        var index = this.findSpot(key);
        if (index.found)
            index.index++;
        index = index.index;

        return this.retrieveChild(index).then(function(child) {
            return child.insert(key, value);
        }).then(function(newChild) {
            if (newChild == null) {
                return Promise.resolve(null); // no changes
            }
            if (newChild.getKeysCount() > newChild.maxValues) {
                return newChild.removeFile().then(function() {
                    return newChild.split();
                }).then(function(splitChild){
                    var savePromises = [splitChild.left.save(), splitChild.right.save()];
                    return Promise.all(savePromises).then(function(){
                        thisNode.children.splice(index, 1, splitChild.left, splitChild.right);
                        thisNode.keys.splice(index, 0, splitChild.separator);
                        return Promise.resolve(thisNode);
                    });
                });
            } else {
                return newChild.save().then(function() {
                    return Promise.resolve(thisNode);
                });                
            }
        });
    };

    this.getKey = function(index) {
        return this.keys[index];
    };

    this.remove = function(key) {
        var index = this.findSpot(key);
        if (index.found)
            index.index++;
        index = index.index;

        var thisNode = this;

        return this.retrieveChild(index).then(function(child) {
            return child.remove(key).then(function(result){
                if (result == null)
                    return Promise.resolve(null); // no changes

                if (child.getKeysCount() < child.minValues) {
                    if (child.children == null) {
                        return thisNode.fixChildlessChildUnderflow(child, index);
                    } else {
                        return thisNode.fixChildbearingChildUnderflow(child, index);
                    }
                } else {
                    return child.save().then(function() { return Promise.resolve(true);});
                }
            })
        });
    };

    this.findSpot = function(key) {
        if (this.keys.length < 1)
            return { index: 0, found: false };
        return binarySearch(this, key, 0, this.keys.length-1);
    };

    this.find = function(key) {
        var spot = this.findSpot(key);
        if (spot.found)
            spot.index++;

        return this.retrieveChild(spot.index).then(function(child) {
            return child.find(key);
        });
    };

    this.split = function() {
        var halfLength = Math.floor(this.keys.length/2);

        var leftTree = new fsBranchNode(this.maxChildren);
        var rightTree = new fsBranchNode(this.maxChildren);

        leftTree.keys = this.keys.splice(0, halfLength);
        var medianKey = this.keys.splice(0,1)[0];
        rightTree.keys = this.keys.splice(0);

        leftTree.children = this.children.splice(0, halfLength + 1);
        rightTree.children = this.children.splice(0);

        return { separator: medianKey, left: leftTree, right: rightTree };
    };

    this.fixChildlessChildUnderflow = function(child, index) {
        var thisNode = this;
        var fixed = false;
        return Promise.resolve().then(function(){
            if (index != 0) {
                return thisNode.retrieveChild(index-1).then(function(previousChild) {
                    if (previousChild.keyValuePairs.length > previousChild.minValues) {
                        var lastValue = previousChild.keyValuePairs.splice(previousChild.keyValuePairs.length - 1, 1)[0];
                        child.keyValuePairs.unshift(lastValue);
                        thisNode.keys[index - 1] = lastValue.key;
                        fixed = true;
                        return Promise.all([child.save(), previousChild.save(), thisNode.save()]);
                    }
                    return Promise.resolve();
                });
            }
            return Promise.resolve();
        }).then(function() {
            if (!fixed) {
                if (index != thisNode.keys.length) {
                    return thisNode.retrieveChild(index+1).then(function(nextChild) {
                        if (nextChild.keyValuePairs.length > nextChild.minValues) {
                            var firstValue = nextChild.keyValuePairs.splice(0, 1)[0];
                            child.keyValuePairs.push(firstValue);
                            thisNode.keys[index] = nextChild.keyValuePairs[0].key;
                            fixed = true;
                            return Promise.all([child.save(), nextChild.save(), thisNode.save()]);
                        }
                        return Promise.resolve();
                    });
                }
            }
            return Promise.resolve();
        }).then(function() {
            if (!fixed) {
                // merge
                if (index != 0) {
                    return thisNode.retrieveChild(index-1).then(function(previousChild) {
                        thisNode.keys.splice(index - 1, 1);
                        previousChild.keyValuePairs = previousChild.keyValuePairs.concat(
                            child.keyValuePairs);
                        thisNode.children.splice(index, 1);

                        return Promise.all([child.removeFile(), previousChild.save(), thisNode.save()] );
                    });
                } else {
                    return thisNode.retrieveChild(index+1).then(function(nextChild) {
                        thisNode.keys.splice(index, 1);
                        nextChild.keyValuePairs = child.keyValuePairs.concat(
                            nextChild.keyValuePairs);
                        thisNode.children.splice(index, 1);

                        return Promise.all([child.removeFile(), nextChild.save(), thisNode.save()]);
                    });
                }
            }
            return Promise.resolve();
        }).then(function() {
            return Promise.resolve(thisNode);
        });
    };

    this.fixChildbearingChildUnderflow = function(child, index) {
        var fixed = false;
        var thisNode = this;
        return Promise.resolve().then(function(){
            if (index != 0) {
                return thisNode.retrieveChild(index-1).then(function(previousChild) {
                    if (previousChild.keys.length > previousChild.minValues) {
                        var lastValue = previousChild.keys.splice(previousChild.keys.length - 1, 1)[0];
                        var lastChild = previousChild.children.splice(previousChild.children.length - 1, 1)[0];
                        child.keys.unshift(thisNode.keys[index - 1]);
                        child.children.unshift(lastChild);
                        thisNode.keys[index - 1] = lastValue;
                        fixed = true;
                        return Promise.all([thisNode.save(), child.save(), previousChild.save()]);
                    }
                    return Promise.resolve();
                });
            }
            return Promise.resolve();
        }).then(function() {
            if (!fixed) {
                if (index != thisNode.keys.length) {
                    return thisNode.retrieveChild(index+1).then(function(nextChild) {
                        if (nextChild.keys.length > nextChild.minValues) {
                            var firstValue = nextChild.keys.splice(0, 1)[0];
                            var firstChild = nextChild.children.splice(0, 1)[0];
                            child.keys.push(thisNode.keys[index]);
                            child.children.push(firstChild);
                            thisNode.keys[index] = firstValue;
                            fixed = true;
                            return Promise.all([thisNode.save(), child.save(), nextChild.save()]);
                        }
                        return Promise.resolve();
                    });
                }
            }
            return Promise.resolve();
        }).then(function() {
            if (!fixed) {
                // merge
                return Promise.resolve().then(function() {
                    if (index != 0) {
                        return thisNode.retrieveChild(index-1).then(function(previousChild) {
                            var separatingValue = thisNode.keys.splice(index - 1, 1)[0];
                            previousChild.keys.push(separatingValue);
                            previousChild.keys = previousChild.keys.concat(child.keys);
                            previousChild.children = previousChild.children.concat(child.children);
                            return Promise.all([previousChild.save(), child.removeFile()]);
                        });
                    } else {
                        return thisNode.retrieveChild(index+1).then(function(nextChild) {
                            var separatingValue = thisNode.keys.splice(index, 1)[0];
                            nextChild.keys.unshift(separatingValue);
                            nextChild.keys = child.keys.concat(nextChild.keys);
                            nextChild.children = child.children.concat(nextChild.children);
                            return Promise.all([nextChild.save(), child.removeFile()]);
                        });
                    }
                }).then(function() {
                    thisNode.children.splice(index, 1);
                    return thisNode.save();
                });
            }
        }).then(function() {
            return Promise.resolve(thisNode);
        });
    };

    this.fixChildUnderflow = function(child) {
        var index;
        for (index = 0; index < this.children.length; ++index) {
            if (this.children[index] == child)
                break;
        }

        if (child.children == null) {
            return this.fixChildlessChildUnderflow(child, index);
        } else {
            return this.fixChildbearingChildUnderflow(child, index);
        }
    };
    
    this.serialize = function() {
        var json = {keys: this.keys, order: this.maxChildren, children: [] };
        for (var i = 0; i < this.children.length; ++i) {
            json.children[i] = decodeA(this.children[i].link.encode());
        }
        return 'B'+JSON.stringify(json);
    };
};

setInheritance(fsBranchNode, fsBPTreeStructure);

fsBranchNode.fromText = function(serializedData, link) {
    var linkFactory = new SharedFileFactory();
    var dataSource = JSON.parse(serializedData);
    var newBranch = new fsBranchNode(dataSource.order);
    newBranch.keys = dataSource.keys;
    newBranch.link = link;
    newBranch.children = [];
    for (var i = 0; i < dataSource.children.length; ++i) {
        newBranch.children.push(new unresolvedNode(linkFactory.createFromBytes(encodeA(dataSource.children[i]))));
    }
    return newBranch;
};

var unresolvedNode = function(link) {
    this.link = link;

    this.resolve = function() {
        var link = this.link;
        return this.link.retrieve().then(function(fileContents) {
            var stringContents = decodeA(fileContents);
            var type = stringContents[0];
            stringContents = stringContents.substr(1);
            switch (type) {
                case 'L':
                    // leaf
                    return Promise.resolve(fsLeafNode.fromText(stringContents, link));
                    break;
                case 'B':
                    // branch
                    return Promise.resolve(fsBranchNode.fromText(stringContents, link));
                    break;
            }
        });
    }
};
setInheritance(unresolvedNode, fsBPTreeStructure);

var fsLeafNode = function(order) {
    // call base constructor
    fsBPTreeStructure.call(this, order);

    var KeyValuePair = function(key, value) {
        this.key = key;
        this.value = value;
    };
    this.keyValuePairs = [];

    this.getKeysCount = function() {
        return this.keyValuePairs.length;
    };

    this.getKey = function(index) {
        return this.keyValuePairs[index].key;
    };

    this.clone = function() {
        var newLeaf = new fsLeafNode(this.maxChildren);
        for (var i = 0; i < this.keyValuePairs.length; ++i) {
            newLeaf.keyValuePairs[i] = this.keyValuePairs[i];
        }
        return newLeaf;
    };

    this.split = function() {
        var halfLength = Math.floor(this.keyValuePairs.length/2);

        var leftLeaf = new fsLeafNode(this.maxChildren);
        var rightLeaf = new fsLeafNode(this.maxChildren);

        leftLeaf.keyValuePairs = this.keyValuePairs.splice(0, halfLength);
        var medianKey = this.keyValuePairs[0].key;
        rightLeaf.keyValuePairs = this.keyValuePairs.splice(0);

        return { left: leftLeaf, separator: medianKey, right: rightLeaf };
    };

    this.find = function(key) {
        var spot = this.findSpot(key);
        if (spot.found)
            return Promise.resolve({ leaf: this, value: this.keyValuePairs[spot.index].value, index: spot.index });
        else
            return Promise.resolve({ leaf: this, index: null });
    };

    this.findSpot = function(key) {
        if (this.keyValuePairs.length < 1)
            return { index: 0, found: false };
        return binarySearch(this, key, 0, this.keyValuePairs.length-1);
    };

    this.insert = function(key, value) {
        var location = this.findSpot(key);
        if (location.found) {
            return null; // no change
        }
        this.keyValuePairs.splice(location.index, 0, new KeyValuePair(key, value));

        return Promise.resolve(this);
    };

    this.remove = function(key) {
        var location = this.findSpot(key);
        if (!location.found) {
            return Promise.resolve(null); // no change
        }
        this.keyValuePairs.splice(location.index, 1);
        return Promise.resolve(true);
    };

    this.serialize = function() {
        return 'L'+JSON.stringify(this);
    };
};
fsLeafNode.fromText = function(serializedData, link) {
    var dataSource = JSON.parse(serializedData);
    var newBranch = new fsLeafNode(dataSource.order);
    newBranch.keyValuePairs = dataSource.keyValuePairs;
    newBranch.link = link;
    return newBranch;
};

setInheritance(fsLeafNode, fsBPTreeStructure);