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

var SFS = new SimpleFileServer("Janet");

var FSBPlusTree = function(fileSystemTreeOrder, memoryTreeOrder) {
    this.memoryTree = new BPlusTree(memoryTreeOrder);
    this.root = new fsLeafNode(order);
    this.insert = function(key, value) {
        return this.root.insert(key, value).then(function(result){
            if (result == null)
                return Promise.resolve(null); // no changes
            if (result.getKeysCount() > result.maxValues) {
                return result.split().then(function(splitTree) {
                    var newRoot = new fsBranchNode(result.maxChildren);
                    newRoot.keys = [splitTree.separator];
                    var savePromises = [splitTree.left.save(), splitTree.right.save()];
                    return Promise.all(savePromises).then(function(leftLink, rightLink) {
                        newRoot.children = [leftLink, rightLink];
                        return newRoot.save();
                    }).then(function(link) {
                        return Promise.resolve(FSBPlusTree.fromRoot(link, newRoot));
                    });
                });
            } else {
                return result.save().then(function (link) {
                    return Promise.resolve(FSBPlusTree.fromRoot(link, result));
                });
            }
        });
    };

    this.get = function(key) {
        return this.root.get(key, null);
    };

    this.remove = function(key) {
        var result = this.root.remove(key);
        if (result == null)
            return null; // no changes
        if (result.keys && result.keys.length == 0) {
            return FSBPlusTree.fromRoot(result.children[0]);
        } else {
            return FSBPlusTree.fromRoot(result);
        }
    };
};

FSBPlusTree.fromRoot = function(link, root) {
    var newTree = new FSBPlusTree(root.maxChildren);
    newTree.root = root;
    newTree.link = link;
    return newTree;
};

