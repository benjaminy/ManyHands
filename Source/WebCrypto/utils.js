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
