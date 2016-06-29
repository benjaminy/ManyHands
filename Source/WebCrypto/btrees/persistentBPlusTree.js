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

var BPlusTree = function(order) {
    this.linkFactory = new SharedFileFactory();
    this.root = new leafNode(order);
    this.insert = function(key, value) {
        var result = this.root.insert(key, value, null);
        if (result == null)
            return null; // no changes
        if (result.getKeysCount() > result.maxValues) {
            var splitTree = result.split();
            var newRoot = new branchNode(result.maxChildren);
            newRoot.keys = [splitTree.separator];
            newRoot.children = [splitTree.left, splitTree.right];
            return BPlusTree.fromRoot(newRoot);
        } else {
            return BPlusTree.fromRoot(result);
        }
    };
    
    this.getFirst = function() {
        function returnFirst(node) {
            if (node.children != null) {
                return returnFirst(node.children[0]);
            } else {
                if (node.keyValuePairs.length == 0)
                    return null;
                return node.keyValuePairs[0].value;
            }
        }
        return returnFirst(this.root);
    };

    this.getLast = function() {
        function returnLast(node) {
            if (node.children != null) {
                return returnFirst(node.children[node.children.length - 1]);
            } else {

                if (node.keyValuePairs.length == 0)
                    return null;
                return node.keyValuePairs[node.keyValuePairs.length - 1].value;
            }
        }
        return returnLast(this.root);
    };
    
    this.get = function(key) {
        return this.root.get(key, null);
    };

    this.remove = function(key) {
        var result = this.root.remove(key);
        if (result == null)
            return null; // no changes
        if (result.keys && result.keys.length == 0) {
            return BPlusTree.fromRoot(result.children[0]);
        } else {
            return BPlusTree.fromRoot(result);
        }
    };

    this.retrieveAllKeyValuePairs = function() {
        function retrieveKeyValuePairs(treeNode) {
            if (treeNode.children == null) {
                return treeNode.keyValuePairs;
            } else {
                var output = [];
                for (var i = 0; i < treeNode.children.length; ++i) {
                    output = output.concat(retrieveKeyValuePairs(treeNode.children[i]));
                }
                return output;
            }
        }
        
        return retrieveKeyValuePairs(this.root);
    };

    this.withADifferentB = function (differentB) {
        var keyValuePairs = this.retrieveAllKeyValuePairs();
        var newBTree = new BPlusTree(differentB);
        for (var i = 0; i < keyValuePairs.length; ++i) {
            newBTree = newBTree.insert(keyValuePairs[i].key, keyValuePairs[i].value);
        }
        return newBTree;
    };

    this.saveToCloud = function (cloud, base_path) {
        var linkFactory = this.linkFactory;
        function uploadNode(node) {
            if (node.children == null) {
                var json = { order: node.maxChildren, keyValuePairs: node.keyValuePairs };

                return findFreeFileName(cloud, base_path+'tree_node_', '').then(function(path) {
                    return linkFactory.uploadAndShare(cloud, path, 'L'+JSON.stringify(json));
                });
            } else {
                var json = { order: node.maxChildren, keys: node.keys, children: [] };
                var promises = [];
                for (var i = 0; i < node.children.length; ++i) {
                    promises.push(uploadNode(node.children[i]));
                }

                return Promise.all(promises).then(function(childrenLinks) {
                    for (var i = 0; i < childrenLinks.length; ++i) {
                        json.children[i] = decodeA(childrenLinks[i].encode());
                    }
                    return findFreeFileName(cloud, base_path + 'tree_node_', '')
                }).then(function(path) {
                    return linkFactory.uploadAndShare(cloud, path, 'B'+JSON.stringify(json));
                });
            }
        }
        return uploadNode(this.root);
    };

};

