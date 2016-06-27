// var Lock = function() {
//     this.locked = false;
//     this.waitingList = [];
//     this.unlock = function() {
//         var thisLock = this;
//         if (this.waitingList.length > 0) {
//             var action = this.waitingList[0];
//             var result = action.method();
//             // check if result is a promise
//             if (result && result.then) {
//                 result.then(function(r) {
//                     thisLock.unlock();
//                     action.resolve(r);
//                 }, function(r) {
//                     thisLock.unlock();
//                     action.reject(r);
//                 });
//             } else {
//                 this.unlock();
//                 action.resolve(result);
//             }
//             this.waitingList.splice(0,1);
//         } else {
//             this.locked = false;
//         }
//     };
//
//     this.lock = function(method) {
//         var thisLock = this;
//         if (!this.locked) {
//             this.locked = true;
//             var result = method();
//             // check if result is a promise
//             if (result && result.then) {
//                 return result.then(function(r) {
//                     thisLock.unlock();
//                     return Promise.resolve(r);
//                 }, function(r) {
//                     thisLock.unlock();
//                     return Promise.reject(r);
//                 });
//             } else {
//                 this.unlock();
//                 return result;
//             }
//         } else {
//             return new Promise(function(resolve, reject) {
//                 thisLock.waitingList.push({resolve: resolve, reject: reject, method: method});
//             });
//         }
//     };
// };

var Lock = function() {
    this.locked = false;
    this.lockedBy = null;
    this.lockCount = 0;
    this.waitingList = [];
    this.unlock = function() {
        this.lockCount--;
        if (this.lockCount > 0)
            return;

        var thisLock = this;
        if (this.waitingList.length > 0) {
            var action = this.waitingList[0];
            thisLock.lockedBy = action.taskId;
            var result = action.method();
            // check if result is a promise
            if (result && result.then) {
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

    this.lock = function(method, scope) {
        var thisLock = this;
        if (this.lockedBy == scope.tid || !this.locked) {
            if (this.locked && this.lockedBy == scope.tid)
                this.lockCount++;
            else
                this.lockCount=1;

            this.lockedBy = scope.tid;
            this.locked = true;
            var result = method();
            // check if result is a promise
            if (result && result.then) {
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
                thisLock.waitingList.push({resolve: resolve, reject: reject, method: method, taskId: scope.tid});
            });
        }
    };
};