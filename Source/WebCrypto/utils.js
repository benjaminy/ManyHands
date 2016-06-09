var FILE_SERVER_PORT = 8123;
var FILE_SERVER_ADDR = 'http://localhost:'+FILE_SERVER_PORT;

function AbstractMethodCallError(message, className) {
    this.name = "AbstractMethodCallError";
    this.className = className;
    this.message = message || "";
    this.stack = (new Error()).stack;
}
AbstractMethodCallError.prototype = Object.create(Error.prototype);
AbstractMethodCallError.prototype.constructor = AbstractMethodCallError;

function InputValueError(message) {
    this.name = "InputValueError";
    this.message = message || "";
    this.stack = (new Error()).stack;
}
InputValueError.prototype = Object.create(Error.prototype);
InputValueError.prototype.constructor = InputValueError;

function generateRandomAesKey(length = 256) {
    return C.generateKey(
        {
            name: "AES-CBC",
            length: length
        },
        true,
        ["encrypt", "decrypt"]
    ).then(function(key){
        return Promise.resolve(key);
    }).catch(function(err){
        return Promise.reject(new CryptoError("Could not generate AES key"));
    });
}

function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
}

function mergeUnique(arr1, arr2) {
    return arrayUnique(arr1.concat(arr2));
}

function mergeUint8Arrays(arrays) {
    var input;
    if (!(arrays instanceof Array)) {
        input = arguments;
    } else {
        input = arrays;
    }
    var size = 0;
    for (var i = 0; i < input.length; ++i) {
        size += input[i].length;
    }
    var res = new Uint8Array(size);
    var curr = 0;
    for (var i = 0; i < input.length; ++i) {
        for (var j = 0; j < input[i].length; ++j, ++curr) {
            res[curr] = input[i][j];
        }
    }
    return res;
}

var Lock = function() {
    this.locked = false;
    this.waitingList = [];
    this.unlock = function() {
        var thisLock = this;
        if (this.waitingList.length > 0) {
            var action = this.waitingList[0];
            var result = action.method();
            // check if result is a promise
            if (result.then) {
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
            if (result.then) {
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