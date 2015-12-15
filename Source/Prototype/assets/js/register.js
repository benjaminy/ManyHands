var APP_KEY = "rwovrjf7g18ya3b";
var access_token = "";
var publink = "";

var uploadCount;

var publicKeyLink, userSaltLink, accessTokenLink, teamFileLink;

var FILECOUNT = 4;

var someCOUNT = 4;

var publinkCount=0;

var regform = document.getElementById('regform');

var userField = document.getElementById('username');

var passField = document.getElementById('password');

window.onload = onWindowLoad;

function onWindowLoad(){

	if(window.location.hash){
		var params = parseqs(window.location.hash.substring(1));
		if(params.error){
				document.write("Error "+params.error+": "+params.error_description.replace(/\+/g,' '));
		}
		else{
			access_token = parseqs(window.location.hash.substring(1)).access_token;
		}
	}
}

function parseqs(text){
	var split = text.split('&');
	var params = {};
	for(var i=0; i<split.length; i++){
		var kv = split[i].split('=',2);
		params[kv[0]] = kv[1];
	}
	return params;
}

	

regform.onsubmit = function(evt){
	evt.preventDefault();
	initializeKeys();
}


//Implement reauthorization flow.


function initializeKeys(){
	
	var pass = passField.value;
	var uid = userField.value;  
	//var iv = forge.random.getBytesSync(16);
	var iv = "0000000000000000"

	//unencrypted accesstoken
	var uAccessToken = forge.util.createBuffer("accessToken: "+access_token);

	var rsa = forge.pki.rsa;
	
	var keypair = rsa.generateKeyPair({bits: 
		2048, e: 0x10001});
	
	var pem = forge.pki.publicKeyToPem(keypair.publicKey);
	
	var userSalt = forge.random.getBytesSync(128);

	var combo = pass.concat(uid);

	sessionStorage.setItem('combo', combo);
	sessionStorage.setItem('userSalt', userSalt)

	var pbkd = forge.pkcs5.pbkdf2(combo, userSalt, 40, 16);

	//Concatenate password and uid

	//http://cryptojs.altervista.org/secretkey/doc/doc_aes_forge.html

	var accessTokenCipher = forge.aes.startEncrypting(pbkd, iv);
	accessTokenCipher.update(uAccessToken);
	var status = accessTokenCipher.finish();
	var encryptedAccessToken = accessTokenCipher.output.data;

	var privKey = forge.pki.encryptRsaPrivateKey(keypair.privateKey, pbkd);

	uploadCount = 0;
	keyUploadRequest(userSalt, "userSalt");
	keyUploadRequest(pem, "pubKey");
	keyUploadRequest(privKey, "privKey");
	keyUploadRequest(encryptedAccessToken, "encryptedAccessToken");
	keyUploadRequest("", "team_links")
	//upload encrypted access token
}

function onFileUpload(){
	if(this.foo === "topLevelDir"){
		getPubLink("topLevelDir");
		publinkCount++;
		return;
	}
	uploadCount++;
	if (uploadCount === FILECOUNT){
		onAllUploadsComplete();
	}
}

function onAllUploadsComplete(){
	getPubLink("userSalt");
	getPubLink("pubKey");
	getPubLink("encryptedAccessToken");
	getPubLink("team_links");
}

function keyUploadRequest(requestData, filename){

	var xmlhttp = new XMLHttpRequest();
	xmlhttp.foo = filename;
	xmlhttp.addEventListener("load", onFileUpload, false)

	xmlhttp.open("POST", "https://api-content.dropbox.com/1/files_put/auto/"+filename+"?overwrite=true", true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(requestData);
}


function getPubLink(filename){

	var xmlhttp = new XMLHttpRequest();

	xmlhttp.filename = filename;
	xmlhttp.addEventListener("load", publinkCallBack, false);

	xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+filename+"?short_url=false",true);
	xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
	xmlhttp.send(null);
}

function publinkCallBack(){
	var resp = JSON.parse(this.responseText);
	link = resp.url.replace("www.dropbox.com", "dl.dropboxusercontent.com");


	if(this.filename === "pubKey"){
		publicKeyLink = link;
	}

	else if(this.filename === "userSalt"){
		userSaltLink = link;
	}

	else if(this.filename === "encryptedAccessToken"){
		accessTokenLink = link;
	}

	else if(this.filename === "team_links"){
		teamFileLink = link;
	}

	else if(this.filename === "topLevelDir"){
		onTopLevelDirRx(link);
		return;
	}

	publinkCount++;

	if(publinkCount === someCOUNT){
		onAllPublinkRx();
	}
}

function onTopLevelDirRx(link){
	var params = "uid="+encodeURIComponent(userField.value)+"&link="+encodeURIComponent(link);

	var xmlhttp = new XMLHttpRequest();

	xmlhttp.addEventListener('load', onRegisterComplete, false);

	xmlhttp.open("POST", "register", true);
	xmlhttp.send(params);
}

function onRegisterComplete(){
	window.location.href = "Prototype.html";
}

function onAllPublinkRx(){
	var topLevelContents = publicKeyLink+"\n"+accessTokenLink+"\n"+userSaltLink+"\n"+teamFileLink+"\n";
	keyUploadRequest(topLevelContents, "topLevelDir")
}
