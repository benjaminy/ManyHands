var BPlusTree = function(order) {
    this.root = new leafNode(order);
    this.insert = function(key, value) {
        var result = this.root.insert(key, value);
        if (result instanceof(bptreeStructure)) {
            this.root = result;
            return true;
        } else {
            return result;
        }
    };

    this.get = function(key) {
        return this.root.get(key);
    };

    this.remove = function(key) {
        var result = this.root.remove(key);
        if (this.root.keys && this.root.keys.length == 0) {
            if (this.root.children != null && this.root.children.length != 0)
                this.root = this.root.children[0];
        }
        return result;
    }
};

var bptreeStructure = function (order) {
    this.maxChildren = order;
    this.parent = null;
    this.maxValues = order-1;
    this.minValues = Math.floor(this.maxValues/2);
    this.children = null;

    this.insert = function(key, value) {
        var keyPosition = this.find(key);

        // eliminate duplicates
        if (keyPosition.index != null) {
            return false;
        }

        // redirect to the right leaf
        return keyPosition.leaf.insertValue(key, value);
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

    this.remove = function(key) {
        var location = this.find(key);
        if (location.index == null)
            return false;
        return location.leaf.removeItem(location.index);
    }
};

var branchNode = function(order) {
    // call base constructor
    bptreeStructure.call(this, order);
    this.keys = [];
    this.children = null;

    this.insert = function(key, value) {
        var keyPosition = this.find(key);

        // eliminate duplicates
        if (keyPosition.index != null) {
            return false;
        }

        // redirect to the right leaf
        return keyPosition.leaf.insertValue(key, value);
    };

    this.replaceChild = function(key, leftChild, rightChild) {
        leftChild.parent = this;
        rightChild.parent = this;

        var index = this.findSpot(key);
        this.children.splice(index, 1, leftChild, rightChild);
        this.keys.splice(index, 0, key);
        if (this.keys.length > this.maxValues)
            return this.split();
        else
            return true;
    };

    this.findSpot = function(key) {
        for (var i = 0; i < this.keys.length; ++i) {
            if (key <= this.keys[i]) {
                return i;
            }
        }
        return i;
    };

    this.find = function(key) {
        for (var i = 0; i < this.keys.length; ++i) {
            if (key < this.keys[i]) {
                return this.children[i].find(key);
            }
        }
        return this.children[i].find(key);
    };

    this.split = function() {
        var halfLength = Math.floor(this.keys.length/2);

        var leftTree = new branchNode(this.maxChildren);
        var rightTree = new branchNode(this.maxChildren);

        leftTree.keys = this.keys.splice(0, halfLength);
        var medianKey = this.keys.splice(0,1)[0];
        rightTree.keys = this.keys.splice(0);

        if (this.children != null) {
            leftTree.children = this.children.splice(0, halfLength + 1);
            rightTree.children = this.children.splice(0);
            for (var i = 0; i < leftTree.children.length; ++i) {
                leftTree.children[i].parent = leftTree;
            }
            for (var i = 0; i < rightTree.children.length; ++i) {
                rightTree.children[i].parent = rightTree;
            }
        }

        if (this.parent == null) {
            // this is the root, we need special treatment
            var newRoot = new branchNode(this.maxChildren);
            newRoot.keys = [medianKey];
            newRoot.children = [leftTree, rightTree];
            leftTree.parent = rightTree.parent = newRoot;
            return newRoot;
        } else {
            leftTree.parent = rightTree.parent = this.parent;
            return this.parent.replaceChild(medianKey, leftTree, rightTree);
        }
    };

    this.fixChildlessChildUnderflow = function(child, index) {
        var fixed = false;
        if (index != 0) {
            var previousChild = this.children[index - 1];
            if (previousChild.keyValuePairs.length > this.minValues) {
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
                var previousChild = this.children[index-1];
                this.keys.splice(index-1, 1);
                previousChild.keyValuePairs = previousChild.keyValuePairs.concat(
                    this.children.splice(index, 1)[0].keyValuePairs);
            } else {
                var nextChild = this.children[index+1];
                this.keys.splice(index, 1)[0];
                nextChild.keyValuePairs = this.children.splice(index, 1)[0].keyValuePairs.concat(
                    nextChild.keyValuePairs);
            }
            this.fixUnderflow();
        }
    };

    this.fixChildbearingChildUnderflow = function(child, index) {
        var fixed = false;
        if (index != 0) {
            var previousChild = this.children[index-1];
            if (previousChild.keys.length > this.minValues) {
                var lastValue = previousChild.keys.splice(previousChild.keys.length - 1, 1)[0];
                var lastChild = previousChild.children.splice(previousChild.children.length - 1, 1)[0];
                child.keys.unshift(this.keys[index-1]);
                child.children.unshift(lastChild);
                lastChild.parent = child;
                this.keys[index-1] = lastValue;
                fixed = true;
            }
        }

        if (!fixed) {
            if (index != this.keys.length) {
                var nextChild = this.children[index + 1];
                if (nextChild.keys.length > this.minValues) {
                    var firstValue = nextChild.keys.splice(0, 1)[0];
                    var firstChild = nextChild.children.splice(0,1)[0];
                    child.keys.push(this.keys[index]);
                    child.children.push(firstChild);
                    firstChild.parent = child;
                    this.keys[index] = firstValue;
                    fixed = true;
                }
            }
        }

        if (!fixed) {
            // merge
            if (index != 0) {
                var previousChild = this.children[index-1];
                var separatingValue = this.keys.splice(index-1, 1)[0];
                previousChild.keys.push(separatingValue);
                previousChild.keys = previousChild.keys.concat(child.keys);
                for (var i = 0; i < child.children.length; ++i) {
                    child.children[i].parent = previousChild;
                }
                previousChild.children = previousChild.children.concat(child.children);
            } else {
                var nextChild = this.children[index+1];
                var separatingValue = this.keys.splice(index, 1)[0];
                nextChild.keys.unshift(separatingValue);
                nextChild.keys = child.keys.concat(nextChild.keys);
                for (var i = 0; i < child.children.length; ++i) {
                    child.children[i].parent = nextChild;
                }
                nextChild.children = child.children.concat(nextChild.children);
            }
            this.children.splice(index, 1);
            this.fixUnderflow();
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

    this.fixUnderflow = function() {
        if (this.keys.length < this.minValues) {
            if (this.parent != null)
                this.parent.fixChildUnderflow(this);
            else {
                if (this.keys.length == 0 && this.children != null && this.children.length != 0) {
                    // new root:
                    this.children[0].parent = null;
                }
            }
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

    this.find = function(key) {
        for (var i = 0; i < this.keyValuePairs.length; ++i) {
            if (this.keyValuePairs[i].key == key)
                return { leaf: this, index: i };
        }
        return { leaf: this, index: null };
    };

    this.insertValue = function(key, value) {
        var index;
        for (index = 0; index < this.keyValuePairs.length; ++index) {
            if (key < this.keyValuePairs[index].key) {
                break;
            }
        }
        this.keyValuePairs.splice(index, 0, new KeyValuePair(key, value));

        if (this.keyValuePairs.length > this.maxValues) {
            return this.split();
        }
        return true;
    };

    this.split = function() {
        var halfLength = Math.floor(this.keyValuePairs.length/2);

        var leftLeaf = new leafNode(this.maxChildren);
        var rightLeaf = new leafNode(this.maxChildren);

        leftLeaf.keyValuePairs = this.keyValuePairs.splice(0, halfLength);
        var medianKey = this.keyValuePairs[0].key;
        rightLeaf.keyValuePairs = this.keyValuePairs.splice(0);

        if (this.parent == null) {
            // this is the root, we need special treatment
            var newRoot = new branchNode(this.maxChildren);
            newRoot.keys = [medianKey];
            newRoot.children = [leftLeaf, rightLeaf];
            leftLeaf.parent = rightLeaf.parent = newRoot;
            return newRoot;
        } else {
            leftLeaf.parent = rightLeaf.parent = this.parent;
            return this.parent.replaceChild(medianKey, leftLeaf, rightLeaf);
        }
    };
    this.removeItem = function(index) {
        if (this.children == null) {
            this.keyValuePairs.splice(index, 1);
            if (this.keyValuePairs.length < this.minValues)
                this.fixUnderflow();
        }
    };

    this.fixUnderflow = function() {
        if (this.keyValuePairs.length < this.minValues) {
            if (this.parent != null) {
                this.parent.fixChildUnderflow(this);
            }
        }
    }
};
leafNode.prototype = bptreeStructure.prototype;