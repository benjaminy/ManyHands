var BTree = function(order) {
    this.root = new btreeStructure(order);
    this.insert = function(key, value) {
        var result = this.root.insert(key, value);
        if (result instanceof(btreeStructure)) {
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
        if (this.root.keyValuePairs.length == 0) {
            if (this.root.children != null && this.root.children.length != 0)
                this.root = this.root.children[0];
        }
        return result;
    }
};

var btreeStructure = function (order) {
    var KeyValuePair = function(key, value) {
        this.key = key;
        this.value = value;
    };

    this.maxChildren = order;
    this.parent = null;
    this.maxValues = order-1;
    this.minValues = Math.floor(this.maxValues/2);
    this.keyValuePairs = [];
    this.children = null;

    this.insert = function(key, value) {
        var keyPosition = this.find(key);

        // eliminate duplicates
        if (keyPosition.index != null) {
            return false;
        }
        // redirect to the right tree
        return keyPosition.tree.insertValue(key, value);
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

    this.replaceChild = function(keyValuePair, leftChild, rightChild) {
        var index = this.findSpot(keyValuePair.key);
        this.children.splice(index, 1, leftChild, rightChild);
        this.keyValuePairs.splice(index, 0, keyValuePair);
        if (this.keyValuePairs.length > this.maxValues)
            return this.split();
        else
            return true;
    };

    this.findSpot = function(key) {
        for (var i = 0; i < this.keyValuePairs.length; ++i) {
            if (key <= this.keyValuePairs[i].key) {
                return i;
            }
        }
        return i;
    };

    this.find = function(key) {
        for (var i = 0; i < this.keyValuePairs.length; ++i) {
            if (this.keyValuePairs[i].key == key) {
                return { tree: this, index: i };
            } else if (key < this.keyValuePairs[i].key) {
                if (this.children) {
                    return this.children[i].find(key);
                }
            }
        }
        if (this.children) {
            return this.children[i].find(key);
        } else {
            return { tree: this, index: null };
        }
    };

    this.get = function(key) {
        var position = this.find(key);
        if (position.index == null)
            return null;
        else
            return position.tree.keyValuePairs[position.index].value;
    };

    this.split = function() {
        var halfLength = Math.floor(this.keyValuePairs.length/2);

        var leftTree = new btreeStructure(this.maxChildren);
        var rightTree = new btreeStructure(this.maxChildren);

        leftTree.keyValuePairs = this.keyValuePairs.splice(0, halfLength);
        var medianValue = this.keyValuePairs.splice(0,1)[0];
        rightTree.keyValuePairs = this.keyValuePairs.splice(0);

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
            var newRoot = new btreeStructure(this.maxChildren);
            newRoot.keyValuePairs = [medianValue];
            newRoot.children = [leftTree, rightTree];
            leftTree.parent = rightTree.parent = newRoot;
            return newRoot;
        } else {
            leftTree.parent = rightTree.parent = this.parent;
            return this.parent.replaceChild(medianValue, leftTree, rightTree);
        }
    };

    this.fixChildlessChildUnderflow = function(child, index) {
        var fixed = false;
        if (index != 0) {
            var previousChild = this.children[index - 1];
            if (previousChild.keyValuePairs.length > this.minValues) {
                var lastValue = previousChild.keyValuePairs.splice(previousChild.keyValuePairs.length - 1, 1)[0];
                child.keyValuePairs.unshift(this.keyValuePairs[index - 1]);
                this.keyValuePairs[index - 1] = lastValue;
                fixed = true;
            }
        }

        if (!fixed) {
            if (index != this.keyValuePairs.length) {
                var nextChild = this.children[index + 1];
                if (nextChild.keyValuePairs.length > this.minValues) {
                    var firstValue = nextChild.keyValuePairs.splice(0, 1)[0];
                    child.keyValuePairs.push(this.keyValuePairs[index]);
                    this.keyValuePairs[index] = firstValue;
                    fixed = true;
                }
            }
        }

        if (!fixed) {
            // merge
            if (index != 0) {
                var previousChild = this.children[index-1];
                var separatingValue = this.keyValuePairs.splice(index-1, 1)[0];
                previousChild.keyValuePairs.push(separatingValue);
                previousChild.keyValuePairs = previousChild.keyValuePairs.concat(
                    this.children.splice(index, 1)[0].keyValuePairs);
            } else {
                var nextChild = this.children[index+1];
                var separatingValue = this.keyValuePairs.splice(index, 1)[0];
                nextChild.keyValuePairs.unshift(separatingValue);
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
            if (previousChild.keyValuePairs.length > this.minValues) {
                var lastValue = previousChild.keyValuePairs.splice(previousChild.keyValuePairs.length - 1, 1)[0];
                var lastChild = previousChild.children.splice(previousChild.children.length - 1, 1)[0];
                child.keyValuePairs.unshift(this.keyValuePairs[index-1]);
                child.children.unshift(lastChild);
                lastChild.parent = child;
                this.keyValuePairs[index-1] = lastValue;
                fixed = true;
            }
        }

        if (!fixed) {
            if (index != this.keyValuePairs.length) {
                var nextChild = this.children[index + 1];
                if (nextChild.keyValuePairs.length > this.minValues) {
                    var firstValue = nextChild.keyValuePairs.splice(0, 1)[0];
                    var firstChild = nextChild.children.splice(0,1)[0];
                    child.keyValuePairs.push(this.keyValuePairs[index]);
                    child.children.push(firstChild);
                    firstChild.parent = child;
                    this.keyValuePairs[index] = firstValue;
                    fixed = true;
                }
            }
        }

        if (!fixed) {
            // merge
            if (index != 0) {
                var previousChild = this.children[index-1];
                var separatingValue = this.keyValuePairs.splice(index-1, 1)[0];
                previousChild.keyValuePairs.push(separatingValue);
                previousChild.keyValuePairs = previousChild.keyValuePairs.concat(child.keyValuePairs);
                for (var i = 0; i < child.children.length; ++i) {
                    child.children[i].parent = previousChild;
                }
                previousChild.children = previousChild.children.concat(child.children);
            } else {
                var nextChild = this.children[index+1];
                var separatingValue = this.keyValuePairs.splice(index, 1)[0];
                nextChild.keyValuePairs.unshift(separatingValue);
                nextChild.keyValuePairs = child.keyValuePairs.concat(nextChild.keyValuePairs);
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
        if (this.keyValuePairs.length < this.minValues) {
            if (this.parent != null)
                this.parent.fixChildUnderflow(this);
            else {
                if (this.keyValuePairs.length == 0 && this.children != null && this.children.length != 0) {
                    // new root:
                    this.children[0].parent = null;
                }
            }
        }
    };

    this.findMax = function() {
        var lastValueIndex = this.keyValuePairs.length - 1;
        if (this.children == null) {
            return { keyValuePair: this.keyValuePairs[lastValueIndex], tree: this, index: lastValueIndex };
        } else {
            return this.children[lastValueIndex+1].findMax();
        }
    };

    this.removeItem = function(index) {
        if (this.children == null) {
            this.keyValuePairs.splice(index, 1);
            if (this.keyValuePairs.length < this.minValues)
                this.fixUnderflow();
        } else {
            // If our children don't have children
            if (this.children[0].children == null) {
                if (this.children[index].keyValuePairs.length > this.minValues) {
                    var lastPair = this.children[index].keyValuePairs.splice(this.children[index].keyValuePairs.length-1,1)[0];
                    this.keyValuePairs[index] = lastPair;
                } else if (this.children[index+1].keyValuePairs.length > this.minValues) {
                    var firstPair = this.children[index+1].keyValuePairs.splice(0,1)[0];
                    this.keyValuePairs[index] = firstPair;
                } else {
                    // merge
                    var nextChild = this.children.splice(index+1, 1)[0];
                    this.children[index].keyValuePairs = this.children[index].keyValuePairs.concat(nextChild.keyValuePairs);
                    this.keyValuePairs.splice(index,1);
                    this.fixUnderflow();
                }
            } else {
                var max = this.children[index].findMax();
                this.keyValuePairs[index] = max.keyValuePair;
                max.tree.removeItem(max.index);
            }
        }
    };

    this.remove = function(key) {
        var location = this.find(key);
        if (location.index == null)
            return false;
        return location.tree.removeItem(location.index);
    }
};