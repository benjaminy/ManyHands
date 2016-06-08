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