var fsBPTreeStructure = function (order) {
    this.maxChildren = order;
    this.maxValues = order-1;
    this.minValues = Math.floor(this.maxValues/2);
    this.children = null;
    this.linkFactory = new SharedFileFactory();

    this.insert = function(key, value) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.find = function(key) {
        throw new AbstractMethodCallError("Called an abstract method", "fsBPTreeStructure");
    };

    this.get = function(key) {
        var position = this.find(key);
        if (position.index == null)
            return null;
        else
            return position.leaf.keyValuePairs[position.index].value;
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

    this.save = function() {
        var toSave = this.serialize();
        var path = "treeNode";
        return findFreeFileName(SFS, path, "").then(function(path) {
            return SFS.uploadTextFile(toSave, path);
        }).then(function() {
            return SFS.shareFile(path);
        })
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
        var fileLink = children[index];
        return fileLink.retrieve().then(function(contents){
            var node = fsBPTreeStructure.decodeTreeNode(contents);
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
            var newBranch = thisNode.clone();
            if (newChild.getKeysCount() > newChild.maxValues) {
                return newChild.split().then(function(splitChild){
                    var savePromises = [splitChild.left.save(), splitChild.right.save()];
                    return Promise.all(savePromises).then(function(left_link, right_link){
                        newBranch.children.splice(index, 1, left_link, right_link);
                        newBranch.keys.splice(index, 0, splitChild.separator);
                        return Promise.resolve(newBranch);
                    });                    
                });
            } else {
                return newChild.save().then(function(link) {
                    newBranch.children[index] = link;
                    return Promise.resolve(newBranch);
                });                
            }
        })
    };

    this.getKey = function(index) {
        return this.keys[index];
    };

    this.remove = function(key) {
        var index = this.findSpot(key);
        if (index.found)
            index.index++;
        index = index.index;

        var newChild = this.children[index].remove(key);

        if (newChild == null)
            return null; // no changes

        var newBranch = this.clone();

        newBranch.children[index] = newChild;
        if (newChild.getKeysCount() < newChild.minValues) {
            if (newChild.children == null) {
                newBranch.fixChildlessChildUnderflow(newChild, index);
            } else {
                newBranch.fixChildbearingChildUnderflow(newChild, index);
            }
        }

        return newBranch;
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
        var fixed = false;
        if (index != 0) {
            var previousChild = this.children[index - 1];
            if (previousChild.keyValuePairs.length > this.minValues) {
                previousChild = previousChild.clone();
                this.children[index-1] = previousChild;
                var lastValue = previousChild.keyValuePairs.splice(previousChild.keyValuePairs.length - 1, 1)[0];
                child.keyValuePairs.unshift(lastValue);
                this.keys[index - 1] = lastValue.key;
                fixed = true;
            }
        }

        if (!fixed) {
            if (index != this.keys.length) {
                var nextChild = this.children[index + 1];
                if (nextChild.keyValuePairs.length > this.minValues) {
                    nextChild = nextChild.clone();
                    this.children[index+1] = nextChild;
                    var firstValue = nextChild.keyValuePairs.splice(0, 1)[0];
                    child.keyValuePairs.push(firstValue);
                    this.keys[index] = nextChild.keyValuePairs[0].key;
                    fixed = true;
                }
            }
        }

        if (!fixed) {
            // merge
            if (index != 0) {
                var previousChild = this.children[index-1].clone();
                this.children[index-1] = previousChild;
                this.keys.splice(index-1, 1);
                previousChild.keyValuePairs = previousChild.keyValuePairs.concat(
                    this.children.splice(index, 1)[0].keyValuePairs);
            } else {
                var nextChild = this.children[index+1].clone();
                this.children[index+1] = nextChild;
                this.keys.splice(index, 1)[0];
                nextChild.keyValuePairs = this.children.splice(index, 1)[0].keyValuePairs.concat(
                    nextChild.keyValuePairs);
            }
        }
    };

    this.fixChildbearingChildUnderflow = function(child, index) {
        var fixed = false;
        if (index != 0) {
            var previousChild = this.children[index-1];
            if (previousChild.keys.length > this.minValues) {
                previousChild = previousChild.clone();
                this.children[index - 1] = previousChild;
                var lastValue = previousChild.keys.splice(previousChild.keys.length - 1, 1)[0];
                var lastChild = previousChild.children.splice(previousChild.children.length - 1, 1)[0];
                child.keys.unshift(this.keys[index-1]);
                child.children.unshift(lastChild);
                this.keys[index-1] = lastValue;
                fixed = true;
            }
        }

        if (!fixed) {
            if (index != this.keys.length) {
                var nextChild = this.children[index + 1];
                if (nextChild.keys.length > this.minValues) {
                    nextChild = nextChild.clone();
                    this.children[index + 1] = nextChild;
                    var firstValue = nextChild.keys.splice(0, 1)[0];
                    var firstChild = nextChild.children.splice(0,1)[0];
                    child.keys.push(this.keys[index]);
                    child.children.push(firstChild);
                    this.keys[index] = firstValue;
                    fixed = true;
                }
            }
        }

        if (!fixed) {
            // merge
            if (index != 0) {
                var previousChild = this.children[index-1].clone();
                this.children[index-1] = previousChild;
                var separatingValue = this.keys.splice(index-1, 1)[0];
                previousChild.keys.push(separatingValue);
                previousChild.keys = previousChild.keys.concat(child.keys);
                previousChild.children = previousChild.children.concat(child.children);
            } else {
                var nextChild = this.children[index+1].clone();
                this.children[index+1] = nextChild;
                var separatingValue = this.keys.splice(index, 1)[0];
                nextChild.keys.unshift(separatingValue);
                nextChild.keys = child.keys.concat(nextChild.keys);
                nextChild.children = child.children.concat(nextChild.children);
            }
            this.children.splice(index, 1);
        }
    };

    this.fixChildUnderflow = function(child) {
        var index;
        for (index = 0; index < this.children.length; ++index) {
            if (this.children[index] == child)
                break;
        }

        if (child.children == null) {
            this.fixChildlessChildUnderflow(child, index);
        } else {
            this.fixChildbearingChildUnderflow(child, index);
        }
    };
    
    this.serialize = function() {
        var json = {keys: this.keys, order: this.maxChildren, children: [] };
        for (var i = 0; i < this.children.length; ++i) {
            json.children[i] = this.children[i].encode();
        }
        return JSON.stringify(json);
    };
};
fsBranchNode.prototype = fsBPTreeStructure.prototype;

fsBranchNode.fromSerialized = function(serializedData) {
    var newBranch = new fsBranchNode(serializedData.order);
    var dataSource = JSON.parse(serializedData);
    newBranch.keys = dataSource.keys;
    newBranch.children = [];
    for (var i = 0; i < dataSource.children.length; ++i) {
        newBranch.children = linkFactory.createFromBytes(dataSource.children[i]);
    }
    return newBranch;
};

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
            return { leaf: this, index: spot.index };
        else
            return { leaf: this, index: null };
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
        var newLeaf = this.clone();
        newLeaf.keyValuePairs.splice(location.index, 0, new KeyValuePair(key, value));

        return Promise.resolve(newLeaf);
    };

    this.remove = function(key) {
        var location = this.findSpot(key);
        if (!location.found) {
            return null; // no change
        }
        var newLeaf = this.clone();
        newLeaf.keyValuePairs.splice(location.index, 1);
        return newLeaf;
    };

    this.serialize = function() {
        return JSON.stringify(this);
    };
};
fsLeafNode.fromSerialized = function(serializedData) {
    var dataSource = JSON.parse(serializedData);
    var newBranch = new fsLeafNode(serializedData.maxChildren);
    newBranch.keyValuePairs = dataSource.keyValuePairs;
    return newBranch;
};

fsLeafNode.prototype = fsBPTreeStructure.prototype;