var APP_KEY = "rwovrjf7g18ya3b";
var access_token = "";
var publink = "";

var uploadCount;

var publicKeyLink;

var accessTokenLink;

var FILECOUNT = 4;

var someCOUNT = 2;

var regform = document.getElementById('regform');

var userField = document.getElementById('username');

function onWindowLoad(){

	if(window.location.hash){
		var params = parseqs(window.location.hash.substring(1));
		if(params.error){
				document.write("Error "+params.error+": "+params.error_description.replace(/\+/g,' '));
		}
		else{
			access_token = parseqs(window.location.hash.substring(1)).access_token;
			localStorage.setItem('access_token', access_token);
		}
	}
}

	

regform.onsubmit = function(evt){
	evt.preventDefault();
	initializeKeys();
}


	//Is there a way to make sure a certain function executes once this function completes?
	function initializeKeys(){
		var pass = document.getElementById('password').value;

		var rsa = forge.pki.rsa;
		
		var keypair = rsa.generateKeyPair({bits: 128, e: 0x10001});
		
		var pem = forge.pki.publicKeyToPem(keypair.publicKey);
		
		var salt1 = forge.random.getBytesSync(128);

		var pbkd = forge.pkcs5.pbkdf2(pass, salt1, 40, 16);
		//Concatenate password and uid

		var privKey = forge.pki.encryptRsaPrivateKey(keypair.privateKey, pbkd);

		uploadCount = 0;
		keyUploadRequest(salt1, "salt1");
		keyUploadRequest(pem, "pubKey");
		keyUploadRequest(privKey, "privKey");
		keyUploadRequest(localStorage.getItem("access_token"), "access_token");
		//upload encrypted access token
		//call get public link
	}

	function onFileUpload(){
		if(this.foo === "topLevelDir"){
			getPubLink("topLevelDir");
			return;
		}
		uploadCount++;
		if (uploadCount === FILECOUNT){
			onAllUploadsComplete();
		}
	}

	function onAllUploadsCompelte(){
		getPubLink("pubKey");
		getPubLink("access_token")
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

		xmlhttp.open("POST", "https://api.dropbox.com/1/shares/auto/"+filename"+?short_url=false",true);
		xmlhttp.setRequestHeader("Authorization"," Bearer "+access_token);
		xmlhttp.send(null);
	}

	function publinkCallBack(){
		var link = JSON.parse(this.responseText);
		link = link.replace("www.dropbox.com", "dl.dropboxusercontent.com");

		if(this.filename === "pubKey"){
			publicKeyLink = link;
		}

		else if(this.filename === "access_token"){
			accessTokenLink = link;
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

		xmlhttp.open("POST", "register", false);
		xmlhttp.send(params);
	}

	function onRegisterComplete(){
		window.location.href = "Prototype.html";
	}

	function onAllPublinkRx(){
		var topLevelContents = publicKeyLink+"\n"+accessTokenLink;
		keyUploadRequest(topLevelContents, "topLevelDir")
	}
