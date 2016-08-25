// The fileLinks are a system of decorating sharedFiles, so that we can use encrypted data in the same way
// as unencrypted data.

// Base class. Represents a link to a file, and can be retrieved, encoded, etc
// - just like shared file objects
var Link = function() {
    this.path = null;
    this.retrieve = function() {
        throw new AbstractMethodCallError("Called an abstract method", "Link");
    };
    this.encode = function() {
        throw new AbstractMethodCallError("Called an abstract method", "Link");
    }
};

// Derivation of the previous class - it enables encrypting the linked file
var LinkToEncrypted = function(link, IV, key) {
    this.link = link;
    this.path = link.path;
    this.IV = IV;
    this.key = key;
    this.retrieve = function() {
        var link = this;
        return this.link.retrieve().then(function(fileContents) {
            return decrypt_aes_cbc(link.IV, link.key, fileContents);
        }).then(function(plainText) {
            return Promise.resolve(new Uint8Array(plainText));
        });
    };
    this.encode = function() {
        var link_encoded = this.link.encode();
        var iv_encoded = this.IV;
        return mergeUint8Arrays(iv_encoded, link_encoded);
    }
};

// Base class representing different ways to create a link object
var LinkFactory = function() {
    this.createFromBytes = function (bytes) {
        throw new AbstractMethodCallError("Called an abstract method", "LinkFactory");
    };
    this.create = function(sharedFile) {
        throw new AbstractMethodCallError("Called an abstract method", "LinkFactory");
    };
    this.uploadAndShare = function(cloud, path, content) {
        throw new AbstractMethodCallError("Called an abstract method", "LinkFactory");
    }
};

// Encrypted link factory
var EncLinkFactory = function(key) {
    this.key = key;
    this.create = function(sharedFile) {
        var iv = new Uint8Array(16);
        window.crypto.getRandomValues(iv);
        return new LinkToEncrypted(sharedFile, iv, this.key);
    };
    this.createFromBytes = function (bytes) {
        return new LinkToEncrypted(new SharedFile(bytes.slice(16)),bytes.slice(0,16),this.key);
    };
    this.uploadAndShare = function(cloud,path,content) {
        var factory = this;
        var newIv = new Uint8Array(16);
        window.crypto.getRandomValues(newIv);
        return encrypt_aes_cbc(newIv, factory.key, content instanceof Uint8Array ? content : encodeA(content))
            .then(function(cipherText){
            return cloud.uploadFile(new Uint8Array(cipherText), path);
        }).then(function() {
            return cloud.shareFile(path);
        }).then(function(accessor) {
            return Promise.resolve(new LinkToEncrypted(accessor, newIv, factory.key));
        });
    };
};
EncLinkFactory.prototype = LinkFactory.prototype;

var SharedFileFactory = function() {
    this.create = function(sharedFile) {
        return sharedFile;
    };
    this.createFromBytes = function (bytes) {
        return new SharedFile(bytes);
    };
    this.uploadAndShare = function(cloud,path,content) {
        return cloud.uploadFile(content instanceof Uint8Array ? content : encodeA(content), path).then(function(){
            return cloud.shareFile(path);
        });
    };
};
SharedFileFactory.prototype = LinkFactory.prototype;

LinkToEncrypted.prototype = Link.prototype;
SharedFile.prototype = Link.prototype;