BPlusTree.readFromCloud = function(link, linkFactory) {
    function retrieveNode(nodeLink) {
        return nodeLink.retrieve().then(function (fileContents) {
            var json = JSON.parse(decodeA(fileContents));
            if (json.children == null) {
                var newNode = new leafNode(json.order);
                newNode.keyValuePairs = json.keyValuePairs;
                return Promise.resolve(newNode);
            } else {
                var promises = [];
                for (var i = 0; i < json.children.length; ++i) {
                    promises.push(retrieveNode(linkFactory.createFromBytes(encodeA(json.children[i]))));
                }
                return Promise.all(promises).then(function(nodes) {
                    var newNode = new branchNode(json.order);
                    newNode.keys = json.keys;
                    newNode.children = nodes;
                    return Promise.resolve(newNode);
                });
            }
        });
    }
    return retrieveNode(link).then(function(root) {
        var newTree = new BPlusTree.fromRoot(root);
        return Promise.resolve(newTree);
    });
};

BPlusTree.fromRoot = function(root) {
    var newTree = new BPlusTree(root.maxChildren);
    newTree.root = root;
    return newTree;
};

var bptreeStructure = function (order) {
    this.maxChildren = order;
    this.maxValues = order-1;
    this.minValues = Math.floor(this.maxValues/2);
    this.children = null;

    this.insert = function(key, value) {
        throw new AbstractMethodCallError("Called an abstract method", "bptreeStructure");
    };

    this.find = function(key) {
        throw new AbstractMethodCallError("Called an abstract method", "bptreeStructure");
    };

    this.get = function(key) {
        var position = this.find(key);
        if (position.index == null)
            return null;
        else
            return position.leaf.keyValuePairs[position.index].value;
    };

    this.getKey = function(index) {
        throw new AbstractMethodCallError("Called an abstract method", "bptreeStructure");
    };

    this.getKeysCount = function() {
        throw new AbstractMethodCallError("Called an abstract method", "bptreeStructure");
    };

    this.remove = function(key) {
        throw new AbstractMethodCallError("Called an abstract method", "bptreeStructure");
    }
};

var branchNode = function(order) {
    // call base constructor
    bptreeStructure.call(this, order);
    this.keys = [];
    this.children = [];

    this.getKeysCount = function() {
        return this.keys.length;
    };


    this.clone = function() {
        var clone = new branchNode(this.maxChildren);
        for (var i = 0; i < this.keys.length; ++i) {
            clone.keys[i] = this.keys[i];
        }
        for (var i = 0; i < this.children.length; ++i) {
            clone.children[i] = this.children[i];
        }
        return clone;
    };

    this.insert = function(key, value) {
        var index = this.findSpot(key);
        if (index.found)
            index.index++;
        index = index.index;
        var newChild = this.children[index].insert(key, value);
        
        if (newChild == null) {
            return null; // no changes
        }
        
        var newBranch = this.clone();

        if (newChild.getKeysCount() > this.maxValues) {
            var splitChild = newChild.split();
            newBranch.children.splice(index, 1, splitChild.left, splitChild.right);
            newBranch.keys.splice(index, 0, splitChild.separator);
        } else {
            newBranch.children[index] = newChild;
        }

        return newBranch;
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

        return this.children[spot.index].find(key);
    };

    this.split = function() {
        var halfLength = Math.floor(this.keys.length/2);

        var leftTree = new branchNode(this.maxChildren);
        var rightTree = new branchNode(this.maxChildren);

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
};
branchNode.prototype = bptreeStructure.prototype;

var leafNode = function(order) {
    // call base constructor
    bptreeStructure.call(this, order);

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
        var newLeaf = new leafNode(this.maxChildren);
        for (var i = 0; i < this.keyValuePairs.length; ++i) {
            newLeaf.keyValuePairs[i] = this.keyValuePairs[i];
        }
        return newLeaf;
    };

    this.split = function() {
        var halfLength = Math.floor(this.keyValuePairs.length/2);

        var leftLeaf = new leafNode(this.maxChildren);
        var rightLeaf = new leafNode(this.maxChildren);

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

        return newLeaf;
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
};
leafNode.prototype = bptreeStructure.prototype;